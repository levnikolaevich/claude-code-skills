import type { Db } from "../types.js";
import type { AgentKind } from "../../../domain/message.js";
import type { UserBuddy } from "../../../domain/userBuddy.js";
import { mapUserBuddyRow } from "../rowMappers.js";

function nowTs(): number {
  return Math.floor(Date.now() / 1000);
}

export type UserBuddyRepo = ReturnType<typeof createUserBuddyRepo>;

export function createUserBuddyRepo(db: Db) {
  const getStmt = db.prepare("SELECT * FROM user_buddy WHERE user_id = ?");
  const setStmt = db.prepare(
    "INSERT INTO user_buddy (user_id, agent, updated_at) VALUES (?,?,?) " +
      "ON CONFLICT(user_id) DO UPDATE SET agent=excluded.agent, updated_at=excluded.updated_at"
  );
  const removeStmt = db.prepare("DELETE FROM user_buddy WHERE user_id = ?");

  return {
    get(userId: number): UserBuddy | null {
      const row = getStmt.get(userId) as Record<string, unknown> | undefined;
      return row ? mapUserBuddyRow(row) : null;
    },
    set(userId: number, agent: AgentKind): void {
      setStmt.run(userId, agent, nowTs());
    },
    remove(userId: number): void {
      removeStmt.run(userId);
    },
  };
}
