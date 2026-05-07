import type { AgentKind } from "./message.js";

export interface UserBuddy {
  userId: number;
  agent: AgentKind;
  updatedAt: number;
}
