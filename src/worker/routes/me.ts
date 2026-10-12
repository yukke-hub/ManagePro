import { Hono } from 'hono';
import { z } from 'zod';
import type { AppEnv } from '../types';
import { isValidTimezone, TIME_RE } from '../util';

const app = new Hono<AppEnv>();

app.get('/', (c) => {
  const u = c.get('user');
  return c.json({
    email: u.email,
    displayName: u.display_name,
    timezone: u.timezone,
    workStart: u.work_start,
    workEnd: u.work_end,
  });
});

const timeField = z.string().regex(TIME_RE, 'invalid time');
const patch = z
  .object({
    displayName: z.string().trim().min(1).max(30).optional(),
    timezone: z.string().refine(isValidTimezone, 'invalid timezone').optional(),
    workStart: timeField.optional(),
    workEnd: timeField.optional(),
  })
  .refine((p) => !(p.workStart && p.workEnd) || p.workEnd > p.workStart, {
    message: '稼働終了は稼働開始より後にしてください',
  });

app.patch('/', async (c) => {
  const u = c.get('user');
  const p = patch.safeParse(await c.req.json().catch(() => null));
  if (!p.success) return c.json({ error: 'invalid_body', issues: p.error.issues }, 400);
  const displayName = p.data.displayName ?? u.display_name;
  const timezone = p.data.timezone ?? u.timezone;
  const workStart = p.data.workStart ?? u.work_start;
  const workEnd = p.data.workEnd ?? u.work_end;
  if (workEnd <= workStart) return c.json({ error: 'invalid_body' }, 400);
  await c.env.DB.prepare('UPDATE users SET display_name = ?, timezone = ?, work_start = ?, work_end = ? WHERE id = ?')
    .bind(displayName, timezone, workStart, workEnd, u.id)
    .run();
  return c.json({ email: u.email, displayName, timezone, workStart, workEnd });
});

export default app;
