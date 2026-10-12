import type { D1Database } from '@cloudflare/workers-types';
import type { EventRow, TaskRow, TaskStatus, User } from './types';
import { addDays, todayIn } from './util';

const TASK_SELECT = `SELECT t.*, p.name AS project_name FROM tasks t LEFT JOIN projects p ON p.id = t.project_id`;

export async function getOrCreateProjectId(
  db: D1Database,
  userId: number,
  name?: string | null,
): Promise<number | null> {
  const n = name?.trim();
  if (!n) return null;
  await db
    .prepare('INSERT INTO projects (user_id, name) VALUES (?, ?) ON CONFLICT(user_id, name) DO NOTHING')
    .bind(userId, n)
    .run();
  const r = await db
    .prepare('SELECT id FROM projects WHERE user_id = ? AND name = ?')
    .bind(userId, n)
    .first<{ id: number }>();
  return r?.id ?? null;
}

export interface NewTask {
  title: string;
  project?: string | null;
  due_date?: string | null;
  est_minutes?: number | null;
  done_criteria?: string | null;
  notes?: string | null;
  urgency?: number | null;
  priority?: number | null;
}

export async function getTask(db: D1Database, userId: number, id: number): Promise<TaskRow | null> {
  return db.prepare(`${TASK_SELECT} WHERE t.id = ? AND t.user_id = ?`).bind(id, userId).first<TaskRow>();
}

export async function insertTask(db: D1Database, user: User, t: NewTask): Promise<TaskRow> {
  const projectId = await getOrCreateProjectId(db, user.id, t.project);
  const res = await db
    .prepare(
      `INSERT INTO tasks (user_id, project_id, title, done_criteria, notes, due_date, est_minutes, urgency, priority)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      user.id,
      projectId,
      t.title,
      t.done_criteria ?? null,
      t.notes ?? null,
      t.due_date ?? null,
      t.est_minutes ?? null,
      t.urgency ?? 3,
      t.priority ?? 3,
    )
    .run();
  return (await getTask(db, user.id, res.meta.last_row_id as number))!;
}

export async function setTaskStatus(
  db: D1Database,
  user: User,
  id: number,
  status: TaskStatus,
): Promise<TaskRow | null> {
  const completedOn = status === 'done' ? todayIn(user.timezone) : null;
  await db
    .prepare(`UPDATE tasks SET status = ?, completed_on = ?, updated_at = datetime('now') WHERE id = ? AND user_id = ?`)
    .bind(status, completedOn, id, user.id)
    .run();
  return getTask(db, user.id, id);
}

export async function listOpenTasks(db: D1Database, userId: number, limit = 100): Promise<TaskRow[]> {
  const r = await db
    .prepare(
      `${TASK_SELECT} WHERE t.user_id = ? AND t.status != 'done'
       ORDER BY (t.due_date IS NULL), t.due_date, t.created_at LIMIT ?`,
    )
    .bind(userId, limit)
    .all<TaskRow>();
  return r.results;
}

export async function weekDoneCount(db: D1Database, userId: number, from: string, to: string): Promise<number> {
  const r = await db
    .prepare(`SELECT COUNT(*) AS n FROM tasks WHERE user_id = ? AND status = 'done' AND completed_on BETWEEN ? AND ?`)
    .bind(userId, from, to)
    .first<{ n: number }>();
  return r?.n ?? 0;
}

export async function insertEvent(
  db: D1Database,
  userId: number,
  e: { title: string; start_at: string; end_at: string; task_id?: number | null; status?: 'confirmed' | 'proposed'; source?: 'user' | 'ai' },
): Promise<EventRow> {
  if (e.task_id != null) {
    const own = await db.prepare('SELECT id FROM tasks WHERE id = ? AND user_id = ?').bind(e.task_id, userId).first();
    if (!own) throw new HttpError(400, 'task_not_found');
  }
  const res = await db
    .prepare(`INSERT INTO events (user_id, task_id, title, start_at, end_at, status, source) VALUES (?, ?, ?, ?, ?, ?, ?)`)
    .bind(userId, e.task_id ?? null, e.title, e.start_at, e.end_at, e.status ?? 'confirmed', e.source ?? 'user')
    .run();
  return (await db.prepare('SELECT * FROM events WHERE id = ?').bind(res.meta.last_row_id).first<EventRow>())!;
}

/** from/to は日付(両端含む)。start_at の日付で判定する */
export async function listEvents(
  db: D1Database,
  userId: number,
  from: string,
  to: string,
  status?: 'confirmed' | 'proposed',
): Promise<EventRow[]> {
  const r = await db
    .prepare(
      `SELECT * FROM events WHERE user_id = ? AND start_at >= ? AND start_at < ?
       ${status ? 'AND status = ?' : ''} ORDER BY start_at`,
    )
    .bind(userId, `${from}T00:00`, `${addDays(to, 1)}T00:00`, ...(status ? [status] : []))
    .all<EventRow>();
  return r.results;
}

export class HttpError extends Error {
  constructor(public status: 400 | 403 | 404 | 409, message: string) {
    super(message);
  }
}
