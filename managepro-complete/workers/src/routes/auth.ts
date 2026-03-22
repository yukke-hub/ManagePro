import { Hono } from 'hono';
import { sign } from '@tsndr/cloudflare-worker-jwt';
import type { Env } from '../types';

const auth = new Hono<{ Bindings: Env }>();

async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return btoa(String.fromCharCode(...new Uint8Array(hash)));
}

async function verifyPassword(password: string, hash: string): Promise<boolean> {
  const computed = await hashPassword(password);
  return computed === hash;
}

async function generateToken(userId: string, email: string, username: string, secret: string): Promise<string> {
  return sign(
    {
      sub: userId,
      email,
      username,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 7, // 7 days
    },
    secret
  );
}

// POST /api/auth/register
auth.post('/register', async (c) => {
  const { email, password, username, job_type } = await c.req.json();
  
  if (!email || !password || !username) {
    return c.json({ error: 'Email, password, and username are required' }, 400);
  }
  
  if (password.length < 8) {
    return c.json({ error: 'Password must be at least 8 characters' }, 400);
  }

  // Check if email already exists
  const existing = await c.env.DB.prepare(
    'SELECT id FROM users WHERE email = ?'
  ).bind(email).first();
  
  if (existing) {
    return c.json({ error: 'Email already registered' }, 409);
  }

  const passwordHash = await hashPassword(password);
  const userId = crypto.randomUUID();
  
  await c.env.DB.prepare(`
    INSERT INTO users (id, email, password_hash, username, job_type)
    VALUES (?, ?, ?, ?, ?)
  `).bind(userId, email, passwordHash, username, job_type || 'other').run();

  // Create default user status
  await c.env.DB.prepare(`
    INSERT INTO user_status (user_id, status_emoji, status_text, note_text)
    VALUES (?, '🟢', 'オンライン', '')
  `).bind(userId).run();

  const token = await generateToken(userId, email, username, c.env.JWT_SECRET);
  
  const user = await c.env.DB.prepare(
    'SELECT id, email, username, job_type, subscription_status, trial_ends_at FROM users WHERE id = ?'
  ).bind(userId).first();

  return c.json({ token, user }, 201);
});

// POST /api/auth/login
auth.post('/login', async (c) => {
  const { email, password } = await c.req.json();
  
  if (!email || !password) {
    return c.json({ error: 'Email and password are required' }, 400);
  }

  const user = await c.env.DB.prepare(
    'SELECT id, email, password_hash, username, job_type, subscription_status, trial_ends_at FROM users WHERE email = ?'
  ).bind(email).first() as any;
  
  if (!user) {
    return c.json({ error: 'Invalid credentials' }, 401);
  }
  
  const isValid = await verifyPassword(password, user.password_hash);
  if (!isValid) {
    return c.json({ error: 'Invalid credentials' }, 401);
  }

  const token = await generateToken(user.id, user.email, user.username, c.env.JWT_SECRET);
  
  const { password_hash, ...userWithoutPassword } = user;
  
  return c.json({ token, user: userWithoutPassword });
});

// POST /api/auth/me (get current user from token)
auth.get('/me', async (c) => {
  const authHeader = c.req.header('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return c.json({ error: 'Unauthorized' }, 401);
  }
  
  const token = authHeader.substring(7);
  const parts = token.split('.');
  
  try {
    const payload = JSON.parse(atob(parts[1]));
    const user = await c.env.DB.prepare(
      'SELECT id, email, username, job_type, avatar_url, subscription_status, trial_ends_at FROM users WHERE id = ?'
    ).bind(payload.sub).first();
    
    if (!user) return c.json({ error: 'User not found' }, 404);
    
    const status = await c.env.DB.prepare(
      'SELECT status_emoji, status_text, note_text FROM user_status WHERE user_id = ?'
    ).bind(payload.sub).first();
    
    return c.json({ ...user, status });
  } catch {
    return c.json({ error: 'Invalid token' }, 401);
  }
});

export default auth;
