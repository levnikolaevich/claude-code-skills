import type { Db } from "../client.js";
import type { TodoStateRow } from "../../../domain/todoState.js";
import { mapTodoRow } from "../rowMappers.js";

function nowTs(): number {
  return Math.floor(Date.now() / 1000);
}

export type TodoStateRepo = ReturnType<typeof createTodoStateRepo>;

export function createTodoStateRepo(db: Db) {
  const forSession = db.prepare(
    "SELECT session_id, task_id, status, content, active_form, updated_at " +
      "FROM todo_state WHERE session_id = ?"
  );
  const upsert = db.prepare(
    "INSERT INTO todo_state (session_id, task_id, status, content, active_form, updated_at) " +
      "VALUES (?, ?, ?, ?, ?, ?) " +
      "ON CONFLICT(session_id, task_id) DO UPDATE SET " +
      "status=excluded.status, content=excluded.content, " +
      "active_form=excluded.active_form, updated_at=excluded.updated_at"
  );

  return {
    forSession(sessionId: string): Map<string, TodoStateRow> {
      const rows = forSession.all(sessionId) as Record<string, unknown>[];
      const out = new Map<string, TodoStateRow>();
      for (const r of rows) {
        const m = mapTodoRow(r);
        out.set(m.taskId, m);
      }
      return out;
    },
    upsertMany(sessionId: string, rows: TodoStateRow[]): void {
      if (rows.length === 0) return;
      const ts = nowTs();
      const tx = db.transaction((items: TodoStateRow[]) => {
        for (const r of items) {
          upsert.run(sessionId, r.taskId, r.status, r.content, r.activeForm, r.updatedAt || ts);
        }
      });
      tx(rows);
    },
  };
}
