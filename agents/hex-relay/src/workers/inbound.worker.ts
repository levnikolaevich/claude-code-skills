import type { Logger } from "../lib/logger.js";
import type { InboundService } from "../services/inbound.service.js";
import { TIMING } from "../config/paths.js";
import { createWorkerLoop, type DrainableWorker } from "./workerLoop.js";

export type InboundWorker = DrainableWorker;

export function createInboundWorker(deps: { log: Logger; service: InboundService }): InboundWorker {
  return createWorkerLoop({
    log: deps.log,
    name: "inbound worker",
    intervalMs: TIMING.inboundPollMs,
    async runOnce() {
      const outcome = await deps.service.tick();
      if (!outcome.ok) {
        deps.log.error({ error: outcome.error }, "inbound worker iteration failed");
      } else if (outcome.value.failed > 0) {
        deps.log.warn({ result: outcome.value }, "inbound worker completed with row failures");
      }
    },
  });
}
