import { setTimeout as delay } from "node:timers/promises";
import type { Logger } from "../lib/logger.js";
import type { InboundService } from "../services/inbound.service.js";
import { TIMING } from "../config/paths.js";

export interface InboundWorker {
  start(): Promise<void>;
  stop(): void;
}

export function createInboundWorker(deps: { log: Logger; service: InboundService }): InboundWorker {
  let running = false;
  let stopPromise: Promise<void> | null = null;

  return {
    async start() {
      if (running) return;
      running = true;
      deps.log.info({ pollMs: TIMING.inboundPollMs }, "inbound worker started");
      stopPromise = (async () => {
        while (running) {
          try {
            await deps.service.tick();
          } catch (error) {
            deps.log.error({ err: String(error) }, "inbound worker iteration failed");
          }
          await delay(TIMING.inboundPollMs);
        }
      })();
      await stopPromise;
    },
    stop() {
      running = false;
    },
  };
}
