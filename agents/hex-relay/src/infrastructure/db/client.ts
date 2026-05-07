import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import type { Logger } from "../../lib/logger.js";
import { runMigrations } from "./migrations.js";
import { SCHEMA_SQL } from "./schema.js";
import type { Db } from "./types.js";

export interface DbDeps {
  dbPath: string;
  log: Logger;
  primaryOperator: number;
  sessionsDir: () => string | null;
}

export function createDb(deps: DbDeps): Db {
  mkdirSync(dirname(deps.dbPath), { recursive: true });
  const db = new Database(deps.dbPath);
  db.pragma("journal_mode = WAL");
  db.pragma("synchronous = NORMAL");
  db.pragma("foreign_keys = ON");
  db.pragma("busy_timeout = 5000");
  db.exec(SCHEMA_SQL);
  runMigrations(db, {
    log: deps.log,
    primaryOperator: deps.primaryOperator,
    sessionsDir: deps.sessionsDir,
  });
  return db;
}

export function closeDb(db: Db): void {
  try {
    db.close();
  } catch {
    /* ignore */
  }
}
