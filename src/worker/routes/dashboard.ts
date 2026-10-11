import { Hono } from 'hono';
import { aiRemaining } from '../ai';
import { cachedCheer, cachedRecommendation, fallbackCheer } from '../features';
import { rankTasks } from '../schedule';
import { listEvents, listOpenTasks, weekDoneCount } from '../services';
import type { AppEnv } from '../types';
import { isValidDate, todayIn, weekRange } from '../util';

const app = new Hono<AppEnv>();

/**
 * 1 画面ぶんの情報を 1 回で返す。ここでは AI を呼ばない(キャッシュ参照のみ)。
 * stale.* が true のとき、画面側が POST /api/ai/* を 1 回だけ呼んで更新する。
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
  const ranked = rankTasks(open);
  const { rec, stale } = await cachedRecommendation(c.env, user, date, ranked);
  const cheer = await cachedCheer(c.env, user, date, weekDone);

  return c.json({
    date,
    user: { displayName: user.display_name, timezone: user.timezone },
    recommended: { tasks: rec.tasks, reason: rec.reason, source: rec.source },
    events,
    weekDone,
    todayDone,
    openCount: open.length,
    cheer: cheer ?? { text: fallbackCheer(user.display_name, weekDone), source: 'rule' },
    stale: { recommend: stale && remaining > 0, cheer: !cheer && remaining > 0 },
    aiRemaining: remaining,
  });
});

export default app;
