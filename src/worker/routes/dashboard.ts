import { Hono } from 'hono';
import { aiRemaining } from '../ai';
import { cheerText, recommendedTasks } from '../features';
import { listEvents, listOpenTasks, weekDoneCount } from '../services';
import type { AppEnv } from '../types';
import { isValidDate, todayIn, weekRange } from '../util';

const app = new Hono<AppEnv>();

/**
 * 1 画面ぶんの情報を 1 回で返す。
 * 実行推奨タスク・励ましコメントは AI を使わず、ロジックのみで毎回計算する。
 */
app.get('/', async (c) => {
  const user = c.get('user');
  const q = c.req.query('date');
  if (q && !isValidDate(q)) return c.json({ error: 'invalid_date' }, 400);
  const date = q ?? todayIn(user.timezone);
  const week = weekRange(date);

  const [open, events, weekDone, todayDone, remaining] = await Promise.all([
    listOpenTasks(c.env.DB, user.id, 100),
    listEvents(c.env.DB, user.id, date, date),
    weekDoneCount(c.env.DB, user.id, week.from, week.to),
    weekDoneCount(c.env.DB, user.id, date, date),
    aiRemaining(c.env, user.id),
  ]);
  const rec = await recommendedTasks(c.env, user, date, open);
  const overdue = open.filter((t) => t.due_date && t.due_date < date).length;

  return c.json({
    date,
    user: { displayName: user.display_name, timezone: user.timezone, workStart: user.work_start, workEnd: user.work_end },
    recommended: rec,
    events,
    weekDone,
    todayDone,
    openCount: open.length,
    cheer: { text: cheerText(user.display_name, weekDone, todayDone, overdue), source: 'rule' },
    aiRemaining: remaining,
  });
});

export default app;
