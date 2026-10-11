import { Hono } from 'hono';
import { z } from 'zod';
import type { AppEnv } from '../types';
import { isValidTimezone } from '../util';

const app = new Hono<AppEnv>();

app.get('/', (c) => {
  const u = c.get('user');
  return c.json({ email: u.email, displayName: u.display_name, timezone: u.timezone });
});

const patch = z.object({
  displayName: z.string().trim().min(1).max(30).optional(),
  timezone: z.string().refine(isValidTimezone, 'invalid timezone').optional(),
});

app.patch('/', async (c) => {
  const u = c.get('user');
  const p = patch.safeParse(await c.req.json().catch(() => null));
  if (!p.success) return c.json({ error: 'invalid_body', issues: p.error.issues }, 400);
  const displayName = p.data.displayName ?? u.display_name;
  const timezone = p.data.timezone ?? u.timezone;
  await c.env.DB.prepare('UPDATE users SET display_name = ?, timezone = ? WHERE id = ?')
    .bind(displayName, timezone, u.id)
    .run();
  return c.json({ email: u.email, displayName, timezone });
});

export default app;
