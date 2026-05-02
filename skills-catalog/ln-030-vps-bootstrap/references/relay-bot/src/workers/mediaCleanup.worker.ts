import { existsSync, readdirSync, statSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import type { Logger } from "../lib/logger.js";
import { TIMING } from "../config/paths.js";

export interface MediaCleanupWorker {
  start(): Promise<void>;
  stop(): void;
}

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
  let running = false;
  return {
    async start() {
      if (running) return;
      running = true;
      deps.log.info({ retentionDays: TIMING.mediaRetentionDays }, "media cleanup worker started");
      while (running) {
        await delay(msUntilNext4am());
        if (!running) break;
        try {
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
          deps.log.info(
            { deleted, days: TIMING.mediaRetentionDays },
            "media cleanup pass complete"
          );
        } catch (error) {
          deps.log.error({ err: String(error) }, "media cleanup iteration failed");
        }
      }
    },
    stop() {
      running = false;
    },
  };
}
