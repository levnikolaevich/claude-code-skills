import type { Logger } from "../lib/logger.js";
import { TIMING } from "../config/paths.js";
import type { MessagesRepo } from "../infrastructure/db/repositories/messages.repo.js";
import type { OutboxService } from "../services/outbox.service.js";
import type { LocalVoiceTranscriber } from "../infrastructure/process/localVoiceTranscriber.js";
import type { InboundMessage } from "../domain/message.js";
import { buildTgPrefix } from "../domain/tgPrefix.js";
import { createWorkerLoop, type DrainableWorker } from "./workerLoop.js";

export type VoiceTranscriptionWorker = DrainableWorker;

const TRANSCRIPTION_FAILED_REPLY =
  "Local voice transcription failed. Send a text command or a shorter voice message.";

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
  if (row.tgChatId === null || row.tgMsgId === null || row.fromUserId === null) {
    reject(deps, row, "voice row missing tg identifiers");
    return;
  }
  try {
    const transcript = await deps.transcriber.transcribe(row.mediaPath);
    const prefix = buildTgPrefix({
      chatId: row.tgChatId,
      msgId: row.tgMsgId,
      userToken: String(row.fromUserId),
    });
    const queuedText = `${prefix} ${transcript.text}`;
    deps.messagesRepo.update(row.id, {
      status: "queued",
      text: queuedText,
      attempts: row.attempts + 1,
      nextAttemptAt: Math.floor(Date.now() / 1000),
      error: null,
    });
    deps.log.info({ id: row.id, len: queuedText.length }, "VOICE transcribed");
  } catch (error) {
    reject(deps, row, error);
    deps.log.warn({ id: row.id, err: String(error) }, "VOICE transcription rejected");
  }
}

export function createVoiceTranscriptionWorker(
  deps: VoiceTranscriptionDeps
): VoiceTranscriptionWorker {
  return createWorkerLoop({
    log: deps.log,
    name: "voice transcription worker",
    intervalMs: TIMING.inboundPollMs,
    async runOnce() {
      const rows = deps.messagesRepo.selectTranscribing(2);
      for (const row of rows) {
        await transcribeVoiceRow(deps, row);
      }
    },
  });
}
