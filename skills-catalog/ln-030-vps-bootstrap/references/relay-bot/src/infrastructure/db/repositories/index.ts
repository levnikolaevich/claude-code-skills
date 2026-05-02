import type { Db } from "../client.js";
import { createMessagesRepo, type MessagesRepo } from "./messages.repo.js";
import { createPendingReplyRepo, type PendingReplyRepo } from "./pendingReply.repo.js";
import { createOutboxRepo, type OutboxRepo } from "./outbox.repo.js";
import { createSessionsRepo, type SessionsRepo } from "./sessions.repo.js";
import { createSessionEventsRepo, type SessionEventsRepo } from "./sessionEvents.repo.js";
import { createDispatchRepo, type DispatchRepo } from "./dispatch.repo.js";
import { createMemoryRepo, type MemoryRepo } from "./memory.repo.js";
import { createUsersRepo, type UsersRepo } from "./users.repo.js";
import { createTodoStateRepo, type TodoStateRepo } from "./todoState.repo.js";
import { createHealthRepo, type HealthRepo } from "./health.repo.js";

export interface Repositories {
  messages: MessagesRepo;
  pendingReply: PendingReplyRepo;
  outbox: OutboxRepo;
  sessions: SessionsRepo;
  sessionEvents: SessionEventsRepo;
  dispatch: DispatchRepo;
  memory: MemoryRepo;
  users: UsersRepo;
  todoState: TodoStateRepo;
  health: HealthRepo;
}

export function createRepositories(db: Db): Repositories {
  return {
    messages: createMessagesRepo(db),
    pendingReply: createPendingReplyRepo(db),
    outbox: createOutboxRepo(db),
    sessions: createSessionsRepo(db),
    sessionEvents: createSessionEventsRepo(db),
    dispatch: createDispatchRepo(db),
    memory: createMemoryRepo(db),
    users: createUsersRepo(db),
    todoState: createTodoStateRepo(db),
    health: createHealthRepo(db),
  };
}
