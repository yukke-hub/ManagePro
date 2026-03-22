import { Hono } from 'hono';
import type { Env } from './types';
import { corsHeaders } from './middleware/auth';
import auth from './routes/auth';
import users from './routes/users';
import organizations from './routes/organizations';
import projects from './routes/projects';
import tasks from './routes/tasks';
import { meetings, chat, budget, whiteboard, resources, paypal } from './routes/other';

const app = new Hono<{ Bindings: Env }>();

// ─── CORS ────────────────────────────────────────────────────────────────────
app.use('*', async (c, next) => {
  const origin = c.req.header('Origin') || '';
  const allowed = c.env.FRONTEND_URL || 'https://managepro.yukkebee.com';
  
  // Allow both production and local dev
  const isAllowed = origin === allowed || origin === 'http://localhost:5173' || origin === 'http://localhost:4173';
  
  if (c.req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': isAllowed ? origin : allowed,
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Max-Age': '86400',
      },
    });
  }
  
  await next();
  
  c.res.headers.set('Access-Control-Allow-Origin', isAllowed ? origin : allowed);
  c.res.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
  c.res.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
});

// ─── HEALTH CHECK ────────────────────────────────────────────────────────────
app.get('/api/health', (c) => c.json({ status: 'ok', version: '1.0.0' }));

// ─── ROUTES ──────────────────────────────────────────────────────────────────
app.route('/api/auth', auth);
app.route('/api/users', users);
app.route('/api/organizations', organizations);
app.route('/api/projects', projects);
app.route('/api/tasks', tasks);
app.route('/api/meetings', meetings);
app.route('/api/chat', chat);
app.route('/api/budget', budget);
app.route('/api/whiteboard', whiteboard);
app.route('/api/resources', resources);
app.route('/api/paypal', paypal);

// ─── 404 ─────────────────────────────────────────────────────────────────────
app.notFound((c) => c.json({ error: 'Not found' }, 404));

app.onError((err, c) => {
  console.error('Worker error:', err);
  return c.json({ error: 'Internal server error' }, 500);
});

export default app;
