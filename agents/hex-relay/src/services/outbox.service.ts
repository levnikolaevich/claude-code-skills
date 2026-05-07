import type { Logger } from "../lib/logger.js";
import { TokenBucket } from "../lib/tokenBucket.js";
import { TIMING } from "../config/paths.js";
import type { OutboxEventType, OutboxRow, AgentKind } from "../domain/message.js";
import { isStatusEvent, DEFAULT_AGENT } from "../domain/message.js";
import type { OutboxRepository } from "./ports.js";
import { fail, ok, serviceError, type ServiceError, type ServiceOutcome } from "./outcome.js";

export type OutboxService = ReturnType<typeof createOutboxService>;
export type OutboxError = ServiceError;

export interface OutboxEnqueueRequest {
  text: string;
  chatId: number;
  repliedToId?: number | null;
  sessionId?: string | null;
  auditMsgId?: number | null;
  eventType?: OutboxEventType;
  agent?: AgentKind;
}

export function createOutboxService(deps: { outboxRepo: OutboxRepository; log: Logger }) {
  const bucket = new TokenBucket(TIMING.tokenBucketMax, TIMING.tokenBucketWindowSec * 1000);

  function enqueueStatus(args: OutboxEnqueueRequest): ServiceOutcome<number, OutboxError> {
    const event = args.eventType ?? "reply";
    const skipBucketed = event === "status_skill" || event === "status_todo";
    if (skipBucketed && !bucket.tryAdd(args.chatId, Date.now())) {
      deps.log.debug(
        { chatId: args.chatId, eventType: event },
        "token bucket overflow — drop status"
      );
      return fail(
        serviceError({
          code: "outbox_rate_limited",
          kind: "rate_limited",
          message: "outbox status event was rate limited",
          details: { chatId: args.chatId, eventType: event },
        })
      );
    }
    try {
      return ok(
        deps.outboxRepo.enqueue({
          text: args.text,
          chatId: args.chatId,
          repliedToId: args.repliedToId ?? null,
          sessionId: args.sessionId ?? null,
          auditMsgId: args.auditMsgId ?? null,
          eventType: event,
          agent: args.agent ?? DEFAULT_AGENT,
        })
      );
    } catch (error) {
      deps.log.error({ err: String(error) }, "enqueue outbox failed");
      return fail(
        serviceError({
          code: "outbox_enqueue_failed",
          kind: "transient",
          message: "failed to enqueue outbox event",
          details: { chatId: args.chatId, eventType: event },
          cause: error,
        })
      );
    }
  }

  function enqueueReply(args: OutboxEnqueueRequest): ServiceOutcome<number, OutboxError> {
    try {
      return ok(
        deps.outboxRepo.enqueue({
          text: args.text,
          chatId: args.chatId,
          repliedToId: args.repliedToId ?? null,
          sessionId: args.sessionId ?? null,
          auditMsgId: args.auditMsgId ?? null,
          eventType: "reply",
          agent: args.agent ?? DEFAULT_AGENT,
        })
      );
    } catch (error) {
      return fail(
        serviceError({
          code: "outbox_reply_enqueue_failed",
          kind: "transient",
          message: "failed to enqueue reply",
          details: { chatId: args.chatId },
          cause: error,
        })
      );
    }
  }

  function enqueueAck(args: OutboxEnqueueRequest): ServiceOutcome<number, OutboxError> {
    try {
      return ok(
        deps.outboxRepo.enqueue({
          text: args.text,
          chatId: args.chatId,
          repliedToId: args.repliedToId ?? null,
          sessionId: args.sessionId ?? null,
          auditMsgId: args.auditMsgId ?? null,
          eventType: "ack",
          agent: args.agent ?? DEFAULT_AGENT,
        })
      );
    } catch (error) {
      return fail(
        serviceError({
          code: "outbox_ack_enqueue_failed",
          kind: "transient",
          message: "failed to enqueue acknowledgement",
          details: { chatId: args.chatId },
          cause: error,
        })
      );
    }
  }

  return {
    enqueueStatus,
    enqueueReply,
    enqueueAck,
    selectDue(limit = 5): OutboxRow[] {
      return deps.outboxRepo.selectDue(limit);
    },
    claimDue(limit = 5): OutboxRow[] {
      return deps.outboxRepo.claimDue(limit);
    },
    isStatusEvent,
    update: (...args: Parameters<typeof deps.outboxRepo.update>) => deps.outboxRepo.update(...args),
    counts: () => deps.outboxRepo.counts(),
  };
}
