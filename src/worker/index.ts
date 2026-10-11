import { Hono } from 'hono';
import { auth } from './auth';
import { HttpError } from './services';
import type { AppEnv } from './types';
import ai from './routes/ai';
import dashboard from './routes/dashboard';
import events from './routes/events';
import me from './routes/me';
import tasks from './routes/tasks';

const app = new Hono<AppEnv>();

// CSRF 対策: 書き込み系は独自ヘッダー必須(他サイトからは CORS プリフライトなしに送れない)
app.use('/api/*', async (c, next) => {
  if (!['GET', 'HEAD', 'OPTIONS'].includes(c.req.method) && c.req.header('X-Requested-With') !== 'managepro') {
    return c.json({ error: 'forbidden' }, 403);
  }
  await next();
});
app.use('/api/*', auth);

app.route('/api/me', me);
app.route('/api/tasks', tasks);
app.route('/api/events', events);
app.route('/api/dashboard', dashboard);
app.route('/api/ai', ai);
app.all('/api/*', (c) => c.json({ error: 'not_found' }, 404));

app.onError((err, c) => {
  if (err instanceof HttpError) return c.json({ error: err.message }, err.status);
  console.error(err);
  return c.json({ error: 'internal_error' }, 500);
});

// /api 以外(通常は run_worker_first により Worker を通らない)は静的アセットへ
app.all('*', (c) => c.env.ASSETS.fetch(c.req.raw));

export default app;
