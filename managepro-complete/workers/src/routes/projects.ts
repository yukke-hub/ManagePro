import { Hono } from 'hono';
import type { Env } from '../types';
import { authMiddleware } from '../middleware/auth';

const projects = new Hono<{ Bindings: Env; Variables: { userId: string } }>();
projects.use('*', authMiddleware);

async function checkProjectAccess(db: any, projectId: string, userId: string) {
  const member = await db.prepare(
    'SELECT pm.role FROM project_members pm WHERE pm.project_id = ? AND pm.user_id = ?'
  ).bind(projectId, userId).first();
  return member;
}

// GET /api/projects?org_id=xxx
projects.get('/', async (c) => {
  const userId = c.get('userId');
  const orgId = c.req.query('org_id');
  
  let query = `
    SELECT p.*, pm.role,
      (SELECT COUNT(*) FROM project_members WHERE project_id = p.id) as member_count,
      (SELECT COUNT(*) FROM tasks WHERE project_id = p.id AND status != 'done') as open_tasks,
      (SELECT scheduled_at FROM meetings WHERE project_id = p.id AND scheduled_at > CURRENT_TIMESTAMP ORDER BY scheduled_at LIMIT 1) as next_meeting,
      (SELECT title FROM tasks WHERE project_id = p.id AND assignee_id = ? AND status != 'done' AND due_date IS NOT NULL ORDER BY due_date LIMIT 1) as nearest_task
    FROM projects p
    JOIN project_members pm ON pm.project_id = p.id
    WHERE pm.user_id = ?
  `;
  
  const params: any[] = [userId, userId];
  if (orgId) {
    query += ' AND p.org_id = ?';
    params.push(orgId);
  }
  query += ' ORDER BY p.updated_at DESC';
  
  const result = await c.env.DB.prepare(query).bind(...params).all();
  return c.json(result.results);
});

// POST /api/projects
projects.post('/', async (c) => {
  const userId = c.get('userId');
  const { org_id, name, description, color, member_ids } = await c.req.json();
  
  if (!org_id || !name) return c.json({ error: 'org_id and name are required' }, 400);
  
  const orgMember = await c.env.DB.prepare(
    'SELECT * FROM org_members WHERE org_id = ? AND user_id = ?'
  ).bind(org_id, userId).first();
  if (!orgMember) return c.json({ error: 'Access denied' }, 403);
  
  const id = crypto.randomUUID();
  await c.env.DB.prepare(`
    INSERT INTO projects (id, org_id, name, description, color, created_by)
    VALUES (?, ?, ?, ?, ?, ?)
  `).bind(id, org_id, name, description || '', color || '#9664F7', userId).run();
  
  // Add creator as owner
  await c.env.DB.prepare(`
    INSERT INTO project_members (id, project_id, user_id, role) VALUES (?, ?, ?, 'owner')
  `).bind(crypto.randomUUID(), id, userId).run();
  
  // Add other members
  if (member_ids && Array.isArray(member_ids)) {
    for (const memberId of member_ids) {
      if (memberId !== userId) {
        await c.env.DB.prepare(`
          INSERT OR IGNORE INTO project_members (id, project_id, user_id, role) VALUES (?, ?, ?, 'member')
        `).bind(crypto.randomUUID(), id, memberId).run();
      }
    }
  }
  
  const project = await c.env.DB.prepare('SELECT * FROM projects WHERE id = ?').bind(id).first();
  return c.json(project, 201);
});

// GET /api/projects/:id
projects.get('/:id', async (c) => {
  const userId = c.get('userId');
  const projectId = c.req.param('id');
  
  const access = await checkProjectAccess(c.env.DB, projectId, userId);
  if (!access) return c.json({ error: 'Access denied' }, 403);
  
  const project = await c.env.DB.prepare('SELECT * FROM projects WHERE id = ?').bind(projectId).first();
  if (!project) return c.json({ error: 'Not found' }, 404);
  
  // Get members
  const members = await c.env.DB.prepare(`
    SELECT u.id, u.username, u.avatar_url, u.job_type, pm.role,
           us.status_emoji, us.status_text
    FROM project_members pm
    JOIN users u ON u.id = pm.user_id
    LEFT JOIN user_status us ON us.user_id = u.id
    WHERE pm.project_id = ?
  `).bind(projectId).all();
  
  // Get blocks (page structure)
  const blocks = await c.env.DB.prepare(`
    SELECT * FROM project_blocks WHERE project_id = ? ORDER BY position
  `).bind(projectId).all();
  
  return c.json({ ...project, members: members.results, blocks: blocks.results });
});

// PUT /api/projects/:id
projects.put('/:id', async (c) => {
  const userId = c.get('userId');
  const projectId = c.req.param('id');
  const { name, description, color, status } = await c.req.json();
  
  const access = await checkProjectAccess(c.env.DB, projectId, userId);
  if (!access || access.role === 'member') return c.json({ error: 'Access denied' }, 403);
  
  await c.env.DB.prepare(`
    UPDATE projects SET name = ?, description = ?, color = ?, status = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).bind(name, description, color, status, projectId).run();
  
  return c.json({ success: true });
});

// GET /api/projects/:id/members
projects.get('/:id/members', async (c) => {
  const userId = c.get('userId');
  const projectId = c.req.param('id');
  
  const access = await checkProjectAccess(c.env.DB, projectId, userId);
  if (!access) return c.json({ error: 'Access denied' }, 403);
  
  const members = await c.env.DB.prepare(`
    SELECT u.id, u.username, u.email, u.avatar_url, u.job_type, pm.role,
           us.status_emoji, us.status_text
    FROM project_members pm
    JOIN users u ON u.id = pm.user_id
    LEFT JOIN user_status us ON us.user_id = u.id
    WHERE pm.project_id = ?
    ORDER BY pm.role DESC, u.username
  `).bind(projectId).all();
  
  return c.json(members.results);
});

// POST /api/projects/:id/members
projects.post('/:id/members', async (c) => {
  const userId = c.get('userId');
  const projectId = c.req.param('id');
  const { user_id, role } = await c.req.json();
  
  const access = await checkProjectAccess(c.env.DB, projectId, userId);
  if (!access || access.role === 'member') return c.json({ error: 'Access denied' }, 403);
  
  await c.env.DB.prepare(`
    INSERT OR IGNORE INTO project_members (id, project_id, user_id, role) VALUES (?, ?, ?, ?)
  `).bind(crypto.randomUUID(), projectId, user_id, role || 'member').run();
  
  return c.json({ success: true });
});

// =====================
// PROJECT BLOCKS (Notion-like widgets)
// =====================

// POST /api/projects/:id/blocks
projects.post('/:id/blocks', async (c) => {
  const userId = c.get('userId');
  const projectId = c.req.param('id');
  const { block_type, title, position, config } = await c.req.json();
  
  const access = await checkProjectAccess(c.env.DB, projectId, userId);
  if (!access) return c.json({ error: 'Access denied' }, 403);
  
  const blockId = crypto.randomUUID();
  await c.env.DB.prepare(`
    INSERT INTO project_blocks (id, project_id, block_type, title, position, config)
    VALUES (?, ?, ?, ?, ?, ?)
  `).bind(blockId, projectId, block_type, title || block_type, position || 0, JSON.stringify(config || {})).run();
  
  // Auto-create associated data if needed
  if (block_type === 'budget_tool') {
    await c.env.DB.prepare(`
      INSERT INTO budgets (id, project_id, block_id) VALUES (?, ?, ?)
    `).bind(crypto.randomUUID(), projectId, blockId).run();
  } else if (block_type === 'whiteboard') {
    await c.env.DB.prepare(`
      INSERT INTO whiteboards (id, project_id, block_id) VALUES (?, ?, ?)
    `).bind(crypto.randomUUID(), projectId, blockId).run();
  }
  
  const block = await c.env.DB.prepare('SELECT * FROM project_blocks WHERE id = ?').bind(blockId).first();
  return c.json(block, 201);
});

// PUT /api/projects/:id/blocks/:blockId
projects.put('/:id/blocks/:blockId', async (c) => {
  const userId = c.get('userId');
  const projectId = c.req.param('id');
  const blockId = c.req.param('blockId');
  const { title, position, config, is_visible } = await c.req.json();
  
  const access = await checkProjectAccess(c.env.DB, projectId, userId);
  if (!access) return c.json({ error: 'Access denied' }, 403);
  
  await c.env.DB.prepare(`
    UPDATE project_blocks SET title = ?, position = ?, config = ?, is_visible = ?
    WHERE id = ? AND project_id = ?
  `).bind(title, position, JSON.stringify(config || {}), is_visible !== undefined ? is_visible : 1, blockId, projectId).run();
  
  return c.json({ success: true });
});

// DELETE /api/projects/:id/blocks/:blockId
projects.delete('/:id/blocks/:blockId', async (c) => {
  const userId = c.get('userId');
  const projectId = c.req.param('id');
  const blockId = c.req.param('blockId');
  
  const access = await checkProjectAccess(c.env.DB, projectId, userId);
  if (!access || access.role === 'member') return c.json({ error: 'Access denied' }, 403);
  
  await c.env.DB.prepare(
    'DELETE FROM project_blocks WHERE id = ? AND project_id = ?'
  ).bind(blockId, projectId).run();
  
  return c.json({ success: true });
});

export default projects;
