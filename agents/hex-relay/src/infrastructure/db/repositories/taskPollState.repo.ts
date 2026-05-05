import type { Db } from "../client.js";

export interface TaskPollState {
  lastNotifiedAt: number | null;
  lastCount: number;
  updatedAt: number;
}

function nowTs(): number {
  return Math.floor(Date.now() / 1000);
}

export type TaskPollStateRepo = ReturnType<typeof createTaskPollStateRepo>;

export function createTaskPollStateRepo(db: Db) {
  const selectState = db.prepare("SELECT * FROM task_poll_state WHERE id = 1");
  const updateState = db.prepare(
    "INSERT INTO task_poll_state (id, last_notified_at, last_count, updated_at) " +
      "VALUES (1, ?, ?, ?) " +
      "ON CONFLICT(id) DO UPDATE SET " +
      "last_notified_at=excluded.last_notified_at, " +
      "last_count=excluded.last_count, " +
      "updated_at=excluded.updated_at"
  );

  return {
    get(): TaskPollState | null {
      const row = selectState.get() as Record<string, unknown> | undefined;
      if (!row) return null;
      return {
        lastNotifiedAt:
          row.last_notified_at === null || row.last_notified_at === undefined
            ? null
            : Number(row.last_notified_at),
        lastCount: Number(row.last_count),
        updatedAt: Number(row.updated_at),
      };
    },
    save(args: { lastNotifiedAt: number | null; lastCount: number }): void {
      updateState.run(args.lastNotifiedAt, args.lastCount, nowTs());
    },
  };
}
