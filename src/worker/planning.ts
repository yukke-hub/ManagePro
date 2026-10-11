import { z } from 'zod';
import { AiUnavailable, BASE_SYSTEM, callAI, extractJson, logBadOutput } from './ai';
import { fallbackPlan, busyOf, computeFreeSlots, rankTasks, validateBlocks, type Slot } from './schedule';
import { listEvents, listOpenTasks } from './services';
import type { Env, EventRow, User } from './types';
import { addDays, nowMinutesIn, TIME_RE, todayIn, toHHMM, toMin } from './util';

/** その日の空き時間。今日なら現在時刻(15分切り上げ)以降のみ */
export async function freeSlotsFor(env: Env, user: User, date: string): Promise<Slot[]> {
  const events = await listEvents(env.DB, user.id, date, date, 'confirmed');
  const notBefore = date === todayIn(user.timezone) ? Math.ceil(nowMinutesIn(user.timezone) / 15) * 15 : 0;
  return computeFreeSlots(busyOf(events), toMin(env.WORK_START || '09:00'), toMin(env.WORK_END || '21:00'), notBefore);
}

export const fmtSlots = (slots: Slot[]) => slots.map((s) => `${toHHMM(s.start)}-${toHHMM(s.end)}`);

const PlanOut = z.object({
  blocks: z.array(z.object({ task_id: z.number().int(), start: z.string(), end: z.string() })).max(12),
  message: z.string().max(200).optional(),
});

export interface PlanResult {
  date: string;
  proposals: EventRow[];
  message: string;
  source: 'ai' | 'rule';
  aiLimited: boolean;
}

/**
 * 指定日の予定案を作って status='proposed' で保存する(承認するまで確定しない)。
 * 同じ日の古い提案は置き換える。AI が使えない/不正な出力ならルールベースで代替。
 */
export async function planDay(env: Env, user: User, date: string): Promise<PlanResult> {
  const slots = await freeSlotsFor(env, user, date);
  const ranked = rankTasks(await listOpenTasks(env.DB, user.id, 50));
  const top = ranked.slice(0, 12);

  if (slots.length === 0 || top.length === 0) {
    return {
      date,
      proposals: [],
      message: top.length === 0 ? '予定にできるタスクがありません。' : 'この日は空き時間がありません。',
      source: 'rule',
      aiLimited: false,
    };
  }

  let source: 'ai' | 'rule' = 'rule';
  let aiLimited = false;
  let message = 'ルールに沿って、期限が近い順に空き時間へ並べました。';
  let blocks = fallbackPlan(top, slots);

  let raw = '';
  try {
    const data = {
      date,
      slots: fmtSlots(slots),
      tasks: top.map((t) => ({ id: t.id, title: t.title, project: t.project_name, due: t.due_date, est_minutes: t.est_minutes })),
    };
    raw = await callAI(
      env,
      user.id,
      `${BASE_SYSTEM}空き時間(slots)にタスクを割り当ててJSONで返します。` +
        `形式: {"blocks":[{"task_id":数値,"start":"HH:MM","end":"HH:MM"}],"message":"やさしい一言(60字以内)"}。` +
        `ルール: 各ブロックは必ずいずれかのslot内に収める。所要時間はest_minutes(無ければ60分)を目安にする。` +
        `期限が近いものを優先し、詰め込みすぎない。`,
      `<data>${JSON.stringify(data)}</data>`,
      500,
    );
    const parsed = PlanOut.parse(extractJson(raw));
    const valid = validateBlocks(
      parsed.blocks,
      new Set(top.map((t) => t.id)),
      slots,
      (s) => (TIME_RE.test(s) ? toMin(s) : null),
    );
    if (valid.length > 0) {
      blocks = valid;
      source = 'ai';
      message = parsed.message?.trim() || 'スケジュール案を作りました。確認して承認してください。';
    }
  } catch (e) {
    if (e instanceof AiUnavailable) aiLimited = e.reason === 'limit';
    else logBadOutput('plan', raw, e);
  }

  // D1 へのリクエスト数を抑えるため、削除+挿入を 1 回の batch にまとめる
  const titleById = new Map(top.map((t) => [t.id, t.title]));
  await env.DB.batch([
    env.DB.prepare(
      `DELETE FROM events WHERE user_id = ? AND status = 'proposed' AND start_at >= ? AND start_at < ?`,
    ).bind(user.id, `${date}T00:00`, `${addDays(date, 1)}T00:00`),
    ...blocks.map((b) =>
      env.DB.prepare(
        `INSERT INTO events (user_id, task_id, title, start_at, end_at, status, source)
         VALUES (?, ?, ?, ?, ?, 'proposed', 'ai')`,
      ).bind(
        user.id,
        b.task_id,
        titleById.get(b.task_id) ?? 'タスク',
        `${date}T${toHHMM(b.start)}`,
        `${date}T${toHHMM(b.end)}`,
      ),
    ),
  ]);
  const proposals = await listEvents(env.DB, user.id, date, date, 'proposed');
  return { date, proposals, message, source, aiLimited };
}
