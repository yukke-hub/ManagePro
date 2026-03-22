import { Hono } from 'hono';
import type { Env } from '../types';
import { authMiddleware } from '../middleware/auth';

// =====================
// MEETINGS
// =====================
export const meetings = new Hono<{ Bindings: Env; Variables: { userId: string } }>();
meetings.use('*', authMiddleware);

meetings.get('/', async (c) => {
  const userId = c.get('userId');
  const projectId = c.req.query('project_id');
  if (!projectId) return c.json({ error: 'project_id required' }, 400);
  
  const result = await c.env.DB.prepare(`
    SELECT m.*, u.username as created_by_name,
           (SELECT COUNT(*) FROM meeting_attendees WHERE meeting_id = m.id) as attendee_count
    FROM meetings m
    LEFT JOIN users u ON u.id = m.created_by
    WHERE m.project_id = ?
    ORDER BY m.scheduled_at DESC
  `).bind(projectId).all();
  return c.json(result.results);
});

meetings.post('/', async (c) => {
  const userId = c.get('userId');
  const { project_id, block_id, title, description, scheduled_at, duration_minutes, attendee_ids } = await c.req.json();
  
  const id = crypto.randomUUID();
  const roomId = `managepro-${id.substring(0, 8)}`;
  
  await c.env.DB.prepare(`
    INSERT INTO meetings (id, project_id, block_id, title, description, scheduled_at, duration_minutes, jitsi_room_id, created_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(id, project_id, block_id || null, title, description || '', scheduled_at, duration_minutes || 60, roomId, userId).run();
  
  // Add attendees and calendar events
  const allAttendees = [userId, ...(attendee_ids || [])].filter((v, i, a) => a.indexOf(v) === i);
  for (const attendeeId of allAttendees) {
    await c.env.DB.prepare(
      'INSERT OR IGNORE INTO meeting_attendees (id, meeting_id, user_id) VALUES (?, ?, ?)'
    ).bind(crypto.randomUUID(), id, attendeeId).run();
    
    await c.env.DB.prepare(`
      INSERT INTO calendar_events (id, user_id, project_id, source_type, source_id, title, start_at, end_at, all_day, color)
      VALUES (?, ?, ?, 'meeting', ?, ?, ?, datetime(?, '+' || ? || ' minutes'), 0, '#242424')
    `).bind(
      crypto.randomUUID(), attendeeId, project_id, id,
      `[ミーティング] ${title}`, scheduled_at, scheduled_at, scheduled_at, duration_minutes || 60
    ).run();
  }
  
  return c.json({ id, jitsi_room_id: roomId }, 201);
});

meetings.put('/:id', async (c) => {
  const meetingId = c.req.param('id');
  const { title, description, scheduled_at, duration_minutes, status } = await c.req.json();
  
  await c.env.DB.prepare(`
    UPDATE meetings SET title=?, description=?, scheduled_at=?, duration_minutes=?, status=? WHERE id=?
  `).bind(title, description, scheduled_at, duration_minutes, status, meetingId).run();
  return c.json({ success: true });
});

meetings.delete('/:id', async (c) => {
  const meetingId = c.req.param('id');
  await c.env.DB.prepare("DELETE FROM calendar_events WHERE source_type='meeting' AND source_id=?").bind(meetingId).run();
  await c.env.DB.prepare('DELETE FROM meetings WHERE id=?').bind(meetingId).run();
  return c.json({ success: true });
});

// Meeting minutes
meetings.get('/:id/minutes', async (c) => {
  const meetingId = c.req.param('id');
  const result = await c.env.DB.prepare(`
    SELECT mm.*, u.username as created_by_name FROM meeting_minutes mm
    JOIN users u ON u.id = mm.created_by
    WHERE mm.meeting_id = ? ORDER BY mm.created_at DESC
  `).bind(meetingId).all();
  return c.json(result.results);
});

meetings.post('/:id/minutes', async (c) => {
  const userId = c.get('userId');
  const meetingId = c.req.param('id');
  const { title, content } = await c.req.json();
  
  const id = crypto.randomUUID();
  await c.env.DB.prepare(
    'INSERT INTO meeting_minutes (id, meeting_id, title, content, created_by) VALUES (?, ?, ?, ?, ?)'
  ).bind(id, meetingId, title, content || '', userId).run();
  
  return c.json({ id }, 201);
});

meetings.put('/:id/minutes/:minuteId', async (c) => {
  const minuteId = c.req.param('minuteId');
  const { title, content } = await c.req.json();
  await c.env.DB.prepare(
    'UPDATE meeting_minutes SET title=?, content=?, updated_at=CURRENT_TIMESTAMP WHERE id=?'
  ).bind(title, content, minuteId).run();
  return c.json({ success: true });
});

// =====================
// CHAT
// =====================
export const chat = new Hono<{ Bindings: Env; Variables: { userId: string } }>();
chat.use('*', authMiddleware);

chat.get('/threads', async (c) => {
  const userId = c.get('userId');
  const projectId = c.req.query('project_id');
  if (!projectId) return c.json({ error: 'project_id required' }, 400);
  
  const threads = await c.env.DB.prepare(`
    SELECT ct.*, u.username as created_by_name,
           (SELECT COUNT(*) FROM chat_messages WHERE thread_id = ct.id) as message_count,
           (SELECT content FROM chat_messages WHERE thread_id = ct.id ORDER BY created_at DESC LIMIT 1) as last_message
    FROM chat_threads ct
    LEFT JOIN users u ON u.id = ct.created_by
    WHERE ct.project_id = ?
    AND (ct.permission = 'all' OR EXISTS (
      SELECT 1 FROM thread_access WHERE thread_id = ct.id AND user_id = ? AND can_read = 1
    ) OR ct.created_by = ?)
    ORDER BY ct.created_at DESC
  `).bind(projectId, userId, userId).all();
  
  return c.json(threads.results);
});

chat.post('/threads', async (c) => {
  const userId = c.get('userId');
  const { project_id, block_id, name, description, permission } = await c.req.json();
  
  const id = crypto.randomUUID();
  await c.env.DB.prepare(`
    INSERT INTO chat_threads (id, project_id, block_id, name, description, permission, created_by)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).bind(id, project_id, block_id || null, name, description || '', permission || 'all', userId).run();
  
  return c.json({ id }, 201);
});

chat.put('/threads/:id', async (c) => {
  const threadId = c.req.param('id');
  const { name, description, permission } = await c.req.json();
  await c.env.DB.prepare('UPDATE chat_threads SET name=?, description=?, permission=? WHERE id=?')
    .bind(name, description, permission, threadId).run();
  return c.json({ success: true });
});

chat.get('/threads/:id/messages', async (c) => {
  const userId = c.get('userId');
  const threadId = c.req.param('id');
  const since = c.req.query('since');
  
  let query = `
    SELECT cm.*, u.username, u.avatar_url
    FROM chat_messages cm JOIN users u ON u.id = cm.user_id
    WHERE cm.thread_id = ?
  `;
  const params: any[] = [threadId];
  if (since) { query += ' AND cm.created_at > ?'; params.push(since); }
  query += ' ORDER BY cm.created_at ASC LIMIT 100';
  
  const result = await c.env.DB.prepare(query).bind(...params).all();
  return c.json(result.results);
});

chat.post('/threads/:id/messages', async (c) => {
  const userId = c.get('userId');
  const threadId = c.req.param('id');
  const { content } = await c.req.json();
  
  if (!content?.trim()) return c.json({ error: 'Content required' }, 400);
  
  const id = crypto.randomUUID();
  await c.env.DB.prepare(
    'INSERT INTO chat_messages (id, thread_id, user_id, content) VALUES (?, ?, ?, ?)'
  ).bind(id, threadId, userId, content.trim()).run();
  
  const msg = await c.env.DB.prepare(`
    SELECT cm.*, u.username, u.avatar_url FROM chat_messages cm
    JOIN users u ON u.id = cm.user_id WHERE cm.id = ?
  `).bind(id).first();
  
  return c.json(msg, 201);
});

chat.delete('/messages/:id', async (c) => {
  const userId = c.get('userId');
  const msgId = c.req.param('id');
  await c.env.DB.prepare('DELETE FROM chat_messages WHERE id=? AND user_id=?').bind(msgId, userId).run();
  return c.json({ success: true });
});

// =====================
// BUDGET
// =====================
export const budget = new Hono<{ Bindings: Env; Variables: { userId: string } }>();
budget.use('*', authMiddleware);

budget.get('/', async (c) => {
  const projectId = c.req.query('project_id');
  const blockId = c.req.query('block_id');
  if (!projectId) return c.json({ error: 'project_id required' }, 400);
  
  let query = 'SELECT * FROM budgets WHERE project_id = ?';
  const params: any[] = [projectId];
  if (blockId) { query += ' AND block_id = ?'; params.push(blockId); }
  
  const b = await c.env.DB.prepare(query).bind(...params).first() as any;
  if (!b) return c.json({ error: 'Budget not found' }, 404);
  
  const items = await c.env.DB.prepare(
    'SELECT * FROM budget_items WHERE budget_id = ? ORDER BY date DESC'
  ).bind(b.id).all();
  
  return c.json({ ...b, items: items.results });
});

budget.put('/:id', async (c) => {
  const budgetId = c.req.param('id');
  const { total_amount, currency } = await c.req.json();
  await c.env.DB.prepare('UPDATE budgets SET total_amount=?, currency=?, updated_at=CURRENT_TIMESTAMP WHERE id=?')
    .bind(total_amount, currency, budgetId).run();
  return c.json({ success: true });
});

budget.post('/:id/items', async (c) => {
  const budgetId = c.req.param('id');
  const { category, name, description, planned_amount, actual_amount, date, status } = await c.req.json();
  const id = crypto.randomUUID();
  await c.env.DB.prepare(`
    INSERT INTO budget_items (id, budget_id, category, name, description, planned_amount, actual_amount, date, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(id, budgetId, category, name, description || '', planned_amount || 0, actual_amount || 0, date, status || 'planned').run();
  return c.json({ id }, 201);
});

budget.put('/items/:itemId', async (c) => {
  const itemId = c.req.param('itemId');
  const { category, name, description, planned_amount, actual_amount, date, status } = await c.req.json();
  await c.env.DB.prepare(`
    UPDATE budget_items SET category=?, name=?, description=?, planned_amount=?, actual_amount=?, date=?, status=? WHERE id=?
  `).bind(category, name, description, planned_amount, actual_amount, date, status, itemId).run();
  return c.json({ success: true });
});

budget.delete('/items/:itemId', async (c) => {
  const itemId = c.req.param('itemId');
  await c.env.DB.prepare('DELETE FROM budget_items WHERE id=?').bind(itemId).run();
  return c.json({ success: true });
});

// =====================
// WHITEBOARD
// =====================
export const whiteboard = new Hono<{ Bindings: Env; Variables: { userId: string } }>();
whiteboard.use('*', authMiddleware);

whiteboard.get('/', async (c) => {
  const projectId = c.req.query('project_id');
  const blockId = c.req.query('block_id');
  if (!projectId) return c.json({ error: 'project_id required' }, 400);
  
  let q = 'SELECT * FROM whiteboards WHERE project_id = ?';
  const params: any[] = [projectId];
  if (blockId) { q += ' AND block_id = ?'; params.push(blockId); }
  
  const wb = await c.env.DB.prepare(q).bind(...params).first();
  return c.json(wb || { data: '{}' });
});

whiteboard.put('/:id', async (c) => {
  const id = c.req.param('id');
  const { data } = await c.req.json();
  await c.env.DB.prepare('UPDATE whiteboards SET data=?, updated_at=CURRENT_TIMESTAMP WHERE id=?')
    .bind(JSON.stringify(data), id).run();
  return c.json({ success: true });
});

// =====================
// RESOURCES
// =====================
export const resources = new Hono<{ Bindings: Env; Variables: { userId: string } }>();
resources.use('*', authMiddleware);

resources.get('/', async (c) => {
  const projectId = c.req.query('project_id');
  const blockId = c.req.query('block_id');
  if (!projectId) return c.json({ error: 'project_id required' }, 400);
  
  let q = `SELECT r.*, u.username as created_by_name FROM resources r 
           LEFT JOIN users u ON u.id = r.created_by WHERE r.project_id = ?`;
  const params: any[] = [projectId];
  if (blockId) { q += ' AND r.block_id = ?'; params.push(blockId); }
  q += ' ORDER BY r.created_at DESC';
  
  const result = await c.env.DB.prepare(q).bind(...params).all();
  return c.json(result.results);
});

resources.post('/', async (c) => {
  const userId = c.get('userId');
  const { project_id, block_id, title, url, resource_type } = await c.req.json();
  const id = crypto.randomUUID();
  await c.env.DB.prepare(`
    INSERT INTO resources (id, project_id, block_id, title, url, resource_type, created_by)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).bind(id, project_id, block_id || null, title, url, resource_type || 'link', userId).run();
  return c.json({ id }, 201);
});

resources.delete('/:id', async (c) => {
  const id = c.req.param('id');
  await c.env.DB.prepare('DELETE FROM resources WHERE id=?').bind(id).run();
  return c.json({ success: true });
});

// =====================
// PAYPAL
// =====================
export const paypal = new Hono<{ Bindings: Env; Variables: { userId: string } }>();
paypal.use('/webhook', async (c, next) => next()); // webhook doesn't need auth

// GET /api/paypal/config - return client id and plan id for frontend
paypal.get('/config', async (c) => {
  return c.json({
    client_id: c.env.PAYPAL_CLIENT_ID,
    plan_id: c.env.PAYPAL_PLAN_ID,
    mode: c.env.PAYPAL_MODE,
  });
});

// POST /api/paypal/webhook - PayPal sends events here
paypal.post('/webhook', async (c) => {
  const body = await c.req.json() as any;
  const eventType = body.event_type;
  const subscriptionId = body.resource?.id;
  
  await c.env.DB.prepare(`
    INSERT INTO subscription_events (id, paypal_subscription_id, event_type, payload)
    VALUES (?, ?, ?, ?)
  `).bind(crypto.randomUUID(), subscriptionId, eventType, JSON.stringify(body)).run();
  
  // Handle subscription activation
  if (eventType === 'BILLING.SUBSCRIPTION.ACTIVATED') {
    const email = body.resource?.subscriber?.email_address;
    if (email) {
      await c.env.DB.prepare(`
        UPDATE users SET 
          subscription_status = 'active',
          paypal_subscription_id = ?,
          subscription_expires_at = datetime('now', '+1 month')
        WHERE email = ?
      `).bind(subscriptionId, email).run();
    }
  }
  
  // Handle subscription cancellation
  if (eventType === 'BILLING.SUBSCRIPTION.CANCELLED' || eventType === 'BILLING.SUBSCRIPTION.EXPIRED') {
    await c.env.DB.prepare(`
      UPDATE users SET subscription_status = 'cancelled' WHERE paypal_subscription_id = ?
    `).bind(subscriptionId).run();
  }
  
  // Handle successful payment renewal
  if (eventType === 'PAYMENT.SALE.COMPLETED') {
    await c.env.DB.prepare(`
      UPDATE users SET 
        subscription_status = 'active',
        subscription_expires_at = datetime('now', '+1 month')
      WHERE paypal_subscription_id = ?
    `).bind(subscriptionId).run();
  }
  
  return c.json({ received: true });
});

// POST /api/paypal/subscribe - record subscription after PayPal approval
paypal.post('/subscribe', authMiddleware as any, async (c) => {
  const userId = c.get('userId') as string;
  const { subscription_id } = await c.req.json();
  
  await c.env.DB.prepare(`
    UPDATE users SET 
      subscription_status = 'active',
      paypal_subscription_id = ?,
      subscription_expires_at = datetime('now', '+1 month')
    WHERE id = ?
  `).bind(subscription_id, userId).run();
  
  return c.json({ success: true });
});
