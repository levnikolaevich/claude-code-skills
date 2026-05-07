import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import type { Logger } from "../../lib/logger.js";
import { UUID_RE } from "../../config/paths.js";
import type { Db } from "./types.js";

export interface MigrationDeps {
  log: Logger;
  primaryOperator: number;
  sessionsDir: () => string | null;
}

interface ColInfo {
  name: string;
}

function tableColumns(db: Db, table: string): Set<string> {
  const rows = db.prepare(`PRAGMA table_info(${table})`).all() as ColInfo[];
  return new Set(rows.map((r) => r.name));
}

function nowTs(): number {
  return Math.floor(Date.now() / 1000);
}

export function runMigrations(db: Db, deps: MigrationDeps): void {
  ensureMessagesColumns(db);
  ensureSessionsOwnerColumn(db);
  ensureExtraIndexes(db);
  recoverStuckInbound(db);
  migrateOutboxEventType(db, deps.log);
  migratePendingReplyCompositeKey(db, deps.log);
  migrateAgentColumns(db, deps.log);
  ensureUserBuddyTable(db, deps.log);
  seedTaskPollState(db, deps.log);
  reconcileSessionsOwner(db, deps);
}

function ensureMessagesColumns(db: Db): void {
  const cols = tableColumns(db, "messages");
  const ddls: [string, string][] = [
    ["kind", "ALTER TABLE messages ADD COLUMN kind TEXT NOT NULL DEFAULT 'text'"],
    ["attempts", "ALTER TABLE messages ADD COLUMN attempts INTEGER NOT NULL DEFAULT 0"],
    [
      "next_attempt_at",
      "ALTER TABLE messages ADD COLUMN next_attempt_at INTEGER NOT NULL DEFAULT 0",
    ],
    ["delivered_at", "ALTER TABLE messages ADD COLUMN delivered_at INTEGER"],
    ["from_user_id", "ALTER TABLE messages ADD COLUMN from_user_id INTEGER"],
    ["media_path", "ALTER TABLE messages ADD COLUMN media_path TEXT"],
  ];
  for (const [col, ddl] of ddls) {
    if (!cols.has(col)) db.exec(ddl);
  }
}

function ensureSessionsOwnerColumn(db: Db): void {
  const cols = tableColumns(db, "sessions");
  if (!cols.has("created_by_user_id")) {
    db.exec("ALTER TABLE sessions ADD COLUMN created_by_user_id INTEGER");
  }
}

function ensureExtraIndexes(db: Db): void {
  db.exec(
    "CREATE INDEX IF NOT EXISTS idx_msg_inbound_due " +
      "ON messages(direction, status, next_attempt_at)"
  );
  db.exec("CREATE INDEX IF NOT EXISTS idx_msg_from_user " + "ON messages(from_user_id)");
  db.exec(
    "CREATE INDEX IF NOT EXISTS idx_msg_kind_status " + "ON messages(direction, kind, status)"
  );
  db.exec("CREATE INDEX IF NOT EXISTS idx_sessions_owner " + "ON sessions(created_by_user_id)");
}

function recoverStuckInbound(db: Db): void {
  db.prepare(
    "UPDATE messages SET status='queued', next_attempt_at=? " +
      "WHERE direction='inbound' AND status='delivering'"
  ).run(nowTs());
}

function migrateOutboxEventType(db: Db, log: Logger): void {
  try {
    const cols = tableColumns(db, "outbox");
    if (!cols.has("event_type")) {
      db.exec("ALTER TABLE outbox ADD COLUMN event_type TEXT");
      db.exec("UPDATE outbox SET event_type = 'reply' WHERE event_type IS NULL");
      db.exec("CREATE INDEX IF NOT EXISTS idx_outbox_event_type ON outbox(event_type)");
      log.info("migrate: added outbox.event_type column");
    }
  } catch (error) {
    log.error({ err: error }, "migrate_outbox_event_type failed");
  }
}

function migratePendingReplyCompositeKey(db: Db, log: Logger): void {
  try {
    const rows = db.prepare("PRAGMA table_info(pending_reply)").all() as {
      name: string;
      pk: number;
    }[];
    if (rows.length === 0) return;
    const pkCols = rows
      .filter((r) => r.pk > 0)
      .sort((a, b) => a.pk - b.pk)
      .map((r) => r.name);
    const isComposite =
      pkCols.length === 2 && pkCols.includes("session_id") && pkCols.includes("inbound_msg_id");
    if (isComposite) return;
    db.exec("BEGIN IMMEDIATE");
    db.exec(
      "CREATE TABLE pending_reply_new (" +
        "session_id TEXT NOT NULL, " +
        "inbound_msg_id INTEGER NOT NULL, " +
        "prompt_hash TEXT NOT NULL, " +
        "created_at INTEGER NOT NULL, " +
        "PRIMARY KEY (session_id, inbound_msg_id))"
    );
    db.exec(
      "INSERT OR IGNORE INTO pending_reply_new " +
        "(session_id, inbound_msg_id, prompt_hash, created_at) " +
        "SELECT session_id, inbound_msg_id, prompt_hash, created_at FROM pending_reply"
    );
    db.exec("DROP TABLE pending_reply");
    db.exec("ALTER TABLE pending_reply_new RENAME TO pending_reply");
    db.exec("CREATE INDEX IF NOT EXISTS idx_pending_reply_session ON pending_reply(session_id)");
    db.exec("CREATE INDEX IF NOT EXISTS idx_pending_reply_created ON pending_reply(created_at)");
    db.exec("COMMIT");
    log.info("migrate: pending_reply -> composite PK (session_id, inbound_msg_id)");
  } catch (error) {
    try {
      db.exec("ROLLBACK");
    } catch {
      /* ignore */
    }
    log.error({ err: error }, "migrate_pending_reply_composite_key failed");
  }
}

function seedTaskPollState(db: Db, log: Logger): void {
  try {
    const existing = db.prepare("SELECT id FROM task_poll_state WHERE id = 1").get();
    if (existing) return;
    const row = db
      .prepare(
        "SELECT ts FROM outbox WHERE event_type='system' " +
          "AND text LIKE 'Tasks:%open task%' ORDER BY ts DESC LIMIT 1"
      )
      .get() as { ts: number } | undefined;
    if (!row) return;
    db.prepare(
      "INSERT INTO task_poll_state (id, last_notified_at, last_count, updated_at) " +
        "VALUES (1, ?, 0, ?)"
    ).run(row.ts, nowTs());
    log.info({ lastNotifiedAt: row.ts }, "migrate: seeded task poll notification state");
  } catch (error) {
    log.error({ err: error }, "seed_task_poll_state failed");
  }
}

function reconcileSessionsOwner(db: Db, deps: MigrationDeps): void {
  const sd = deps.sessionsDir();
  let inserted = 0;
  if (sd !== null) {
    let entries: string[];
    try {
      entries = readdirSync(sd);
    } catch {
      entries = [];
    }
    const insert = db.prepare(
      "INSERT OR IGNORE INTO sessions " +
        "(session_id, started_at, source, transcript_path, created_by_user_id) " +
        "VALUES (?, ?, 'session_reconcile', ?, ?)"
    );
    for (const name of entries) {
      if (!name.endsWith(".jsonl")) continue;
      const sid = name.slice(0, -".jsonl".length);
      if (!UUID_RE.test(sid)) continue;
      const full = join(sd, name);
      let mtime: number;
      try {
        mtime = Math.floor(statSync(full).mtimeMs / 1000);
      } catch {
        continue;
      }
      const result = insert.run(sid, mtime, full, deps.primaryOperator);
      if ((result.changes ?? 0) > 0) inserted += 1;
    }
  }
  if (inserted > 0) {
    deps.log.info({ inserted }, "sessions owner reconciliation: inserted untracked jsonl sessions");
  }
  try {
    const result = db
      .prepare("UPDATE sessions SET created_by_user_id = ? WHERE created_by_user_id IS NULL")
      .run(deps.primaryOperator);
    if ((result.changes ?? 0) > 0) {
      deps.log.info(
        { tagged: result.changes },
        "sessions owner reconciliation: tagged null-owner sessions to primary"
      );
    }
  } catch (error) {
    deps.log.error({ err: error }, "sessions owner reconciliation UPDATE failed");
  }
}

function migrateAgentColumns(db: Db, log: Logger): void {
  const tables = ["messages", "pending_reply", "outbox", "sessions"];
  for (const table of tables) {
    try {
      const cols = tableColumns(db, table);
      if (cols.has("agent")) continue;
      db.exec(`ALTER TABLE ${table} ADD COLUMN agent TEXT NOT NULL DEFAULT 'claude'`);
      log.info({ table }, "migrate: added agent column");
    } catch (error) {
      log.error({ err: error, table }, "migrate_agent_columns failed");
    }
  }
}

function ensureUserBuddyTable(db: Db, log: Logger): void {
  try {
    db.exec(
      "CREATE TABLE IF NOT EXISTS user_buddy (" +
        "user_id INTEGER PRIMARY KEY, " +
        "agent TEXT NOT NULL CHECK(agent IN ('claude','codex')), " +
        "updated_at INTEGER NOT NULL)"
    );
  } catch (error) {
    log.error({ err: error }, "ensure_user_buddy_table failed");
  }
}
