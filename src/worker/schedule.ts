import type { EventRow, TaskRow } from './types';
import { toMin } from './util';

export interface Slot {
  start: number; // 0時からの分
  end: number;
}

const DEFAULT_EST = 60;
/** 予定と予定の間に空ける最低バッファ(分) */
export const BUFFER_MIN = 5;

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

/**
 * タスクの実行推奨度スコア(0〜100程度)。AI は使わず、ロジックのみで計算する。
 * - 緊急度(urgency) / 優先度(priority): 1〜5 を線形に加点
 * - 締切までの日数: 近い・過ぎているほど加点(上限あり)
 * - 進行中(doing)のタスクはわずかに加点(やりかけを優先)
 */
export function taskScore(t: TaskRow, today: string): number {
  const urgency = t.urgency ?? 3;
  const priority = t.priority ?? 3;
  const urgencyScore = urgency * 6; // 最大 30
  const priorityScore = priority * 5; // 最大 25

  let dueScore = 10; // 締切未設定は中立よりやや低め
  if (t.due_date) {
    const days = Math.round((Date.parse(t.due_date) - Date.parse(today)) / 86400000);
    if (days < 0) dueScore = 40; // 期限超過は最優先級
    else if (days === 0) dueScore = 35;
    else dueScore = Math.max(2, 30 - days * 3);
  }
  const doingBonus = t.status === 'doing' ? 5 : 0;

  return urgencyScore + priorityScore + dueScore + doingBonus;
}

/** 点数が高い順(同点は締切が近い順→作成が古い順)に並べる */
export function rankTasks(tasks: TaskRow[], today: string): TaskRow[] {
  return tasks
    .filter((t) => t.status !== 'done')
    .map((t) => ({ t, score: taskScore(t, today) }))
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      const da = a.t.due_date ?? '9999-12-31';
      const db = b.t.due_date ?? '9999-12-31';
      if (da !== db) return da < db ? -1 : 1;
      return a.t.created_at < b.t.created_at ? -1 : a.t.created_at > b.t.created_at ? 1 : a.t.id - b.t.id;
    })
    .map((x) => x.t);
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

/** ルールベースの予定案: 優先順に、収まる最初の空きへ詰める(タスク間に BUFFER_MIN 分の余白を空ける) */
export function fallbackPlan(ranked: TaskRow[], slots: Slot[], maxBlocks = 6, buffer = BUFFER_MIN): Block[] {
  const free = slots.map((s) => ({ ...s }));
  const out: Block[] = [];
  for (const t of ranked) {
    if (out.length >= maxBlocks) break;
    const dur = Math.min(Math.max(t.est_minutes ?? DEFAULT_EST, 15), 240);
    const slot = free.find((s) => s.end - s.start >= dur);
    if (!slot) continue;
    out.push({ task_id: t.id, start: slot.start, end: slot.start + dur });
    slot.start += dur + buffer;
  }
  return out;
}

/** AI が返したブロックを検証(空き内・タスク1回まで・前後 BUFFER_MIN 分以上あける)。不正なものは捨てる */
export function validateBlocks(
  raw: { task_id: number; start: string; end: string }[],
  taskIds: Set<number>,
  slots: Slot[],
  toMinutes: (s: string) => number | null,
  buffer = BUFFER_MIN,
): Block[] {
  const out: Block[] = [];
  const seen = new Set<number>();
  for (const b of raw) {
    const s = toMinutes(b.start);
    const e = toMinutes(b.end);
    if (s == null || e == null || e <= s) continue;
    if (!taskIds.has(b.task_id) || seen.has(b.task_id)) continue;
    if (!slots.some((sl) => s >= sl.start && e <= sl.end)) continue;
    if (out.some((o) => s < o.end + buffer && e + buffer > o.start)) continue;
    seen.add(b.task_id);
    out.push({ task_id: b.task_id, start: s, end: e });
  }
  return out.sort((a, b) => a.start - b.start);
}
