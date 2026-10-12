import { Hono } from 'hono';
import { z } from 'zod';
import { AiUnavailable, BASE_SYSTEM, callAI, extractJson, logBadOutput } from '../ai';
import { fmtSlots, freeSlotsFor, planDay } from '../planning';
import { rankTasks } from '../schedule';
import { getTask, insertEvent, insertTask, listEvents, listOpenTasks, setTaskStatus } from '../services';
import type { AppEnv, Env, User } from '../types';
import { DATETIME_RE, isValidDate, TIME_RE, todayIn, weekdayJa } from '../util';

const app = new Hono<AppEnv>();

// AI はここ(チャットでのタスク追加・各種依頼)と /plan(スケジュール案の作成)でのみ使う。
// 実行推奨タスク・励ましコメントはロジックのみで計算する(features.ts / routes/dashboard.ts)。

app.post('/plan', async (c) => {
  const user = c.get('user');
  const body = z
    .object({ date: z.string().refine(isValidDate).optional() })
    .safeParse(await c.req.json().catch(() => ({})));
  if (!body.success) return c.json({ error: 'invalid_body' }, 400);
  const today = todayIn(user.timezone);
  const date = body.data.date ?? today;
  if (date < today) return c.json({ error: 'past_date' }, 400);
  return c.json(await planDay(c.env, user, date));
});

// ---- 自然言語での操作(下部の入力欄) ----
// LLM は「アクションの JSON」を返すだけ。実行はサーバー側が検証してから行う。
// 削除などの破壊的操作は許可しない(画面から行う)。

const dateS = z.string().refine(isValidDate);
const timeS = z.string().regex(TIME_RE);
const Action = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('add_task'),
    title: z.string().trim().min(1).max(200),
    project: z.string().trim().max(60).nullish(),
    due: dateS.nullish(),
    urgency: z.number().int().min(1).max(5).nullish(),
    priority: z.number().int().min(1).max(5).nullish(),
    est_minutes: z.number().int().min(5).max(1440).nullish(),
    done_criteria: z.string().max(500).nullish(),
    notes: z.string().max(2000).nullish(),
  }),
  z.object({ type: z.literal('complete_task'), task_id: z.number().int() }),
  z.object({
    type: z.literal('add_event'),
    title: z.string().trim().min(1).max(200),
    date: dateS,
    start: timeS,
    end: timeS,
    task_id: z.number().int().nullish(),
  }),
  z.object({ type: z.literal('free_slots'), date: dateS }),
  z.object({ type: z.literal('plan'), date: dateS.nullish() }),
]);
const ChatOut = z.object({ reply: z.string().max(400), actions: z.array(z.unknown()).max(5) });

const fmtDate = (d: string) => `${Number(d.slice(5, 7))}/${Number(d.slice(8, 10))}(${weekdayJa(d)})`;

app.post('/chat', async (c) => {
  const user = c.get('user');
  const body = z.object({ message: z.string().trim().min(1).max(500) }).safeParse(await c.req.json().catch(() => null));
  if (!body.success) return c.json({ error: 'invalid_body' }, 400);

  const today = todayIn(user.timezone);
  const [open, todayEvents] = await Promise.all([
    listOpenTasks(c.env.DB, user.id, 30),
    listEvents(c.env.DB, user.id, today, today),
  ]);
  const data = {
    today,
    weekday: weekdayJa(today),
    tasks: rankTasks(open, today).map((t) => ({ id: t.id, title: t.title, project: t.project_name, due: t.due_date })),
    today_events: todayEvents.map((e) => ({ title: e.title, start: e.start_at.slice(11), end: e.end_at.slice(11) })),
  };

  let out: z.infer<typeof ChatOut>;
  let raw = '';
  try {
    raw = await callAI(
      c.env,
      user.id,
      `${BASE_SYSTEM}ユーザーの依頼を次のJSONに変換します。` +
        `{"reply":"ユーザーへのやさしい返事(80字以内)","actions":[...]}。actionsは最大5件で、種類は次のとおり:\n` +
        `{"type":"add_task","title":"","project":"任意","due":"YYYY-MM-DD 任意","urgency":1〜5 任意,"priority":1〜5 任意,"est_minutes":数値 任意,"done_criteria":"任意","notes":"任意"}\n` +
        `{"type":"complete_task","task_id":数値}  (data.tasksにあるidのみ)\n` +
        `{"type":"add_event","title":"","date":"YYYY-MM-DD","start":"HH:MM","end":"HH:MM","task_id":数値 任意}\n` +
        `{"type":"free_slots","date":"YYYY-MM-DD"}  (空き時間を聞かれたとき)\n` +
        `{"type":"plan","date":"YYYY-MM-DD"}  (スケジュール案の作成を頼まれたとき)\n` +
        `上記以外の操作(削除など)はできません。その場合はactionsを空にして、画面から操作するよう案内します。` +
        `日付はdata.todayを基準に計算します。`,
      `<data>${JSON.stringify(data)}</data>\nユーザーの依頼: ${body.data.message}`,
      600,
    );
    out = ChatOut.parse(extractJson(raw));
  } catch (e) {
    const limited = e instanceof AiUnavailable && e.reason === 'limit';
    if (!(e instanceof AiUnavailable)) logBadOutput('chat', raw, e);
    return c.json({
      reply: limited
        ? '今日のAI利用上限に達しました。明日また使えます(UTC 0時にリセット)。タスクや予定は左のメニューから追加できます。'
        : 'うまく読み取れませんでした。もう少し具体的に、もう一度お願いします。',
      results: [],
      changed: false,
      aiLimited: limited,
    });
  }

  const { results, extra, changed } = await executeActions(c.env, user, out.actions, today);
  const reply = [out.reply.trim(), ...extra].filter(Boolean).join('\n');
  return c.json({ reply, results, changed, aiLimited: false });
});

async function executeActions(env: Env, user: User, raw: unknown[], today: string) {
  const results: { type: string; ok: boolean; detail?: unknown }[] = [];
  const extra: string[] = [];
  let changed = false;

  for (const item of raw) {
    const a = Action.safeParse(item);
    if (!a.success) {
      results.push({ type: 'invalid', ok: false });
      continue;
    }
    const act = a.data;
    try {
      if (act.type === 'add_task') {
        const task = await insertTask(env.DB, user, { ...act, due_date: act.due });
        results.push({ type: act.type, ok: true, detail: task });
        changed = true;
      } else if (act.type === 'complete_task') {
        const own = await getTask(env.DB, user.id, act.task_id);
        if (!own) {
          results.push({ type: act.type, ok: false });
          continue;
        }
        results.push({ type: act.type, ok: true, detail: await setTaskStatus(env.DB, user, act.task_id, 'done') });
        changed = true;
      } else if (act.type === 'add_event') {
        const start_at = `${act.date}T${act.start}`;
        const end_at = `${act.date}T${act.end}`;
        if (!DATETIME_RE.test(start_at) || end_at <= start_at) {
          results.push({ type: act.type, ok: false });
          extra.push('予定の時間が正しくないため追加できませんでした。');
          continue;
        }
        const event = await insertEvent(env.DB, user.id, { title: act.title, start_at, end_at, task_id: act.task_id });
        results.push({ type: act.type, ok: true, detail: event });
        changed = true;
      } else if (act.type === 'free_slots') {
        const slots = fmtSlots(await freeSlotsFor(env, user, act.date));
        extra.push(`${fmtDate(act.date)}の空き: ${slots.length ? slots.join(', ') : 'ありません'}`);
        results.push({ type: act.type, ok: true, detail: slots });
      } else if (act.type === 'plan') {
        const date = act.date && act.date >= today ? act.date : today;
        const plan = await planDay(env, user, date);
        extra.push(`${fmtDate(date)}のスケジュール案を${plan.proposals.length}件作りました。${plan.message}`);
        results.push({ type: act.type, ok: true, detail: { date, count: plan.proposals.length } });
        changed = plan.proposals.length > 0 || changed;
      }
    } catch (e) {
      console.warn('action failed', act.type, e instanceof Error ? e.message : e);
      results.push({ type: act.type, ok: false });
    }
  }
  return { results, extra, changed };
}

export default app;
