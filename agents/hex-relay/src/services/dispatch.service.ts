import type {
  DispatchEndCommand,
  DispatchPhaseCommand,
  DispatchRepository,
  DispatchStartCommand,
} from "./ports.js";

export type DispatchService = ReturnType<typeof createDispatchService>;

export function createDispatchService(deps: { repo: DispatchRepository }) {
  return {
    start(args: DispatchStartCommand): number {
      return deps.repo.start(args);
    },
    phase(args: DispatchPhaseCommand): void {
      deps.repo.phase(args);
    },
    end(runId: number, args: DispatchEndCommand): void {
      deps.repo.end(runId, args);
    },
    recent(n: number) {
      return deps.repo.recent(n);
    },
  };
}
