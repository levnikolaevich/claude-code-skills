import { setTimeout as delay } from "node:timers/promises";
import type { Logger } from "../lib/logger.js";
import { TIMING } from "../config/paths.js";
import type { MessagesRepo } from "../infrastructure/db/repositories/messages.repo.js";
import type { OutboxService } from "../services/outbox.service.js";
import type { LocalVoiceTranscriber } from "../infrastructure/process/localVoiceTranscriber.js";
import type { InboundMessage } from "../domain/message.js";

export interface VoiceTranscriptionWorker {
  start(): Promise<void>;
  stop(): void;
}

const TRANSCRIPTION_FAILED_REPLY =
  "Не смог распознать голосовое сообщение локально. Отправь команду текстом или попробуй короче.";

function shortError(error: unknown): string {
  return String(error).slice(0, 300);
}

export interface VoiceTranscriptionDeps {
  log: Logger;
  messagesRepo: MessagesRepo;
  outbox: OutboxService;
  transcriber: LocalVoiceTranscriber | null;
}

function reject(deps: VoiceTranscriptionDeps, row: InboundMessage, error: unknown): void {
  deps.messagesRepo.update(row.id, {
    status: "rejected",
    attempts: row.attempts + 1,
    error: shortError(error),
  });
  if (row.tgChatId !== null) {
    deps.outbox.enqueueReply({
      text: TRANSCRIPTION_FAILED_REPLY,
      chatId: row.tgChatId,
      repliedToId: row.tgMsgId,
      sessionId: row.sessionId,
    });
  }
}

export async function transcribeVoiceRow(
  deps: VoiceTranscriptionDeps,
  row: InboundMessage
): Promise<void> {
  if (!deps.transcriber) {
    reject(deps, row, "voice transcription is disabled");
    return;
  }
  if (!row.mediaPath) {
    reject(deps, row, "voice media_path missing");
    return;
  }
  try {
    const transcript = await deps.transcriber.transcribe(row.mediaPath);
    deps.messagesRepo.update(row.id, {
      status: "queued",
      text: transcript.text,
      attempts: row.attempts + 1,
      nextAttemptAt: Math.floor(Date.now() / 1000),
      error: null,
    });
    deps.log.info({ id: row.id, len: transcript.text.length }, "VOICE transcribed");
  } catch (error) {
    reject(deps, row, error);
    deps.log.warn({ id: row.id, err: String(error) }, "VOICE transcription rejected");
  }
}

export function createVoiceTranscriptionWorker(
  deps: VoiceTranscriptionDeps
): VoiceTranscriptionWorker {
  let running = false;
  let stopPromise: Promise<void> | null = null;

  return {
    async start() {
      if (running) return;
      running = true;
      deps.log.info({ pollMs: TIMING.inboundPollMs }, "voice transcription worker started");
      stopPromise = (async () => {
        while (running) {
          try {
            const rows = deps.messagesRepo.selectTranscribing(2);
            for (const row of rows) {
              await transcribeVoiceRow(deps, row);
            }
          } catch (error) {
            deps.log.error({ err: String(error) }, "voice transcription worker iteration failed");
          }
          await delay(TIMING.inboundPollMs);
        }
      })();
      await stopPromise;
    },
    stop() {
      running = false;
    },
  };
}
