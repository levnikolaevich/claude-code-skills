import { existsSync, readdirSync, statSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import type { Logger } from "../lib/logger.js";
import { TIMING } from "../config/paths.js";
import { createWorkerLoop, type DrainableWorker } from "./workerLoop.js";

export type MediaCleanupWorker = DrainableWorker;

function msUntilNext4am(): number {
  const now = new Date();
  const next = new Date(now);
  next.setHours(4, 0, 0, 0);
  if (next <= now) {
    next.setDate(next.getDate() + 1);
  }
  return next.getTime() - now.getTime();
}

export function createMediaCleanupWorker(deps: {
  log: Logger;
  mediaDir: string;
}): MediaCleanupWorker {
  return createWorkerLoop({
    log: deps.log,
    name: "media cleanup",
    intervalMs: msUntilNext4am,
    runImmediately: false,
    runOnce() {
      const cutoffMs = Date.now() - TIMING.mediaRetentionDays * 86_400 * 1000;
      let deleted = 0;
      if (existsSync(deps.mediaDir)) {
        for (const name of readdirSync(deps.mediaDir)) {
          const full = join(deps.mediaDir, name);
          try {
            const st = statSync(full);
            if (st.isFile() && st.mtimeMs < cutoffMs) {
              unlinkSync(full);
              deleted += 1;
            }
          } catch (error) {
            deps.log.warn({ err: String(error), name }, "media cleanup file failed");
          }
        }
      }
      deps.log.info({ deleted, days: TIMING.mediaRetentionDays }, "media cleanup pass complete");
    },
  });
}
