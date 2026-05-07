import type { AgentKind } from "../domain/message.js";
import { DEFAULT_AGENT } from "../domain/message.js";
import type { UserBuddyRepo } from "../infrastructure/db/repositories/userBuddy.repo.js";

export type UserBuddyService = ReturnType<typeof createUserBuddyService>;

export function createUserBuddyService(deps: { repo: UserBuddyRepo }) {
  return {
    getDefault(userId: number): AgentKind {
      return deps.repo.get(userId)?.agent ?? DEFAULT_AGENT;
    },
    setDefault(userId: number, agent: AgentKind): void {
      deps.repo.set(userId, agent);
    },
    clear(userId: number): void {
      deps.repo.remove(userId);
    },
  };
}
