import type { D1Database, KVNamespace } from '@cloudflare/workers-types';

export interface Env {
  DB: D1Database;
  KV: KVNamespace;
  JWT_SECRET: string;
  PAYPAL_CLIENT_ID: string;
  PAYPAL_CLIENT_SECRET: string;
  PAYPAL_PLAN_ID: string;
  PAYPAL_MODE: string;
  FRONTEND_URL: string;
  ENVIRONMENT: string;
}

export interface JWTPayload {
  sub: string;     // user id
  email: string;
  username: string;
  iat: number;
  exp: number;
}

export interface User {
  id: string;
  email: string;
  username: string;
  job_type: string;
  avatar_url: string | null;
  subscription_status: string;
  created_at: string;
}

export interface Organization {
  id: string;
  name: string;
  description: string;
  logo_url: string | null;
  owner_id: string;
}

export interface Project {
  id: string;
  org_id: string;
  name: string;
  description: string;
  color: string;
  status: string;
  created_by: string;
}

export interface Task {
  id: string;
  project_id: string;
  block_id: string | null;
  parent_task_id: string | null;
  title: string;
  description: string;
  status: string;
  priority: string;
  due_date: string | null;
  assignee_id: string | null;
  position: number;
  protocol: string;
}
