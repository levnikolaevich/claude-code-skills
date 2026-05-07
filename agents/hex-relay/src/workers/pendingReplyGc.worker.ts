import type { Logger } from "../lib/logger.js";
import type { PendingReplyRepo } from "../infrastructure/db/repositories/pendingReply.repo.js";
import type { MessagesRepo } from "../infrastructure/db/repositories/messages.repo.js";
import type { OutboxService } from "../services/outbox.service.js";
import { createWorkerLoop } from "./workerLoop.js";

export interface PendingReplyGcWorker {
  start(): Promise<void>;
  stop(): Promise<void>;
  /** Visible for tests: run a single GC pass and return how many rows were retired. */
  evaluate(): { retired: number; skippedNoInbound: number; errors: number };
}

export interface PendingReplyGcDeps {
  log: Logger;
  pendingRepo: PendingReplyRepo;
  messagesRepo: MessagesRepo;
  outbox: OutboxService;
  primaryOperator: number;
  retentionSec: number;
  tickIntervalMs: number;
}

export function createPendingReplyGcWorker(deps: PendingReplyGcDeps): PendingReplyGcWorker {
  function evaluate(): { retired: number; skippedNoInbound: number; errors: number } {
    const result = { retired: 0, skippedNoInbound: 0, errors: 0 };
    const stale = deps.pendingRepo.findStaleOlderThan(deps.retentionSec);
    for (const row of stale) {
      try {
        const inbound = deps.messagesRepo.findById(row.inboundMsgId);
        const ageSec = Math.floor(Date.now() / 1000) - row.createdAt;
        if (!inbound) {
          deps.pendingRepo.deleteOne(row.sessionId, row.inboundMsgId);
          result.skippedNoInbound += 1;
          deps.log.warn(
            { sessionId: row.sessionId, inboundMsgId: row.inboundMsgId, ageSec },
            "pending-reply gc: inbound row missing — purged silently"
          );
          continue;
        }
        const chatId = inbound.tgChatId ?? deps.primaryOperator;
        const repliedToId = inbound.tgMsgId ?? null;
        const text =
          `⚠️ Ответ потерян (timeout ${deps.retentionSec}s). ` +
          `Сессия \`${row.sessionId.slice(0, 8)}\`, агент \`${row.agent}\`. ` +
          `Open turn выкинут из очереди.`;
        deps.outbox.enqueueAck({
          text,
          chatId,
          repliedToId,
          sessionId: row.sessionId,
          agent: row.agent,
        });
        deps.pendingRepo.deleteOne(row.sessionId, row.inboundMsgId);
        result.retired += 1;
        deps.log.warn(
          {
            sessionId: row.sessionId,
            inboundMsgId: row.inboundMsgId,
            agent: row.agent,
            ageSec,
            retentionSec: deps.retentionSec,
          },
          "pending-reply gc: stale row retired"
        );
      } catch (error) {
        result.errors += 1;
        deps.log.error(
          { err: String(error), sessionId: row.sessionId, inboundMsgId: row.inboundMsgId },
          "pending-reply gc: row retire failed"
        );
      }
    }
    return result;
  }

  const loop = createWorkerLoop({
    log: deps.log,
    name: "pending-reply gc",
    intervalMs: deps.tickIntervalMs,
    runOnce() {
      const result = evaluate();
      if (result.retired > 0 || result.skippedNoInbound > 0 || result.errors > 0) {
        deps.log.info(result, "pending-reply gc tick");
      } else {
        deps.log.debug(result, "pending-reply gc tick");
      }
    },
  });

  return {
    evaluate,
    async start() {
      deps.log.info(
        { retentionSec: deps.retentionSec, tickIntervalMs: deps.tickIntervalMs },
        "pending-reply gc worker started"
      );
      await loop.start();
    },
    stop: () => loop.stop(),
  };
}
