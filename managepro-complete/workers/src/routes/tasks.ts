import { Hono } from 'hono';
import type { Env } from '../types';
import { authMiddleware } from '../middleware/auth';

const tasks = new Hono<{ Bindings: Env; Variables: { userId: string } }>();
tasks.use('*', authMiddleware);

// GET /api/tasks?project_id=xxx&block_id=xxx
tasks.get('/', async (c) => {
  const userId = c.get('userId');
  const projectId = c.req.query('project_id');
  const blockId = c.req.query('block_id');
  
  if (!projectId) return c.json({ error: 'project_id required' }, 400);
  
  let query = `
    SELECT t.*, 
           u.username as assignee_name, u.avatar_url as assignee_avatar,
           (SELECT COUNT(*) FROM tasks st WHERE st.parent_task_id = t.id) as subtask_count,
           (SELECT COUNT(*) FROM task_links tl WHERE tl.task_id = t.id) as link_count
    FROM tasks t
    LEFT JOIN users u ON u.id = t.assignee_id
    WHERE t.project_id = ?
  `;
  const params: any[] = [projectId];
  
  if (blockId) {
    query += ' AND t.block_id = ?';
    params.push(blockId);
  }
  
  query += ' AND t.parent_task_id IS NULL ORDER BY t.position, CASE WHEN t.due_date IS NULL THEN 1 ELSE 0 END, t.due_date ASC';
  
  const result = await c.env.DB.prepare(query).bind(...params).all();
  return c.json(result.results);
});

// GET /api/tasks/:id
tasks.get('/:id', async (c) => {
  const taskId = c.req.param('id');
  
  const task = await c.env.DB.prepare(`
    SELECT t.*, u.username as assignee_name, u.avatar_url as assignee_avatar
    FROM tasks t
    LEFT JOIN users u ON u.id = t.assignee_id
    WHERE t.id = ?
  `).bind(taskId).first();
  
  if (!task) return c.json({ error: 'Not found' }, 404);
  
  // Get subtasks
  const subtasks = await c.env.DB.prepare(`
    SELECT t.*, u.username as assignee_name
    FROM tasks t
    LEFT JOIN users u ON u.id = t.assignee_id
    WHERE t.parent_task_id = ?
    ORDER BY t.position
  `).bind(taskId).all();
  
  // Get links
  const links = await c.env.DB.prepare(
    'SELECT * FROM task_links WHERE task_id = ?'
  ).bind(taskId).all();
  
  return c.json({ ...task, subtasks: subtasks.results, links: links.results });
});

// POST /api/tasks
tasks.post('/', async (c) => {
  const userId = c.get('userId');
  const body = await c.req.json();
  const {
    project_id, block_id, parent_task_id,
    title, description, status, priority,
    due_date, assignee_id, position, protocol
  } = body;
  
  if (!project_id || !title) return c.json({ error: 'project_id and title required' }, 400);
  
  const id = crypto.randomUUID();
  await c.env.DB.prepare(`
    INSERT INTO tasks (id, project_id, block_id, parent_task_id, title, description, status, priority, due_date, assignee_id, created_by, position, protocol)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    id, project_id, block_id || null, parent_task_id || null,
    title, description || '', status || 'todo', priority || 'medium',
    due_date || null, assignee_id || null, userId, position || 0, protocol || ''
  ).run();
  
  // Sync to assignee's calendar if there's a due date and assignee
  if (due_date && assignee_id) {
    const project = await c.env.DB.prepare('SELECT name FROM projects WHERE id = ?').bind(project_id).first() as any;
    await c.env.DB.prepare(`
      INSERT INTO calendar_events (id, user_id, project_id, source_type, source_id, title, start_at, end_at, all_day, color)
      VALUES (?, ?, ?, 'task', ?, ?, ?, ?, 1, '#9664F7')
    `).bind(
      crypto.randomUUID(), assignee_id, project_id, id,
      `[タスク] ${title}`, due_date, due_date
    ).run();
  }
  
  const task = await c.env.DB.prepare(`
    SELECT t.*, u.username as assignee_name
    FROM tasks t LEFT JOIN users u ON u.id = t.assignee_id
    WHERE t.id = ?
  `).bind(id).first();
  
  return c.json(task, 201);
});

// PUT /api/tasks/:id
tasks.put('/:id', async (c) => {
  const userId = c.get('userId');
  const taskId = c.req.param('id');
  const body = await c.req.json();
  const { title, description, status, priority, due_date, assignee_id, position, protocol } = body;
  
  const existing = await c.env.DB.prepare('SELECT * FROM tasks WHERE id = ?').bind(taskId).first() as any;
  if (!existing) return c.json({ error: 'Not found' }, 404);
  
  await c.env.DB.prepare(`
    UPDATE tasks SET title = ?, description = ?, status = ?, priority = ?, due_date = ?,
                    assignee_id = ?, position = ?, protocol = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).bind(title, description, status, priority, due_date, assignee_id, position, protocol, taskId).run();
  
  // Update calendar event if assignee or due_date changed
  if (existing.assignee_id !== assignee_id || existing.due_date !== due_date) {
    // Remove old calendar entry
    await c.env.DB.prepare(
      "DELETE FROM calendar_events WHERE source_type = 'task' AND source_id = ?"
    ).bind(taskId).run();
    
    // Add new one if applicable
    if (due_date && assignee_id) {
      await c.env.DB.prepare(`
        INSERT INTO calendar_events (id, user_id, project_id, source_type, source_id, title, start_at, end_at, all_day, color)
        VALUES (?, ?, ?, 'task', ?, ?, ?, ?, 1, '#9664F7')
      `).bind(
        crypto.randomUUID(), assignee_id, existing.project_id, taskId,
        `[タスク] ${title}`, due_date, due_date
      ).run();
    }
  }
  
  return c.json({ success: true });
});

// DELETE /api/tasks/:id
tasks.delete('/:id', async (c) => {
  const taskId = c.req.param('id');
  
  await c.env.DB.prepare("DELETE FROM calendar_events WHERE source_type = 'task' AND source_id = ?").bind(taskId).run();
  await c.env.DB.prepare('DELETE FROM tasks WHERE id = ?').bind(taskId).run();
  
  return c.json({ success: true });
});

// PATCH /api/tasks/:id/status - quick status update (for kanban drag)
tasks.patch('/:id/status', async (c) => {
  const taskId = c.req.param('id');
  const { status, position } = await c.req.json();
  
  await c.env.DB.prepare(
    'UPDATE tasks SET status = ?, position = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
  ).bind(status, position ?? 0, taskId).run();
  
  return c.json({ success: true });
});

// POST /api/tasks/:id/links
tasks.post('/:id/links', async (c) => {
  const taskId = c.req.param('id');
  const { title, url } = await c.req.json();
  
  const id = crypto.randomUUID();
  await c.env.DB.prepare(
    'INSERT INTO task_links (id, task_id, title, url) VALUES (?, ?, ?, ?)'
  ).bind(id, taskId, title, url).run();
  
  return c.json({ id, task_id: taskId, title, url }, 201);
});

// DELETE /api/tasks/:id/links/:linkId
tasks.delete('/:id/links/:linkId', async (c) => {
  const linkId = c.req.param('linkId');
  await c.env.DB.prepare('DELETE FROM task_links WHERE id = ?').bind(linkId).run();
  return c.json({ success: true });
});

export default tasks;
