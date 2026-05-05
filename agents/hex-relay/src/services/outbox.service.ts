import type { Logger } from "../lib/logger.js";
import { TokenBucket } from "../lib/tokenBucket.js";
import { TIMING } from "../config/paths.js";
import type { OutboxRepo } from "../infrastructure/db/repositories/outbox.repo.js";
import type { OutboxEventType, OutboxRow } from "../domain/message.js";
import { isStatusEvent } from "../domain/message.js";

export type OutboxService = ReturnType<typeof createOutboxService>;

export interface EnqueueArgs {
  text: string;
  chatId: number;
  repliedToId?: number | null;
  sessionId?: string | null;
  auditMsgId?: number | null;
  eventType?: OutboxEventType;
}

export function createOutboxService(deps: { outboxRepo: OutboxRepo; log: Logger }) {
  const bucket = new TokenBucket(TIMING.tokenBucketMax, TIMING.tokenBucketWindowSec * 1000);

  function enqueueStatus(args: EnqueueArgs): number | null {
    const event = args.eventType ?? "reply";
    const skipBucketed = event === "status_skill" || event === "status_todo";
    if (skipBucketed && !bucket.tryAdd(args.chatId, Date.now())) {
      deps.log.debug(
        { chatId: args.chatId, eventType: event },
        "token bucket overflow — drop status"
      );
      return null;
    }
    try {
      return deps.outboxRepo.enqueue({
        text: args.text,
        chatId: args.chatId,
        repliedToId: args.repliedToId ?? null,
        sessionId: args.sessionId ?? null,
        auditMsgId: args.auditMsgId ?? null,
        eventType: event,
      });
    } catch (error) {
      deps.log.error({ err: String(error) }, "enqueue outbox failed");
      return null;
    }
  }

  function enqueueReply(args: EnqueueArgs): number {
    return deps.outboxRepo.enqueue({
      text: args.text,
      chatId: args.chatId,
      repliedToId: args.repliedToId ?? null,
      sessionId: args.sessionId ?? null,
      auditMsgId: args.auditMsgId ?? null,
      eventType: "reply",
    });
  }

  return {
    enqueueStatus,
    enqueueReply,
    selectDue(limit = 5): OutboxRow[] {
      return deps.outboxRepo.selectDue(limit);
    },
    isStatusEvent,
    update: (...args: Parameters<typeof deps.outboxRepo.update>) => deps.outboxRepo.update(...args),
    counts: () => deps.outboxRepo.counts(),
  };
}
