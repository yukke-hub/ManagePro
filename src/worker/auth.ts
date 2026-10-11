import { createMiddleware } from 'hono/factory';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import type { AppEnv, User } from './types';

// JWKS はモジュール内にキャッシュ(isolate が生きている間は再取得しない)
let jwks: ReturnType<typeof createRemoteJWKSet> | undefined;
let jwksDomain = '';

/**
 * Cloudflare Access が付与する JWT を検証してユーザーを特定する。
 * - 署名 / issuer / audience / 有効期限をすべて検証(Access 経由でも Worker 側で必ず確認)
 * - 設定がプレースホルダーのままなら fail closed(誰も通さない)
 * - ENVIRONMENT=development かつ DEV_USER_EMAIL があるときだけ検証を省略(ローカル専用)
 */
export const auth = createMiddleware<AppEnv>(async (c, next) => {
  const env = c.env;
  let email: string | undefined;
  let name: string | undefined;

  if (env.ENVIRONMENT === 'development' && env.DEV_USER_EMAIL) {
    email = env.DEV_USER_EMAIL;
  } else {
    if (env.ACCESS_TEAM_DOMAIN.includes('REPLACE') || env.ACCESS_AUD.includes('REPLACE')) {
      return c.json({ error: 'access_not_configured' }, 500);
    }
    const token = c.req.header('Cf-Access-Jwt-Assertion');
    if (!token) return c.json({ error: 'unauthorized' }, 401);
    try {
      const issuer = `https://${env.ACCESS_TEAM_DOMAIN}`;
      if (!jwks || jwksDomain !== issuer) {
        jwks = createRemoteJWKSet(new URL(`${issuer}/cdn-cgi/access/certs`));
        jwksDomain = issuer;
      }
      const { payload } = await jwtVerify(token, jwks, { issuer, audience: env.ACCESS_AUD });
      email = typeof payload.email === 'string' ? payload.email.toLowerCase() : undefined;
      name = typeof payload.name === 'string' ? payload.name : undefined;
    } catch (e) {
      console.warn('access jwt rejected', e instanceof Error ? e.message : e);
      return c.json({ error: 'unauthorized' }, 401);
    }
  }
  if (!email) return c.json({ error: 'unauthorized' }, 401);

  // 読み取り優先。初回だけ INSERT(D1 の書き込み回数を節約)
  let user = await env.DB.prepare(
    'SELECT id, email, display_name, timezone FROM users WHERE email = ?',
  )
    .bind(email)
    .first<User>();
  if (!user) {
    const display = (name || email.split('@')[0]).slice(0, 30);
    await env.DB.prepare(
      'INSERT INTO users (email, display_name, timezone) VALUES (?, ?, ?) ON CONFLICT(email) DO NOTHING',
    )
      .bind(email, display, env.DEFAULT_TZ || 'Asia/Tokyo')
      .run();
    user = await env.DB.prepare('SELECT id, email, display_name, timezone FROM users WHERE email = ?')
      .bind(email)
      .first<User>();
  }
  if (!user) return c.json({ error: 'user_init_failed' }, 500);
  c.set('user', user);
  await next();
});
