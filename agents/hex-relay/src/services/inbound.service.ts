import type { Logger } from "../lib/logger.js";
import { TIMING } from "../config/paths.js";
import type { MessagesRepo } from "../infrastructure/db/repositories/messages.repo.js";
import type { OutboxService } from "./outbox.service.js";
import type { ControlLane } from "./controlLane.service.js";
import type { InboundMessage } from "../domain/message.js";
import type { VerbosityService } from "./verbosity.service.js";
import type { GodRuntimeService } from "./godRuntime.service.js";

export type InboundService = ReturnType<typeof createInboundService>;

const PERMANENT_FAILURE_MESSAGE =
  "⚠️ Не смог доставить твоё сообщение в god-session после многократных " +
  "попыток. Проверь `/dispatcher status` и отправь сообщение снова, когда " +
  "tmux восстановится.";

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
  messagesRepo: MessagesRepo;
  outboxService: OutboxService;
  controlLane: ControlLane;
  godRuntime: GodRuntimeService;
  verbosity: VerbosityService;
  reactToInbound: ReactToInbound;
}) {
  async function deliver(row: InboundMessage): Promise<void> {
    const userId = row.fromUserId ?? row.tgChatId;
    if (userId === null) {
      throw new Error(`inbound ${row.id} has no Telegram user id`);
    }
    try {
      await deps.controlLane.run("deliver_inbound", async () => {
        deps.messagesRepo.update(row.id, { status: "delivering" });
        await deps.godRuntime.ensureStarted(userId);
        await deps.godRuntime.runtimeFor(userId).pane.send(row.text);
      });
      deps.messagesRepo.update(row.id, {
        status: "delivered",
        deliveredAt: nowTs(),
        error: null,
      });
      deps.log.info({ id: row.id }, "INBOUND delivered to tmux");
      if (deps.verbosity.allows("L1") && row.tgChatId !== null && row.tgMsgId !== null) {
        try {
          await deps.reactToInbound(row.tgChatId, row.tgMsgId, {
            includeVoiceTranscribing: row.kind === "voice",
          });
        } catch (error) {
          deps.log.debug({ err: String(error) }, "L1 reaction failed (cosmetic)");
        }
      }
    } catch (error) {
      const attempts = row.attempts + 1;
      const age = nowTs() - row.ts;
      const terminal =
        attempts >= TIMING.inboundMaxAttempts
          ? "failed"
          : age > TIMING.inboundAbandonTtlSec
            ? "abandoned"
            : null;
      if (terminal) {
        deps.messagesRepo.update(row.id, {
          status: terminal,
          attempts,
          error: String(error).slice(0, 300),
        });
        if (row.tgChatId !== null) {
          deps.outboxService.enqueueReply({
            text: PERMANENT_FAILURE_MESSAGE,
            chatId: row.tgChatId,
            repliedToId: row.tgMsgId ?? null,
            sessionId: row.sessionId,
          });
        }
        deps.log.error(
          { id: row.id, terminal, err: String(error) },
          "INBOUND permanently terminal"
        );
      } else {
        const wait = backoffSeconds(attempts);
        deps.messagesRepo.update(row.id, {
          status: "queued",
          attempts,
          nextAttemptAt: nowTs() + wait,
          error: String(error).slice(0, 300),
        });
        deps.log.warn(
          { id: row.id, attempts, wait, err: String(error) },
          "INBOUND retry scheduled"
        );
      }
      throw error;
    }
  }

  async function tick(): Promise<void> {
    const due = deps.messagesRepo.selectDue(5);
    for (const row of due) {
      try {
        await deliver(row);
      } catch {
        // already logged
      }
    }
  }

  return { deliver, tick };
}
