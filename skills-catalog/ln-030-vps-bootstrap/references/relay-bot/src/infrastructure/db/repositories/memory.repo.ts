import type { Db } from "../client.js";
import type { MemoryRow } from "../../../domain/memory.js";
import { mapMemoryRow } from "../rowMappers.js";

export interface MemoryAddArgs {
  category: string;
  text: string;
  tags?: string | null;
  source?: string | null;
  expiresAt?: number | null;
}

function nowTs(): number {
  return Math.floor(Date.now() / 1000);
}

export type MemoryRepo = ReturnType<typeof createMemoryRepo>;

export function createMemoryRepo(db: Db) {
  const insert = db.prepare(
    "INSERT INTO memories (ts_created, category, text, tags, source, expires_at) " +
      "VALUES (?,?,?,?,?,?)"
  );
  const deleteById = db.prepare("DELETE FROM memories WHERE id=?");
  const deleteByTag = db.prepare("DELETE FROM memories WHERE tags LIKE ?");

  return {
    add(args: MemoryAddArgs): number {
      const result = insert.run(
        nowTs(),
        args.category,
        args.text,
        args.tags ?? null,
        args.source ?? null,
        args.expiresAt ?? null
      );
      return Number(result.lastInsertRowid);
    },
    recent(limit: number, category: string | null): MemoryRow[] {
      const where = ["(expires_at IS NULL OR expires_at > ?)"];
      const args: unknown[] = [nowTs()];
      if (category) {
        where.push("category=?");
        args.push(category);
      }
      args.push(limit);
      const sql =
        `SELECT * FROM memories WHERE ${where.join(" AND ")} ` + "ORDER BY ts_created DESC LIMIT ?";
      const rows = db.prepare(sql).all(...(args as never[])) as Record<string, unknown>[];
      return rows.map(mapMemoryRow);
    },
    forget(memoryId: number | null, tagMatch: string | null): number {
      if (memoryId !== null) {
        const result = deleteById.run(memoryId);
        return Number(result.changes ?? 0);
      }
      if (tagMatch) {
        const result = deleteByTag.run(`%${tagMatch}%`);
        return Number(result.changes ?? 0);
      }
      return 0;
    },
    markUsed(ids: number[]): void {
      if (ids.length === 0) return;
      const placeholders = ids.map(() => "?").join(",");
      db.prepare(`UPDATE memories SET ts_used=? WHERE id IN (${placeholders})`).run(
        nowTs(),
        ...(ids as never[])
      );
    },
  };
}
