import { Hono } from 'hono';
import type { Env } from '../types';
import { authMiddleware } from '../middleware/auth';

const organizations = new Hono<{ Bindings: Env; Variables: { userId: string } }>();
organizations.use('*', authMiddleware);

// GET /api/organizations
organizations.get('/', async (c) => {
  const userId = c.get('userId');
  const orgs = await c.env.DB.prepare(`
    SELECT o.*, om.role,
           (SELECT COUNT(*) FROM org_members WHERE org_id = o.id) as member_count
    FROM organizations o
    JOIN org_members om ON om.org_id = o.id
    WHERE om.user_id = ?
    ORDER BY o.name
  `).bind(userId).all();
  return c.json(orgs.results);
});

// POST /api/organizations
organizations.post('/', async (c) => {
  const userId = c.get('userId');
  const { name, description } = await c.req.json();
  if (!name) return c.json({ error: 'Name is required' }, 400);
  
  const id = crypto.randomUUID();
  await c.env.DB.prepare(`
    INSERT INTO organizations (id, name, description, owner_id)
    VALUES (?, ?, ?, ?)
  `).bind(id, name, description || '', userId).run();
  
  await c.env.DB.prepare(`
    INSERT INTO org_members (id, org_id, user_id, role)
    VALUES (?, ?, ?, 'owner')
  `).bind(crypto.randomUUID(), id, userId).run();
  
  const org = await c.env.DB.prepare('SELECT * FROM organizations WHERE id = ?').bind(id).first();
  return c.json(org, 201);
});

// GET /api/organizations/:id
organizations.get('/:id', async (c) => {
  const userId = c.get('userId');
  const orgId = c.req.param('id');
  
  const member = await c.env.DB.prepare(
    'SELECT * FROM org_members WHERE org_id = ? AND user_id = ?'
  ).bind(orgId, userId).first();
  if (!member) return c.json({ error: 'Access denied' }, 403);
  
  const org = await c.env.DB.prepare('SELECT * FROM organizations WHERE id = ?').bind(orgId).first();
  if (!org) return c.json({ error: 'Not found' }, 404);
  
  return c.json(org);
});

// PUT /api/organizations/:id
organizations.put('/:id', async (c) => {
  const userId = c.get('userId');
  const orgId = c.req.param('id');
  const { name, description, logo_url } = await c.req.json();
  
  const member = await c.env.DB.prepare(
    "SELECT * FROM org_members WHERE org_id = ? AND user_id = ? AND role IN ('owner', 'admin')"
  ).bind(orgId, userId).first();
  if (!member) return c.json({ error: 'Access denied' }, 403);
  
  await c.env.DB.prepare(`
    UPDATE organizations SET name = ?, description = ?, logo_url = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).bind(name, description, logo_url, orgId).run();
  
  return c.json({ success: true });
});

// GET /api/organizations/:id/members
organizations.get('/:id/members', async (c) => {
  const userId = c.get('userId');
  const orgId = c.req.param('id');
  
  const member = await c.env.DB.prepare(
    'SELECT * FROM org_members WHERE org_id = ? AND user_id = ?'
  ).bind(orgId, userId).first();
  if (!member) return c.json({ error: 'Access denied' }, 403);
  
  const members = await c.env.DB.prepare(`
    SELECT u.id, u.username, u.email, u.avatar_url, u.job_type,
           om.role, om.joined_at,
           us.status_emoji, us.status_text, us.note_text
    FROM org_members om
    JOIN users u ON u.id = om.user_id
    LEFT JOIN user_status us ON us.user_id = u.id
    WHERE om.org_id = ?
    ORDER BY om.role DESC, u.username
  `).bind(orgId).all();
  
  return c.json(members.results);
});

// POST /api/organizations/:id/invite
organizations.post('/:id/invite', async (c) => {
  const userId = c.get('userId');
  const orgId = c.req.param('id');
  const { email, role } = await c.req.json();
  
  const member = await c.env.DB.prepare(
    "SELECT * FROM org_members WHERE org_id = ? AND user_id = ? AND role IN ('owner', 'admin')"
  ).bind(orgId, userId).first();
  if (!member) return c.json({ error: 'Access denied' }, 403);
  
  // Check if user exists and add directly
  const invitedUser = await c.env.DB.prepare('SELECT id FROM users WHERE email = ?').bind(email).first() as any;
  if (invitedUser) {
    const existing = await c.env.DB.prepare(
      'SELECT id FROM org_members WHERE org_id = ? AND user_id = ?'
    ).bind(orgId, invitedUser.id).first();
    
    if (!existing) {
      await c.env.DB.prepare(`
        INSERT INTO org_members (id, org_id, user_id, role)
        VALUES (?, ?, ?, ?)
      `).bind(crypto.randomUUID(), orgId, invitedUser.id, role || 'member').run();
    }
    return c.json({ success: true, message: 'User added' });
  }
  
  return c.json({ error: 'User not found. Please ask them to register first.' }, 404);
});

// DELETE /api/organizations/:id/members/:memberId
organizations.delete('/:id/members/:memberId', async (c) => {
  const userId = c.get('userId');
  const orgId = c.req.param('id');
  const memberId = c.req.param('memberId');
  
  const requester = await c.env.DB.prepare(
    "SELECT * FROM org_members WHERE org_id = ? AND user_id = ? AND role IN ('owner', 'admin')"
  ).bind(orgId, userId).first();
  
  if (!requester && userId !== memberId) {
    return c.json({ error: 'Access denied' }, 403);
  }
  
  await c.env.DB.prepare(
    'DELETE FROM org_members WHERE org_id = ? AND user_id = ?'
  ).bind(orgId, memberId).run();
  
  return c.json({ success: true });
});

export default organizations;
