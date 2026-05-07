import type { Logger } from "../lib/logger.js";
import type { IdleSessionService } from "../services/idleSession.service.js";
import { createWorkerLoop, type DrainableWorker } from "./workerLoop.js";

export type IdleSessionWorker = DrainableWorker;

export interface IdleSessionWorkerDeps {
  log: Logger;
  service: IdleSessionService;
  tickIntervalMs: number;
}

export function createIdleSessionWorker(deps: IdleSessionWorkerDeps): IdleSessionWorker {
  return createWorkerLoop({
    log: deps.log,
    name: "idle session worker",
    intervalMs: deps.tickIntervalMs,
    async runOnce() {
      const result = await deps.service.evaluate();
      if (result.stopped > 0 || result.skippedMidTurn > 0 || result.errors > 0) {
        deps.log.info(result, "idle session worker tick");
      } else {
        deps.log.debug(result, "idle session worker tick");
      }
    },
  });
}
