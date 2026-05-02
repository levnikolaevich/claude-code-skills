import type { Logger } from "../lib/logger.js";
import { TIMING } from "../config/paths.js";
import type { MessagesRepo } from "../infrastructure/db/repositories/messages.repo.js";
import type { OutboxService } from "./outbox.service.js";
import type { ControlLane } from "./controlLane.service.js";
import type { TmuxPane } from "../infrastructure/tmux/pane.js";
import type { InboundMessage } from "../domain/message.js";
import type { VerbosityService } from "./verbosity.service.js";

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

export type ReactToInbound = (chatId: number, messageId: number) => Promise<void>;

export function createInboundService(deps: {
  log: Logger;
  messagesRepo: MessagesRepo;
  outboxService: OutboxService;
  controlLane: ControlLane;
  pane: TmuxPane;
  verbosity: VerbosityService;
  reactToInbound: ReactToInbound;
}) {
  async function deliver(row: InboundMessage): Promise<void> {
    try {
      await deps.controlLane.run("deliver_inbound", async () => {
        deps.messagesRepo.update(row.id, { status: "delivering" });
        await deps.pane.send(row.text);
      });
      deps.messagesRepo.update(row.id, {
        status: "delivered",
        deliveredAt: nowTs(),
        error: null,
      });
      deps.log.info({ id: row.id }, "INBOUND delivered to tmux");
      if (deps.verbosity.allows("L1") && row.tgChatId !== null && row.tgMsgId !== null) {
        try {
          await deps.reactToInbound(row.tgChatId, row.tgMsgId);
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
    const ready = await deps.pane.hasSession();
    if (!ready) return;
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
