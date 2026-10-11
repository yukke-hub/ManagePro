-- ManagePro 初期スキーマ (Cloudflare D1 / SQLite)
-- 日時はユーザーのタイムゾーンのローカル時刻を文字列で保存する
--   日付: 'YYYY-MM-DD' / 日時: 'YYYY-MM-DDTHH:MM'

CREATE TABLE users (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  email        TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  timezone     TEXT NOT NULL DEFAULT 'Asia/Tokyo',
  created_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE projects (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (user_id, name)
);

CREATE TABLE tasks (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  project_id    INTEGER REFERENCES projects(id) ON DELETE SET NULL,
  title         TEXT NOT NULL,
  done_criteria TEXT,
  notes         TEXT,
  due_date      TEXT,
  est_minutes   INTEGER,
  status        TEXT NOT NULL DEFAULT 'todo' CHECK (status IN ('todo','doing','done')),
  completed_on  TEXT,
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_tasks_user_status_due ON tasks (user_id, status, due_date);
CREATE INDEX idx_tasks_user_completed  ON tasks (user_id, completed_on);

CREATE TABLE events (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  task_id    INTEGER REFERENCES tasks(id) ON DELETE SET NULL,
  title      TEXT NOT NULL,
  start_at   TEXT NOT NULL,
  end_at     TEXT NOT NULL,
  status     TEXT NOT NULL DEFAULT 'confirmed' CHECK (status IN ('confirmed','proposed')),
  source     TEXT NOT NULL DEFAULT 'user' CHECK (source IN ('user','ai')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  CHECK (end_at > start_at)
);
CREATE INDEX idx_events_user_start ON events (user_id, start_at);

-- AI 呼び出し回数(UTC日付ごと)。無料枠(1日10,000 Neurons)を超えないための上限管理
CREATE TABLE ai_usage (
  user_id INTEGER NOT NULL,
  day     TEXT NOT NULL,
  calls   INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, day)
);

-- AI 結果のキャッシュ(入力が変わらない限り再呼び出ししない)
CREATE TABLE ai_cache (
  user_id    INTEGER NOT NULL,
  kind       TEXT NOT NULL,
  sig        TEXT NOT NULL,
  payload    TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (user_id, kind)
);
