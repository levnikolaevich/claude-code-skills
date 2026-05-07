import type { Bot, GrammyError } from "grammy";
import type { Logger } from "../lib/logger.js";
import type { OutboxService } from "../services/outbox.service.js";
import type { OutboxRow } from "../domain/message.js";
import { TIMING } from "../config/paths.js";
import { splitForTelegram, splitForTelegramMarkdown } from "../lib/telegramSplit.js";
import { toTelegramMarkdownV2 } from "../lib/telegramMarkdown.js";
import { createWorkerLoop, type DrainableWorker } from "./workerLoop.js";
import { recordTelegramSendFailure } from "../observability/metrics.js";

export type OutboxWorker = DrainableWorker;

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

function isParseEntityError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const e = err as { error_code?: number; description?: string };
  return (
    e.error_code === 400 &&
    typeof e.description === "string" &&
    /can't parse entities/i.test(e.description)
  );
}

function shouldApplyMarkdown(eventType: OutboxRow["eventType"]): boolean {
  return eventType === "reply" || eventType === "ack";
}

interface SendPlan {
  chunks: string[];
  parseMode: "MarkdownV2" | null;
}

function buildSendPlan(row: OutboxRow): SendPlan {
  if (!shouldApplyMarkdown(row.eventType)) {
    return { chunks: splitForTelegram(row.text, TIMING.tgMaxLen), parseMode: null };
  }
  const converted = toTelegramMarkdownV2(row.text);
  if (converted === null) {
    return { chunks: splitForTelegram(row.text, TIMING.tgMaxLen), parseMode: null };
  }
  return {
    chunks: splitForTelegramMarkdown(converted, TIMING.tgMaxLen),
    parseMode: "MarkdownV2",
  };
}

export function createOutboxWorker(deps: {
  log: Logger;
  bot: Bot;
  outbox: OutboxService;
}): OutboxWorker {
  async function sendChunks(
    row: OutboxRow,
    chunks: string[],
    parseMode: "MarkdownV2" | null
  ): Promise<number[]> {
    const sentIds: number[] = [];
    for (const chunk of chunks) {
      const options: Parameters<Bot["api"]["sendMessage"]>[2] = {};
      if (row.repliedToId !== null) {
        options.reply_parameters = { message_id: row.repliedToId };
      }
      if (parseMode === "MarkdownV2") {
        options.parse_mode = "MarkdownV2";
        options.link_preview_options = { is_disabled: true };
      }
      const sent = await deps.bot.api.sendMessage(
        row.chatId,
        chunk,
        Object.keys(options).length === 0 ? undefined : options
      );
      sentIds.push(sent.message_id);
    }
    return sentIds;
  }

  async function deliverRow(row: OutboxRow): Promise<void> {
    deps.outbox.update(row.id, { status: "sending" });
    const plan = buildSendPlan(row);
    if (shouldApplyMarkdown(row.eventType) && plan.parseMode === null) {
      deps.log.warn(
        { id: row.id, eventType: row.eventType },
        "OUTBOX MarkdownV2 conversion failed — sending raw"
      );
    }
    try {
      const sentIds = await sendChunks(row, plan.chunks, plan.parseMode);
      deps.outbox.update(row.id, {
        status: "sent",
        tgMsgId: sentIds.length > 0 ? (sentIds.at(-1) ?? null) : null,
        error: null,
      });
      deps.log.info(
        {
          id: row.id,
          chunks: plan.chunks.length,
          lastTgMsg: sentIds.at(-1) ?? null,
          parseMode: plan.parseMode,
        },
        "OUTBOX sent"
      );
      return;
    } catch (error) {
      if (isParseEntityError(error) && plan.parseMode === "MarkdownV2") {
        const preview = plan.chunks[0]?.slice(0, 120) ?? "";
        deps.log.warn(
          { id: row.id, err: String(error), preview },
          "OUTBOX MarkdownV2 parse-entity 400 — retrying as plain text"
        );
        try {
          const fallbackChunks = splitForTelegram(row.text, TIMING.tgMaxLen);
          const fallbackSentIds = await sendChunks(row, fallbackChunks, null);
          deps.outbox.update(row.id, {
            status: "sent",
            tgMsgId: fallbackSentIds.length > 0 ? (fallbackSentIds.at(-1) ?? null) : null,
            error: null,
          });
          deps.log.info(
            {
              id: row.id,
              chunks: fallbackChunks.length,
              lastTgMsg: fallbackSentIds.at(-1) ?? null,
              parseMode: null,
              fallback: "parse_entity",
            },
            "OUTBOX sent (plain fallback)"
          );
          return;
        } catch (fallbackError) {
          handleTelegramFailure(row, fallbackError);
          return;
        }
      }
      handleTelegramFailure(row, error);
    }
  }

  function handleTelegramFailure(row: OutboxRow, error: unknown): void {
    recordTelegramSendFailure();
    if (isRetryAfter(error)) {
      const retryAfter = (error.parameters?.retry_after ?? 30) + 1;
      deps.outbox.update(row.id, {
        status: "queued",
        nextAttemptAt: nowTs() + retryAfter,
        attempts: row.attempts + 1,
        error: `retry_after=${retryAfter - 1}`,
      });
      deps.log.warn({ id: row.id, retryAfter, attempts: row.attempts + 1 }, "OUTBOX flood control");
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

  return {
    ...createWorkerLoop({
      log: deps.log,
      name: "outbox worker",
      intervalMs: TIMING.outboxPollMs,
      async runOnce() {
        const rows = deps.outbox.claimDue(5);
        for (const row of rows) {
          await deliverRow(row);
        }
      },
    }),
  };
}
