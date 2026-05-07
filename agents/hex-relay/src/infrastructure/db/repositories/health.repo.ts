import type { Db } from "../types.js";

export interface HealthSnapshotArgs {
  source: string;
  ramUsedMb: number | null;
  cpuPct: number | null;
  details: string | null;
}

function nowTs(): number {
  return Math.floor(Date.now() / 1000);
}

export type HealthRepo = ReturnType<typeof createHealthRepo>;

export function createHealthRepo(db: Db) {
  const insert = db.prepare(
    "INSERT INTO health_snapshots (ts, source, ram_used_mb, cpu_pct, details) " +
      "VALUES (?, ?, ?, ?, ?)"
  );

  return {
    insert(args: HealthSnapshotArgs): void {
      insert.run(nowTs(), args.source, args.ramUsedMb, args.cpuPct, args.details);
    },
  };
}
