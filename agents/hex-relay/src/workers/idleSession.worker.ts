import { setTimeout as delay } from "node:timers/promises";
import type { Logger } from "../lib/logger.js";
import type { IdleSessionService } from "../services/idleSession.service.js";

export interface IdleSessionWorker {
  start(): Promise<void>;
  stop(): void;
}

export interface IdleSessionWorkerDeps {
  log: Logger;
  service: IdleSessionService;
  tickIntervalMs: number;
}

export function createIdleSessionWorker(deps: IdleSessionWorkerDeps): IdleSessionWorker {
  let running = false;
  let stopPromise: Promise<void> | null = null;

  return {
    async start() {
      if (running) return;
      running = true;
      deps.log.info({ tickIntervalMs: deps.tickIntervalMs }, "idle session worker started");
      stopPromise = (async () => {
        while (running) {
          try {
            const result = await deps.service.evaluate();
            if (result.stopped > 0 || result.skippedMidTurn > 0 || result.errors > 0) {
              deps.log.info(result, "idle session worker tick");
            } else {
              deps.log.debug(result, "idle session worker tick");
            }
          } catch (error) {
            deps.log.error({ err: String(error) }, "idle session worker iteration failed");
          }
          await delay(deps.tickIntervalMs);
        }
      })();
      await stopPromise;
    },
    stop() {
      running = false;
    },
  };
}
