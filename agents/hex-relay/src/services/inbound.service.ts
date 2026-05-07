import type { Logger } from "../lib/logger.js";
import { TIMING } from "../config/paths.js";
import type { OutboxService } from "./outbox.service.js";
import type { ControlLane } from "./controlLane.service.js";
import type { InboundMessage } from "../domain/message.js";
import type { VerbosityService } from "./verbosity.service.js";
import type { GodRuntimeService } from "./godRuntime.service.js";
import type { MessagesRepository } from "./ports.js";
import { fail, ok, serviceError, type ServiceError, type ServiceOutcome } from "./outcome.js";

export type InboundService = ReturnType<typeof createInboundService>;
export type InboundError = ServiceError;

export interface InboundDeliveryResult {
  id: number;
  status: "delivered" | "retry_scheduled" | "terminal_failed" | "terminal_abandoned";
  attempts: number;
}

export interface InboundTickResult {
  selected: number;
  delivered: number;
  retryScheduled: number;
  terminal: number;
  failed: number;
}

const PERMANENT_FAILURE_MESSAGE =
  "⚠️ Failed to deliver your message to the god-session after several retries. " +
  "Check `/dispatcher status` and resend once tmux is back up.";

function nowTs(): number {
  return Math.floor(Date.now() / 1000);
}

function backoffSeconds(attempt: number): number {
  return Math.min(2 ** Math.min(attempt, 6), 60);
}

export type ReactToInbound = (
  chatId: number,
  messageId: number,
  options?: { includeVoiceTranscribing?: boolean }
) => Promise<void>;

export function createInboundService(deps: {
  log: Logger;
  messagesRepo: MessagesRepository;
  outboxService: OutboxService;
  controlLane: ControlLane;
  godRuntime: GodRuntimeService;
  verbosity: VerbosityService;
  reactToInbound: ReactToInbound;
}) {
  async function deliver(
    row: InboundMessage
  ): Promise<ServiceOutcome<InboundDeliveryResult, InboundError>> {
    const userId = row.fromUserId ?? row.tgChatId;
    if (userId === null) {
      return markTerminal(row, "failed", 1, "inbound has no Telegram user id");
    }
    try {
      await deps.controlLane.run("deliver_inbound", async () => {
        deps.messagesRepo.update(row.id, { status: "delivering" });
        const started = await deps.godRuntime.ensureStarted(userId, row.agent);
        if (!started.ok) throw new Error(started.error.message);
        const runtime = deps.godRuntime.runtimeFor(userId, row.agent);
        if (!runtime.ok) throw new Error(runtime.error.message);
        await runtime.value.pane.send(row.text);
      });
    } catch (error) {
      return scheduleDeliveryFailure(row, error);
    }

    try {
      deps.messagesRepo.update(row.id, {
        status: "delivered",
        deliveredAt: nowTs(),
        error: null,
      });
    } catch (error) {
      return fail(
        serviceError({
          code: "inbound_delivered_update_failed",
          kind: "transient",
          message: "message was sent to the god-session but delivery state could not be persisted",
          details: { id: row.id },
          cause: error,
        })
      );
    }

    deps.log.info({ id: row.id }, "INBOUND delivered to tmux");
    if (deps.verbosity.allows("L1") && row.tgChatId !== null && row.tgMsgId !== null) {
      try {
        await deps.reactToInbound(row.tgChatId, row.tgMsgId, {
          includeVoiceTranscribing: row.kind === "voice",
        });
      } catch (error) {
        deps.log.debug(
          {
            outcome: serviceError({
              code: "inbound_reaction_failed",
              kind: "transient",
              message: "L1 reaction failed",
              cause: error,
            }),
          },
          "L1 reaction failed (cosmetic)"
        );
      }
    }
    return ok({ id: row.id, status: "delivered", attempts: row.attempts });
  }

  function scheduleDeliveryFailure(
    row: InboundMessage,
    error: unknown
  ): ServiceOutcome<InboundDeliveryResult, InboundError> {
    const attempts = row.attempts + 1;
    const age = nowTs() - row.ts;
    const terminal =
      attempts >= TIMING.inboundMaxAttempts
        ? "failed"
        : age > TIMING.inboundAbandonTtlSec
          ? "abandoned"
          : null;
    if (terminal) {
      try {
        deps.messagesRepo.update(row.id, {
          status: terminal,
          attempts,
          error: String(error).slice(0, 300),
        });
      } catch (updateError) {
        return fail(
          serviceError({
            code: "inbound_terminal_update_failed",
            kind: "transient",
            message: "failed to persist terminal inbound delivery failure",
            details: { id: row.id, terminal },
            cause: updateError,
          })
        );
      }
      if (row.tgChatId !== null) {
        const reply = deps.outboxService.enqueueReply({
          text: PERMANENT_FAILURE_MESSAGE,
          chatId: row.tgChatId,
          repliedToId: row.tgMsgId ?? null,
          sessionId: row.sessionId,
        });
        if (!reply.ok) return fail(reply.error);
      }
      deps.log.error({ id: row.id, terminal, err: String(error) }, "INBOUND permanently terminal");
      return ok({
        id: row.id,
        status: terminal === "abandoned" ? "terminal_abandoned" : "terminal_failed",
        attempts,
      });
    }

    const wait = backoffSeconds(attempts);
    try {
      deps.messagesRepo.update(row.id, {
        status: "queued",
        attempts,
        nextAttemptAt: nowTs() + wait,
        error: String(error).slice(0, 300),
      });
    } catch (updateError) {
      return fail(
        serviceError({
          code: "inbound_retry_update_failed",
          kind: "transient",
          message: "failed to persist inbound retry schedule",
          details: { id: row.id, attempts },
          cause: updateError,
        })
      );
    }
    deps.log.warn({ id: row.id, attempts, wait, err: String(error) }, "INBOUND retry scheduled");
    return ok({ id: row.id, status: "retry_scheduled", attempts });
  }

  function markTerminal(
    row: InboundMessage,
    terminal: "failed" | "abandoned",
    attempts: number,
    message: string
  ): ServiceOutcome<InboundDeliveryResult, InboundError> {
    try {
      deps.messagesRepo.update(row.id, {
        status: terminal,
        attempts,
        error: message.slice(0, 300),
      });
      return ok({
        id: row.id,
        status: terminal === "abandoned" ? "terminal_abandoned" : "terminal_failed",
        attempts,
      });
    } catch (error) {
      return fail(
        serviceError({
          code: "inbound_terminal_update_failed",
          kind: "transient",
          message: "failed to mark inbound terminal",
          details: { id: row.id, terminal },
          cause: error,
        })
      );
    }
  }

  async function tick(): Promise<ServiceOutcome<InboundTickResult, InboundError>> {
    let due: InboundMessage[];
    try {
      due = deps.messagesRepo.claimDue(5);
    } catch (error) {
      return fail(
        serviceError({
          code: "inbound_claim_due_failed",
          kind: "transient",
          message: "failed to claim due inbound messages",
          cause: error,
        })
      );
    }
    const summary: InboundTickResult = {
      selected: due.length,
      delivered: 0,
      retryScheduled: 0,
      terminal: 0,
      failed: 0,
    };
    for (const row of due) {
      const result = await deliver(row);
      if (!result.ok) {
        summary.failed += 1;
        deps.log.error({ error: result.error, id: row.id }, "inbound delivery failed");
        continue;
      }
      if (result.value.status === "delivered") summary.delivered += 1;
      if (result.value.status === "retry_scheduled") summary.retryScheduled += 1;
      if (
        result.value.status === "terminal_failed" ||
        result.value.status === "terminal_abandoned"
      ) {
        summary.terminal += 1;
      }
    }
    return ok(summary);
  }

  return { deliver, tick };
}
