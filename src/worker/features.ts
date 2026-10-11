import { z } from 'zod';
import { AiUnavailable, BASE_SYSTEM, callAI, extractJson, getCache, logBadOutput, setCache } from './ai';
import { pickRecommended, rankTasks } from './schedule';
import { listOpenTasks, weekDoneCount } from './services';
import type { Env, TaskRow, User } from './types';
import { nowMinutesIn, shortHash, weekRange } from './util';
import { freeSlotsFor } from './planning';

export interface Recommendation {
  tasks: TaskRow[];
  reason: string | null;
  source: 'ai' | 'rule';
  aiLimited?: boolean;
}

interface RecPayload {
  ids: number[];
  reason: string;
}

export async function recommendSig(date: string, ranked: TaskRow[]): Promise<string> {
  return shortHash(
    `${date}|${ranked.slice(0, 30).map((t) => `${t.id}:${t.due_date}:${t.est_minutes}:${t.status}`).join(',')}`,
  );
}

async function capacityMinutes(env: Env, user: User, date: string): Promise<number> {
  const slots = await freeSlotsFor(env, user, date);
  return slots.reduce((sum, s) => sum + (s.end - s.start), 0);
}

function fromIds(ranked: TaskRow[], p: RecPayload): TaskRow[] {
  const byId = new Map(ranked.map((t) => [t.id, t]));
  return p.ids.map((id) => byId.get(id)).filter((t): t is TaskRow => !!t);
}

/** キャッシュがあれば AI 結果、なければルールベース(AI は呼ばない)。ダッシュボード表示用 */
export async function cachedRecommendation(env: Env, user: User, date: string, ranked: TaskRow[]) {
  const sig = await recommendSig(date, ranked);
  const cached = (await getCache(env.DB, user.id, 'recommend', sig)) as RecPayload | null;
  if (cached && Array.isArray(cached.ids)) {
    const tasks = fromIds(ranked, cached);
    if (tasks.length > 0) return { rec: { tasks, reason: cached.reason ?? null, source: 'ai' } as Recommendation, stale: false };
  }
  const cap = await capacityMinutes(env, user, date);
  return { rec: { tasks: pickRecommended(ranked, cap), reason: null, source: 'rule' } as Recommendation, stale: ranked.length > 0 };
}

const RecOut = z.object({ ids: z.array(z.number().int()).max(5), reason: z.string().max(200) });

/** AI で「今日の実行推奨タスク」を選ぶ。失敗・上限超過時はルールベース */
export async function aiRecommend(env: Env, user: User, date: string): Promise<Recommendation> {
  const ranked = rankTasks(await listOpenTasks(env.DB, user.id, 100));
  const cachedResult = await cachedRecommendation(env, user, date, ranked);
  if (!cachedResult.stale) return cachedResult.rec;
  if (ranked.length === 0) return cachedResult.rec;

  const cap = await capacityMinutes(env, user, date);
  let raw = '';
  try {
    const data = {
      today: date,
      free_minutes_today: cap,
      tasks: ranked.slice(0, 30).map((t) => ({
        id: t.id, title: t.title, project: t.project_name, due: t.due_date, est_minutes: t.est_minutes, status: t.status,
      })),
    };
    raw = await callAI(
      env,
      user.id,
      `${BASE_SYSTEM}今日取り組むべきタスクを最大5件選び、JSONで返します。` +
        `形式: {"ids":[タスクid...],"reason":"選んだ理由をやさしく一文(50字以内)"}。` +
        `期限が近い・遅れているものを優先し、free_minutes_todayに収まる量にします。idはdata.tasksにあるものだけ。`,
      `<data>${JSON.stringify(data)}</data>`,
      250,
    );
    const out = RecOut.parse(extractJson(raw));
    const tasks = fromIds(ranked, { ids: [...new Set(out.ids)], reason: out.reason });
    if (tasks.length === 0) throw new Error('no valid ids');
    await setCache(env.DB, user.id, 'recommend', await recommendSig(date, ranked), {
      ids: tasks.map((t) => t.id),
      reason: out.reason,
    });
    return { tasks, reason: out.reason, source: 'ai' };
  } catch (e) {
    const limited = e instanceof AiUnavailable && e.reason === 'limit';
    if (!(e instanceof AiUnavailable)) logBadOutput('recommend', raw, e);
    return { ...cachedResult.rec, aiLimited: limited };
  }
}

// ---- 励ましコメント ----

const cheerBlock = (tz: string) => Math.floor(nowMinutesIn(tz) / 360); // 6 時間ごとに更新

export async function cheerSig(user: User, date: string, weekDone: number): Promise<string> {
  return shortHash(`${date}|${weekDone}|${cheerBlock(user.timezone)}`);
}

export function fallbackCheer(name: string, weekDone: number): string {
  return weekDone > 0
    ? `${name}さん、なんと今週はもう${weekDone}件のタスクを完了させています!`
    : `${name}さん、今日はひとつずつ、ゆっくり始めましょう。`;
}

export async function cachedCheer(env: Env, user: User, date: string, weekDone: number) {
  const c = (await getCache(env.DB, user.id, 'cheer', await cheerSig(user, date, weekDone))) as { text?: string } | null;
  return c?.text ? { text: c.text, source: 'ai' as const } : null;
}

export async function aiCheer(env: Env, user: User, date: string) {
  const week = weekRange(date);
  const weekDone = await weekDoneCount(env.DB, user.id, week.from, week.to);
  const hit = await cachedCheer(env, user, date, weekDone);
  if (hit) return { ...hit, aiLimited: false };
  const fallback = { text: fallbackCheer(user.display_name, weekDone), source: 'rule' as const, aiLimited: false };

  const open = await listOpenTasks(env.DB, user.id, 100);
  const data = {
    name: user.display_name,
    done_this_week: weekDone,
    done_today: await weekDoneCount(env.DB, user.id, date, date),
    open_tasks: open.length,
    overdue: open.filter((t) => t.due_date && t.due_date < date).length,
    hour: Math.floor(nowMinutesIn(user.timezone) / 60),
  };
  try {
    const raw = await callAI(
      env,
      user.id,
      `${BASE_SYSTEM}ユーザーを励ます一言を日本語で1文(60字以内)だけ書きます。やさしく温かい口調。` +
        `数字はdataの値だけを使い、責めたりプレッシャーをかけたりしません。名前は「さん」付け。`,
      `<data>${JSON.stringify(data)}</data>`,
      100,
    );
    const text = raw.trim().replace(/^["「『]|["」』]$/g, '').split('\n')[0].slice(0, 80);
    if (!text) return fallback;
    await setCache(env.DB, user.id, 'cheer', await cheerSig(user, date, weekDone), { text });
    return { text, source: 'ai' as const, aiLimited: false };
  } catch (e) {
    return { ...fallback, aiLimited: e instanceof AiUnavailable && e.reason === 'limit' };
  }
}
