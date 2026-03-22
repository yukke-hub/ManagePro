import { Hono } from 'hono';
import type { Env } from '../types';
import { authMiddleware } from '../middleware/auth';

const users = new Hono<{ Bindings: Env; Variables: { userId: string } }>();
users.use('*', authMiddleware);

// GET /api/users/profile
users.get('/profile', async (c) => {
  const userId = c.get('userId');
  
  const user = await c.env.DB.prepare(`
    SELECT u.id, u.email, u.username, u.job_type, u.avatar_url, u.subscription_status, u.trial_ends_at,
           us.status_emoji, us.status_text, us.note_text
    FROM users u
    LEFT JOIN user_status us ON us.user_id = u.id
    WHERE u.id = ?
  `).bind(userId).first();
  
  if (!user) return c.json({ error: 'User not found' }, 404);
  
  return c.json(user);
});

// PUT /api/users/profile
users.put('/profile', async (c) => {
  const userId = c.get('userId');
  const { username, job_type, avatar_url } = await c.req.json();
  
  await c.env.DB.prepare(`
    UPDATE users SET username = ?, job_type = ?, avatar_url = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).bind(username, job_type, avatar_url, userId).run();
  
  return c.json({ success: true });
});

// PUT /api/users/status
users.put('/status', async (c) => {
  const userId = c.get('userId');
  const { status_emoji, status_text, note_text } = await c.req.json();
  
  await c.env.DB.prepare(`
    INSERT INTO user_status (user_id, status_emoji, status_text, note_text)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(user_id) DO UPDATE SET
      status_emoji = excluded.status_emoji,
      status_text = excluded.status_text,
      note_text = excluded.note_text,
      updated_at = CURRENT_TIMESTAMP
  `).bind(userId, status_emoji || '🟢', status_text || '', note_text || '').run();
  
  return c.json({ success: true });
});

// GET /api/users/organizations
users.get('/organizations', async (c) => {
  const userId = c.get('userId');
  
  const orgs = await c.env.DB.prepare(`
    SELECT o.*, om.role
    FROM organizations o
    JOIN org_members om ON om.org_id = o.id
    WHERE om.user_id = ?
    ORDER BY o.name
  `).bind(userId).all();
  
  return c.json(orgs.results);
});

// GET /api/users/calendar
users.get('/calendar', async (c) => {
  const userId = c.get('userId');
  const start = c.req.query('start');
  const end = c.req.query('end');
  
  // Get calendar events (custom + task-based + meeting-based)
  const events = await c.env.DB.prepare(`
    SELECT * FROM calendar_events
    WHERE user_id = ? AND start_at >= ? AND start_at <= ?
    ORDER BY start_at
  `).bind(userId, start || '2000-01-01', end || '2100-01-01').all();
  
  return c.json(events.results);
});

// POST /api/users/calendar
users.post('/calendar', async (c) => {
  const userId = c.get('userId');
  const { title, description, start_at, end_at, all_day, color } = await c.req.json();
  
  const id = crypto.randomUUID();
  await c.env.DB.prepare(`
    INSERT INTO calendar_events (id, user_id, source_type, title, description, start_at, end_at, all_day, color)
    VALUES (?, ?, 'custom', ?, ?, ?, ?, ?, ?)
  `).bind(id, userId, title, description || '', start_at, end_at, all_day ? 1 : 0, color || '#9664F7').run();
  
  const event = await c.env.DB.prepare('SELECT * FROM calendar_events WHERE id = ?').bind(id).first();
  return c.json(event, 201);
});

// DELETE /api/users/calendar/:id
users.delete('/calendar/:id', async (c) => {
  const userId = c.get('userId');
  const eventId = c.req.param('id');
  
  await c.env.DB.prepare(`
    DELETE FROM calendar_events WHERE id = ? AND user_id = ? AND source_type = 'custom'
  `).bind(eventId, userId).run();
  
  return c.json({ success: true });
});

// GET /api/users/tasks (all tasks assigned to me, across all projects)
users.get('/tasks', async (c) => {
  const userId = c.get('userId');
  
  const tasks = await c.env.DB.prepare(`
    SELECT t.*, p.name as project_name, p.color as project_color
    FROM tasks t
    JOIN projects p ON p.id = t.project_id
    WHERE t.assignee_id = ? AND t.parent_task_id IS NULL
    ORDER BY CASE WHEN t.due_date IS NULL THEN 1 ELSE 0 END, t.due_date ASC
  `).bind(userId).all();
  
  return c.json(tasks.results);
});

export default users;
