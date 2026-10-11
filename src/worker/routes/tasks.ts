import { Hono } from 'hono';
import { z } from 'zod';
import { getOrCreateProjectId, getTask, insertTask, setTaskStatus } from '../services';
import type { AppEnv, TaskRow } from '../types';
import { isValidDate } from '../util';

const app = new Hono<AppEnv>();

const dateSchema = z.string().refine(isValidDate, 'invalid date');
const createSchema = z.object({
  title: z.string().trim().min(1).max(200),
  project: z.string().trim().max(60).nullish(),
  due_date: dateSchema.nullish(),
  est_minutes: z.number().int().min(5).max(1440).nullish(),
  done_criteria: z.string().max(500).nullish(),
  notes: z.string().max(2000).nullish(),
});
const patchSchema = createSchema.partial().extend({ status: z.enum(['todo', 'doing', 'done']).optional() });

app.get('/', async (c) => {
  const user = c.get('user');
  const status = c.req.query('status') ?? 'open';
  const limit = Math.min(Number(c.req.query('limit')) || 100, 200);
  let where = 't.user_id = ?';
  let order = '(t.due_date IS NULL), t.due_date, t.created_at';
  if (status === 'open') where += " AND t.status != 'done'";
  else if (status === 'done') {
    where += " AND t.status = 'done'";
    order = 't.completed_on DESC, t.id DESC';
  } else if (status !== 'all') return c.json({ error: 'invalid_status' }, 400);
  const r = await c.env.DB.prepare(
    `SELECT t.*, p.name AS project_name FROM tasks t LEFT JOIN projects p ON p.id = t.project_id
     WHERE ${where} ORDER BY ${order} LIMIT ?`,
  )
    .bind(user.id, limit)
    .all<TaskRow>();
  return c.json({ tasks: r.results });
});

app.post('/', async (c) => {
  const p = createSchema.safeParse(await c.req.json().catch(() => null));
  if (!p.success) return c.json({ error: 'invalid_body', issues: p.error.issues }, 400);
  return c.json({ task: await insertTask(c.env.DB, c.get('user'), p.data) }, 201);
});

app.patch('/:id{[0-9]+}', async (c) => {
  const user = c.get('user');
  const id = Number(c.req.param('id'));
  const p = patchSchema.safeParse(await c.req.json().catch(() => null));
  if (!p.success) return c.json({ error: 'invalid_body', issues: p.error.issues }, 400);
  if (!(await getTask(c.env.DB, user.id, id))) return c.json({ error: 'not_found' }, 404);

  const d = p.data;
  const sets: string[] = [];
  const vals: unknown[] = [];
  const put = (col: string, v: unknown) => {
    sets.push(`${col} = ?`);
    vals.push(v ?? null);
  };
  if ('title' in d) put('title', d.title);
  if ('due_date' in d) put('due_date', d.due_date);
  if ('est_minutes' in d) put('est_minutes', d.est_minutes);
  if ('done_criteria' in d) put('done_criteria', d.done_criteria);
  if ('notes' in d) put('notes', d.notes);
  if ('project' in d) put('project_id', await getOrCreateProjectId(c.env.DB, user.id, d.project));
  if (sets.length > 0) {
    await c.env.DB.prepare(`UPDATE tasks SET ${sets.join(', ')}, updated_at = datetime('now') WHERE id = ? AND user_id = ?`)
      .bind(...vals, id, user.id)
      .run();
  }
  if (d.status) await setTaskStatus(c.env.DB, user, id, d.status);
  return c.json({ task: await getTask(c.env.DB, user.id, id) });
});

app.delete('/:id{[0-9]+}', async (c) => {
  const user = c.get('user');
  const r = await c.env.DB.prepare('DELETE FROM tasks WHERE id = ? AND user_id = ?')
    .bind(Number(c.req.param('id')), user.id)
    .run();
  if (!r.meta.changes) return c.json({ error: 'not_found' }, 404);
  return c.json({ ok: true });
});

app.get('/projects', async (c) => {
  const r = await c.env.DB.prepare('SELECT id, name FROM projects WHERE user_id = ? ORDER BY name')
    .bind(c.get('user').id)
    .all();
  return c.json({ projects: r.results });
});

export default app;
