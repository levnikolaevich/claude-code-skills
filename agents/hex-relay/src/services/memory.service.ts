import type { MemoryAddCommand, MemoryRepository } from "./ports.js";

export type MemoryService = ReturnType<typeof createMemoryService>;

export function createMemoryService(deps: { repo: MemoryRepository }) {
  return {
    add(args: MemoryAddCommand): number {
      return deps.repo.add(args);
    },
    recent(n: number, category: string | null) {
      return deps.repo.recent(n, category);
    },
    forget(memoryId: number | null, tagMatch: string | null) {
      return deps.repo.forget(memoryId, tagMatch);
    },
    markUsed(ids: number[]) {
      deps.repo.markUsed(ids);
    },
  };
}
