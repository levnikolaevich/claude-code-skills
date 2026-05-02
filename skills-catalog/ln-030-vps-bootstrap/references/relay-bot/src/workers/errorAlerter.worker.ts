import { setTimeout as delay } from "node:timers/promises";
import type { Bot } from "grammy";
import type { Logger } from "../lib/logger.js";
import type { GodErrorReader } from "../infrastructure/filesystem/godError.js";
import { TIMING } from "../config/paths.js";

export interface ErrorAlerterWorker {
  start(): Promise<void>;
  stop(): void;
}

export function createErrorAlerterWorker(deps: {
  log: Logger;
  bot: Bot;
  reader: GodErrorReader;
  primaryOperator: number;
}): ErrorAlerterWorker {
  let running = false;
  return {
    async start() {
      if (running) return;
      running = true;
      deps.log.info({ pollMs: TIMING.errorAlerterPollMs }, "error alerter started");
      while (running) {
        try {
          const err = deps.reader.consume();
          if (err) {
            const kind = err.kind ?? err.reason ?? "unknown";
            const snippet = JSON.stringify(err).slice(0, 300);
            try {
              await deps.bot.api.sendMessage(
                deps.primaryOperator,
                `⚠️ god-session error: *${kind}*\n\`\`\`\n${snippet}\n\`\`\``,
                { parse_mode: "Markdown" }
              );
              deps.log.info({ kind }, "alerted operator about god-session error");
            } catch (error) {
              deps.log.warn({ err: String(error) }, "error alerter sendMessage failed");
            }
          }
        } catch (error) {
          deps.log.error({ err: String(error) }, "error_alerter iteration failed");
        }
        await delay(TIMING.errorAlerterPollMs);
      }
    },
    stop() {
      running = false;
    },
  };
}
