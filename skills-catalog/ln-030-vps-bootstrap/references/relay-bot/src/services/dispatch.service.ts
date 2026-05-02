import type {
  DispatchRepo,
  DispatchStartArgs,
  DispatchPhaseArgs,
  DispatchEndArgs,
} from "../infrastructure/db/repositories/dispatch.repo.js";

export type DispatchService = ReturnType<typeof createDispatchService>;

export function createDispatchService(deps: { repo: DispatchRepo }) {
  return {
    start(args: DispatchStartArgs): number {
      return deps.repo.start(args);
    },
    phase(args: DispatchPhaseArgs): void {
      deps.repo.phase(args);
    },
    end(runId: number, args: DispatchEndArgs): void {
      deps.repo.end(runId, args);
    },
    recent(n: number) {
      return deps.repo.recent(n);
    },
  };
}
