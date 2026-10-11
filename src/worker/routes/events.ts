import { Hono } from 'hono';
import { z } from 'zod';
import { freeSlotsFor, fmtSlots } from '../planning';
import { insertEvent, listEvents } from '../services';
import type { AppEnv, EventRow } from '../types';
import { addDays, DATETIME_RE, isValidDate } from '../util';

const app = new Hono<AppEnv>();

const dt = z.string().regex(DATETIME_RE).refine((s) => isValidDate(s.slice(0, 10)), 'invalid date');
const eventBody = z
  .object({
    title: z.string().trim().min(1).max(200),
    start_at: dt,
    end_at: dt,
    task_id: z.number().int().nullish(),
  })
  .refine((e) => e.start_at.slice(0, 10) === e.end_at.slice(0, 10), { message: '日をまたぐ予定は未対応です' })
  .refine((e) => e.end_at > e.start_at, { message: 'end_at は start_at より後にしてください' });

app.get('/', async (c) => {
  const user = c.get('user');
  const from = c.req.query('from');
  const to = c.req.query('to') ?? from;
  if (!from || !to || !isValidDate(from) || !isValidDate(to) || to < from || to > addDays(from, 92)) {
    return c.json({ error: 'invalid_range' }, 400);
  }
  return c.json({ events: await listEvents(c.env.DB, user.id, from, to) });
});

// 空き時間(今日は現在時刻以降)。days 日分(最大 14)
app.get('/free-slots', async (c) => {
  const user = c.get('user');
  const date = c.req.query('date');
  const days = Math.min(Math.max(Number(c.req.query('days')) || 1, 1), 14);
  if (!date || !isValidDate(date)) return c.json({ error: 'invalid_date' }, 400);
  const out: { date: string; slots: string[] }[] = [];
  for (let i = 0; i < days; i++) {
    const d = addDays(date, i);
    out.push({ date: d, slots: fmtSlots(await freeSlotsFor(c.env, user, d)) });
  }
  return c.json({ days: out });
});

app.post('/', async (c) => {
  const p = eventBody.safeParse(await c.req.json().catch(() => null));
  if (!p.success) return c.json({ error: 'invalid_body', issues: p.error.issues }, 400);
  return c.json({ event: await insertEvent(c.env.DB, c.get('user').id, p.data) }, 201);
});

// 日付指定で提案(proposed)をまとめて承認
app.post('/approve', async (c) => {
  const user = c.get('user');
  const body = z.object({ date: z.string().refine(isValidDate) }).safeParse(await c.req.json().catch(() => null));
  if (!body.success) return c.json({ error: 'invalid_body' }, 400);
  const r = await c.env.DB.prepare(
    `UPDATE events SET status = 'confirmed' WHERE user_id = ? AND status = 'proposed' AND start_at >= ? AND start_at < ?`,
  )
    .bind(user.id, `${body.data.date}T00:00`, `${addDays(body.data.date, 1)}T00:00`)
    .run();
  return c.json({ approved: r.meta.changes ?? 0 });
});

app.post('/:id{[0-9]+}/approve', async (c) => {
  const r = await c.env.DB.prepare(`UPDATE events SET status = 'confirmed' WHERE id = ? AND user_id = ? AND status = 'proposed'`)
    .bind(Number(c.req.param('id')), c.get('user').id)
    .run();
  if (!r.meta.changes) return c.json({ error: 'not_found' }, 404);
  return c.json({ ok: true });
});

app.patch('/:id{[0-9]+}', async (c) => {
  const user = c.get('user');
  const id = Number(c.req.param('id'));
  const p = z
    .object({ title: z.string().trim().min(1).max(200).optional(), start_at: dt.optional(), end_at: dt.optional() })
    .safeParse(await c.req.json().catch(() => null));
  if (!p.success) return c.json({ error: 'invalid_body', issues: p.error.issues }, 400);
  const cur = await c.env.DB.prepare('SELECT * FROM events WHERE id = ? AND user_id = ?').bind(id, user.id).first<EventRow>();
  if (!cur) return c.json({ error: 'not_found' }, 404);
  const next = { title: p.data.title ?? cur.title, start_at: p.data.start_at ?? cur.start_at, end_at: p.data.end_at ?? cur.end_at };
  if (next.start_at.slice(0, 10) !== next.end_at.slice(0, 10) || next.end_at <= next.start_at) {
    return c.json({ error: 'invalid_range' }, 400);
  }
  await c.env.DB.prepare('UPDATE events SET title = ?, start_at = ?, end_at = ? WHERE id = ? AND user_id = ?')
    .bind(next.title, next.start_at, next.end_at, id, user.id)
    .run();
  return c.json({ event: { ...cur, ...next } });
});

app.delete('/:id{[0-9]+}', async (c) => {
  const r = await c.env.DB.prepare('DELETE FROM events WHERE id = ? AND user_id = ?')
    .bind(Number(c.req.param('id')), c.get('user').id)
    .run();
  if (!r.meta.changes) return c.json({ error: 'not_found' }, 404);
  return c.json({ ok: true });
});

export default app;
