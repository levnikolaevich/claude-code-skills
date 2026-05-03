// Schema for relay-bot. Keep relay.db stable across idempotent starts.
// Forward migrations live in migrations.ts; this module is idempotent.

export const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS messages (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  ts              INTEGER NOT NULL,
  direction       TEXT NOT NULL,
  kind            TEXT NOT NULL DEFAULT 'text',
  status          TEXT NOT NULL,
  text            TEXT NOT NULL,
  tg_chat_id      INTEGER,
  tg_msg_id       INTEGER,
  session_id      TEXT,
  replied_to_id   INTEGER,
  error           TEXT,
  attempts        INTEGER NOT NULL DEFAULT 0,
  next_attempt_at INTEGER NOT NULL DEFAULT 0,
  delivered_at    INTEGER
);
CREATE INDEX IF NOT EXISTS idx_msg_session ON messages(session_id);
CREATE INDEX IF NOT EXISTS idx_msg_inbound ON messages(tg_chat_id, tg_msg_id);

CREATE TABLE IF NOT EXISTS pending_reply (
  session_id      TEXT PRIMARY KEY,
  inbound_msg_id  INTEGER NOT NULL,
  prompt_hash     TEXT NOT NULL,
  created_at      INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS outbox (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  ts               INTEGER NOT NULL,
  text             TEXT NOT NULL,
  chat_id          INTEGER NOT NULL,
  status           TEXT NOT NULL,
  attempts         INTEGER NOT NULL DEFAULT 0,
  next_attempt_at  INTEGER NOT NULL,
  replied_to_id    INTEGER,
  session_id       TEXT,
  tg_msg_id        INTEGER,
  error            TEXT,
  audit_msg_id     INTEGER
);
CREATE INDEX IF NOT EXISTS idx_outbox_due ON outbox(status, next_attempt_at);

CREATE TABLE IF NOT EXISTS sessions (
  session_id        TEXT PRIMARY KEY,
  started_at        INTEGER NOT NULL,
  ended_at          INTEGER,
  source            TEXT NOT NULL,
  previous_session  TEXT,
  model             TEXT,
  cwd               TEXT,
  transcript_path   TEXT,
  end_reason        TEXT,
  created_by_user_id INTEGER
);
CREATE INDEX IF NOT EXISTS idx_sessions_active ON sessions(ended_at);

CREATE TABLE IF NOT EXISTS session_events (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id  TEXT NOT NULL,
  ts          INTEGER NOT NULL,
  kind        TEXT NOT NULL,
  details     TEXT
);
CREATE INDEX IF NOT EXISTS idx_session_events_session ON session_events(session_id, ts);

CREATE TABLE IF NOT EXISTS dispatch_runs (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  ts_started      INTEGER NOT NULL,
  ts_finished     INTEGER,
  trigger         TEXT NOT NULL,
  session_id      TEXT,
  issue_number    INTEGER,
  issue_title     TEXT,
  status          TEXT NOT NULL,
  budget_5h_pct   INTEGER,
  budget_week_pct INTEGER,
  pr_number       INTEGER,
  pr_url          TEXT,
  branch          TEXT,
  error           TEXT
);
CREATE INDEX IF NOT EXISTS idx_dispatch_runs_recent ON dispatch_runs(ts_started DESC);

CREATE TABLE IF NOT EXISTS dispatch_phases (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  run_id      INTEGER NOT NULL,
  phase       TEXT NOT NULL,
  ts_started  INTEGER NOT NULL,
  ts_finished INTEGER,
  status      TEXT NOT NULL,
  verdict     TEXT,
  details     TEXT
);
CREATE INDEX IF NOT EXISTS idx_dispatch_phases_run ON dispatch_phases(run_id, ts_started);

CREATE TABLE IF NOT EXISTS memories (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  ts_created  INTEGER NOT NULL,
  ts_used     INTEGER,
  category    TEXT NOT NULL,
  text        TEXT NOT NULL,
  tags        TEXT,
  source      TEXT,
  expires_at  INTEGER
);
CREATE INDEX IF NOT EXISTS idx_memories_active ON memories(ts_created DESC);

CREATE TABLE IF NOT EXISTS health_snapshots (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  ts            INTEGER NOT NULL,
  source        TEXT NOT NULL,
  ram_used_mb   INTEGER,
  cpu_pct       INTEGER,
  details       TEXT
);
CREATE INDEX IF NOT EXISTS idx_health_recent ON health_snapshots(ts DESC);

CREATE TABLE IF NOT EXISTS auth_rejects (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  ts            INTEGER NOT NULL,
  from_user_id  INTEGER,
  username      TEXT,
  chat_id       INTEGER,
  event_kind    TEXT NOT NULL,
  text_preview  TEXT
);
CREATE INDEX IF NOT EXISTS idx_auth_rejects_ts ON auth_rejects(ts DESC);

CREATE TABLE IF NOT EXISTS allowed_users (
  user_id              INTEGER PRIMARY KEY,
  username             TEXT,
  status               TEXT NOT NULL CHECK(status IN ('allowed','blocked','pending')),
  added_by             INTEGER,
  added_at             INTEGER NOT NULL,
  pending_notified_at  INTEGER,
  notes                TEXT
);
CREATE INDEX IF NOT EXISTS idx_allowed_users_status ON allowed_users(status);

CREATE TABLE IF NOT EXISTS todo_state (
  session_id  TEXT NOT NULL,
  task_id     TEXT NOT NULL,
  status      TEXT NOT NULL,
  content     TEXT NOT NULL,
  active_form TEXT,
  updated_at  INTEGER NOT NULL,
  PRIMARY KEY (session_id, task_id)
);
CREATE INDEX IF NOT EXISTS idx_todo_state_session ON todo_state(session_id);
`;
