import { setTimeout as delay } from "node:timers/promises";
import type { Bot, GrammyError } from "grammy";
import type { Logger } from "../lib/logger.js";
import type { OutboxService } from "../services/outbox.service.js";
import type { OutboxRow } from "../domain/message.js";
import { TIMING } from "../config/paths.js";
import { splitForTelegram } from "../lib/telegramSplit.js";

export interface OutboxWorker {
  start(): Promise<void>;
  stop(): void;
}

function nowTs(): number {
  return Math.floor(Date.now() / 1000);
}

function isRetryAfter(err: unknown): err is GrammyError & { parameters?: { retry_after: number } } {
  if (!err || typeof err !== "object") return false;
  const e = err as { error_code?: number; parameters?: { retry_after?: number } };
  return e.error_code === 429 && typeof e.parameters?.retry_after === "number";
}

function isNetworkError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const e = err as { name?: string; code?: string };
  if (e.code === "ETIMEDOUT" || e.code === "ECONNRESET" || e.code === "ENETUNREACH") return true;
  if (e.name === "AbortError") return true;
  return false;
}

export function createOutboxWorker(deps: {
  log: Logger;
  bot: Bot;
  outbox: OutboxService;
}): OutboxWorker {
  let running = false;
  let stopPromise: Promise<void> | null = null;

  async function deliverRow(row: OutboxRow): Promise<void> {
    deps.outbox.update(row.id, { status: "sending" });
    const chunks = splitForTelegram(row.text, TIMING.tgMaxLen);
    const sentIds: number[] = [];
    try {
      for (const chunk of chunks) {
        const sent = await deps.bot.api.sendMessage(
          row.chatId,
          chunk,
          row.repliedToId === null
            ? undefined
            : {
                reply_parameters: {
                  message_id: row.repliedToId,
                },
              }
        );
        sentIds.push(sent.message_id);
      }
      deps.outbox.update(row.id, {
        status: "sent",
        tgMsgId: sentIds.length > 0 ? (sentIds.at(-1) ?? null) : null,
        error: null,
      });
      deps.log.info(
        { id: row.id, chunks: chunks.length, lastTgMsg: sentIds.at(-1) ?? null },
        "OUTBOX sent"
      );
    } catch (error) {
      if (isRetryAfter(error)) {
        const retryAfter = (error.parameters?.retry_after ?? 30) + 1;
        deps.outbox.update(row.id, {
          status: "queued",
          nextAttemptAt: nowTs() + retryAfter,
          attempts: row.attempts + 1,
          error: `retry_after=${retryAfter - 1}`,
        });
        deps.log.warn(
          { id: row.id, retryAfter, attempts: row.attempts + 1 },
          "OUTBOX flood control"
        );
        return;
      }
      if (isNetworkError(error)) {
        deps.outbox.update(row.id, {
          status: "unknown",
          attempts: row.attempts + 1,
          error: `timeout/net: ${String(error)}`,
        });
        deps.log.error({ id: row.id, err: String(error) }, "OUTBOX timeout/net — unknown");
        return;
      }
      const attempts = row.attempts + 1;
      const tooOld = nowTs() - row.ts > TIMING.outboxAbandonTtlSec;
      if (attempts >= TIMING.outboxMaxAttempts || tooOld) {
        deps.outbox.update(row.id, {
          status: "abandoned",
          attempts,
          error: String(error).slice(0, 300),
        });
        deps.log.error({ id: row.id, attempts, err: String(error) }, "OUTBOX abandoned");
      } else {
        const backoff = Math.min(2 ** attempts * 5, 300);
        deps.outbox.update(row.id, {
          status: "queued",
          nextAttemptAt: nowTs() + backoff,
          attempts,
          error: String(error).slice(0, 300),
        });
        deps.log.warn(
          { id: row.id, backoff, attempts, err: String(error) },
          "OUTBOX API error — retry scheduled"
        );
      }
    }
  }

  return {
    async start() {
      if (running) return;
      running = true;
      deps.log.info({ pollMs: TIMING.outboxPollMs }, "outbox worker started");
      stopPromise = (async () => {
        while (running) {
          try {
            const rows = deps.outbox.selectDue(5);
            for (const row of rows) {
              await deliverRow(row);
            }
          } catch (error) {
            deps.log.error({ err: String(error) }, "outbox worker iteration failed");
          }
          await delay(TIMING.outboxPollMs);
        }
      })();
      await stopPromise;
    },
    stop() {
      running = false;
    },
  };
}
