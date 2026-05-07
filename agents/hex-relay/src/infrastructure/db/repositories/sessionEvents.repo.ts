import type { Db } from "../types.js";

function nowTs(): number {
  return Math.floor(Date.now() / 1000);
}

export type SessionEventsRepo = ReturnType<typeof createSessionEventsRepo>;

export function createSessionEventsRepo(db: Db) {
  const insert = db.prepare(
    "INSERT INTO session_events (session_id, ts, kind, details) VALUES (?,?,?,?)"
  );

  return {
    insert(sessionId: string, kind: string, details: unknown): void {
      let serialized: string | null;
      if (details === null || details === undefined) {
        serialized = null;
      } else if (typeof details === "string") {
        serialized = details;
      } else {
        try {
          serialized = JSON.stringify(details);
        } catch {
          serialized = "[unserializable]";
        }
      }
      insert.run(sessionId, nowTs(), kind, serialized);
    },
  };
}
