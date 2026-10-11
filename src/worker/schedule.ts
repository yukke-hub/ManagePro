import type { EventRow, TaskRow } from './types';
import { toMin } from './util';

export interface Slot {
  start: number; // 0時からの分
  end: number;
}

const DEFAULT_EST = 60;

/** その日の予定(同日内のみ許可)を分に変換 */
export function busyOf(events: EventRow[]): Slot[] {
  return events.map((e) => ({ start: toMin(e.start_at.slice(11)), end: toMin(e.end_at.slice(11)) }));
}

/** 勤務(活動)時間内で、予定のない 15 分以上の空きを返す */
export function computeFreeSlots(busy: Slot[], workStart: number, workEnd: number, notBefore = 0, minLen = 15): Slot[] {
  const from = Math.max(workStart, notBefore);
  const sorted = [...busy].sort((a, b) => a.start - b.start);
  const slots: Slot[] = [];
  let cursor = from;
  for (const b of sorted) {
    if (b.start > cursor) slots.push({ start: cursor, end: Math.min(b.start, workEnd) });
    cursor = Math.max(cursor, b.end);
  }
  if (cursor < workEnd) slots.push({ start: cursor, end: workEnd });
  return slots.filter((s) => s.end - s.start >= minLen);
}

/** 期限が近い順 → 進行中を優先 → 作成が古い順 */
export function rankTasks(tasks: TaskRow[]): TaskRow[] {
  return tasks
    .filter((t) => t.status !== 'done')
    .sort((a, b) => {
      const da = a.due_date ?? '9999-12-31';
      const db = b.due_date ?? '9999-12-31';
      if (da !== db) return da < db ? -1 : 1;
      if (a.status !== b.status) return a.status === 'doing' ? -1 : 1;
      return a.created_at < b.created_at ? -1 : a.created_at > b.created_at ? 1 : a.id - b.id;
    });
}

/** ルールベースの「今日やるべきタスク」。空き時間に収まる範囲で最大 max 件(最低 1 件) */
export function pickRecommended(ranked: TaskRow[], capacityMin: number, max = 5): TaskRow[] {
  const out: TaskRow[] = [];
  let used = 0;
  for (const t of ranked) {
    const est = t.est_minutes ?? DEFAULT_EST;
    if (out.length > 0 && used + est > capacityMin) continue;
    out.push(t);
    used += est;
    if (out.length >= max) break;
  }
  return out;
}

export interface Block {
  task_id: number;
  start: number;
  end: number;
}

/** ルールベースの予定案: 優先順に、収まる最初の空きへ詰める */
export function fallbackPlan(ranked: TaskRow[], slots: Slot[], maxBlocks = 6): Block[] {
  const free = slots.map((s) => ({ ...s }));
  const out: Block[] = [];
  for (const t of ranked) {
    if (out.length >= maxBlocks) break;
    const dur = Math.min(Math.max(t.est_minutes ?? DEFAULT_EST, 15), 240);
    const slot = free.find((s) => s.end - s.start >= dur);
    if (!slot) continue;
    out.push({ task_id: t.id, start: slot.start, end: slot.start + dur });
    slot.start += dur;
  }
  return out;
}

/** AI が返したブロックを検証(空き内・重複なし・タスク1回まで)。不正なものは捨てる */
export function validateBlocks(
  raw: { task_id: number; start: string; end: string }[],
  taskIds: Set<number>,
  slots: Slot[],
  toMinutes: (s: string) => number | null,
): Block[] {
  const out: Block[] = [];
  const seen = new Set<number>();
  for (const b of raw) {
    const s = toMinutes(b.start);
    const e = toMinutes(b.end);
    if (s == null || e == null || e <= s) continue;
    if (!taskIds.has(b.task_id) || seen.has(b.task_id)) continue;
    if (!slots.some((sl) => s >= sl.start && e <= sl.end)) continue;
    if (out.some((o) => s < o.end && e > o.start)) continue;
    seen.add(b.task_id);
    out.push({ task_id: b.task_id, start: s, end: e });
  }
  return out.sort((a, b) => a.start - b.start);
}
