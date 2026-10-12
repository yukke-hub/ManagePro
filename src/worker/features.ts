import { freeSlotsFor } from './planning';
import { pickRecommended, rankTasks } from './schedule';
import type { Env, TaskRow, User } from './types';

export interface Recommendation {
  tasks: TaskRow[];
  reason: string | null;
  source: 'rule';
}

async function capacityMinutes(env: Env, user: User, date: string): Promise<number> {
  const slots = await freeSlotsFor(env, user, date);
  return slots.reduce((sum, s) => sum + (s.end - s.start), 0);
}

/**
 * 「今日の実行推奨タスク」。緊急度・優先度・締切から計算したスコア順に、空き時間へ収まる範囲で選ぶ。
 * AI は使わない(ロジックのみ)。
 */
export async function recommendedTasks(env: Env, user: User, date: string, open: TaskRow[]): Promise<Recommendation> {
  const ranked = rankTasks(open, date);
  const cap = await capacityMinutes(env, user, date);
  return { tasks: pickRecommended(ranked, cap), reason: null, source: 'rule' };
}

// ---- 励ましコメント(AI は使わず、固定のロジックのみ) ----

export function cheerText(name: string, weekDone: number, todayDone: number, overdue: number): string {
  if (overdue > 0) return `${name}さん、期限超過が${overdue}件あります。ひとつずつ片付けていきましょう。`;
  if (todayDone > 0) return `${name}さん、今日はもう${todayDone}件完了しています。この調子でいきましょう!`;
  if (weekDone > 0) return `${name}さん、なんと今週はもう${weekDone}件のタスクを完了させています!`;
  return `${name}さん、今日はひとつずつ、ゆっくり始めましょう。`;
}
