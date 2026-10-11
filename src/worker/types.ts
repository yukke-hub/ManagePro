import type { D1Database, Fetcher } from '@cloudflare/workers-types';

export interface Env {
  DB: D1Database;
  AI: Ai;
  ASSETS: Fetcher;
  ENVIRONMENT: string;
  ACCESS_TEAM_DOMAIN: string;
  ACCESS_AUD: string;
  AI_MODEL: string;
  AI_DAILY_USER_LIMIT: string;
  AI_DAILY_GLOBAL_LIMIT: string;
  WORK_START: string;
  WORK_END: string;
  DEFAULT_TZ: string;
  DEV_USER_EMAIL?: string; // ローカル開発専用(.dev.vars)
}

export interface User {
  id: number;
  email: string;
  display_name: string;
  timezone: string;
}

export type AppEnv = { Bindings: Env; Variables: { user: User } };

export type TaskStatus = 'todo' | 'doing' | 'done';

export interface TaskRow {
  id: number;
  user_id: number;
  project_id: number | null;
  project_name: string | null;
  title: string;
  done_criteria: string | null;
  notes: string | null;
  due_date: string | null;
  est_minutes: number | null;
  status: TaskStatus;
  completed_on: string | null;
  created_at: string;
  updated_at: string;
}

export interface EventRow {
  id: number;
  user_id: number;
  task_id: number | null;
  title: string;
  start_at: string; // YYYY-MM-DDTHH:MM (ユーザーのローカル時刻)
  end_at: string;
  status: 'confirmed' | 'proposed';
  source: 'user' | 'ai';
  created_at: string;
}
