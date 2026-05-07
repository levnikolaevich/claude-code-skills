import type { Logger } from "../lib/logger.js";
import { TIMING } from "../config/paths.js";
import { computeTodoTransitions, type TodoTransition } from "../domain/todoState.js";
import type { TodoStateRepository } from "./ports.js";

export type TodoDiffService = ReturnType<typeof createTodoDiffService>;

export function createTodoDiffService(deps: { log: Logger; repo: TodoStateRepository }) {
  function diffAndPersist(sessionId: string, todos: unknown[]): TodoTransition[] {
    if (!sessionId) return [];
    let prevMap: Map<string, { status: string }>;
    try {
      const rows = deps.repo.forSession(sessionId);
      prevMap = new Map();
      for (const [k, v] of rows) prevMap.set(k, { status: v.status });
    } catch (error) {
      deps.log.error({ err: String(error), sessionId }, "todoDiff prev fetch failed");
      return [];
    }
    const { transitions, upserts } = computeTodoTransitions(prevMap, todos, TIMING.todoTextMaxLen);
    if (upserts.length > 0) {
      try {
        deps.repo.upsertMany(sessionId, upserts);
      } catch (error) {
        deps.log.error({ err: String(error) }, "todoDiff upsert failed");
      }
    }
    return transitions;
  }

  return { diffAndPersist };
}
