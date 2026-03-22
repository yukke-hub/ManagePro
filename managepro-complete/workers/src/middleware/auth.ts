import { Context, Next } from 'hono';
import { verify } from '@tsndr/cloudflare-worker-jwt';
import type { Env, JWTPayload } from '../types';

export async function authMiddleware(c: Context<{ Bindings: Env }>, next: Next) {
  const authHeader = c.req.header('Authorization');
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const token = authHeader.substring(7);
  
  try {
    const isValid = await verify(token, c.env.JWT_SECRET);
    if (!isValid) {
      return c.json({ error: 'Invalid token' }, 401);
    }

    // Decode payload
    const parts = token.split('.');
    const payload = JSON.parse(atob(parts[1])) as JWTPayload;
    
    if (payload.exp < Math.floor(Date.now() / 1000)) {
      return c.json({ error: 'Token expired' }, 401);
    }

    c.set('userId', payload.sub);
    c.set('userEmail', payload.email);
    c.set('username', payload.username);
    
    await next();
  } catch (err) {
    return c.json({ error: 'Invalid token' }, 401);
  }
}

export function corsHeaders(frontendUrl: string) {
  return {
    'Access-Control-Allow-Origin': frontendUrl,
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Max-Age': '86400',
  };
}
