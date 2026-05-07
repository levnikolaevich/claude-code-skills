import { TIMING } from "../config/paths.js";
import { type AgentKind, DEFAULT_AGENT, type MessageKind } from "../domain/message.js";
import { buildTgPrefix } from "../domain/tgPrefix.js";
import type { Logger } from "../lib/logger.js";
import type { UserBuddyService } from "./userBuddy.service.js";
import type { TelegramInboundMessagesRepository } from "./ports.js";

export const UNSUPPORTED_MEDIA_REPLY =
  "Supported media: images (PNG/JPG/GIF/WebP) and any document " +
  "(PDF/DOCX/TXT/CSV/JSON/code — the agent decides how to read it). " +
  "Audio/video/stickers are not supported yet.";
export const VOICE_DISABLED_REPLY =
  "Voice messages are disabled for this relay. Set RELAY_VOICE_TRANSCRIPTION=local to enable.";
export const VOICE_TOO_LONG_REPLY =
  "Voice message exceeds the relay duration limit. Send a shorter voice or a text command.";
export const VOICE_DOWNLOAD_FAILED_REPLY =
  "Failed to download the voice message from Telegram. Send it again or use text.";
export const VOICE_TOO_BIG_REPLY =
  "Voice message exceeds the relay size limit. Send a shorter voice or a text command.";

const AGENT_PREFIX_RE = /^@(claude|codex)\b\s*/i;

export interface CapturedMedia {
  path: string;
  kind: MessageKind;
}

export interface CapturedVoice {
  durationSec: number;
  fileSize: number | null;
}

export interface TelegramInboundCaptureCommand {
  chatId: number;
  messageId: number;
  fromUserId: number;
  rawText: string;
  userToken: string | null;
  unsupportedMedia: boolean;
  voice?: CapturedVoice;
  media?: CapturedMedia | null;
}

export type TelegramInboundCaptureResult =
  | { kind: "queued"; id: number }
  | { kind: "ignored" }
  | { kind: "download_media" }
  | { kind: "rejected"; id: number; replyText: string };

export interface TelegramInboundCaptureDeps {
  log: Logger;
  messagesRepo: TelegramInboundMessagesRepository;
  userBuddy: UserBuddyService;
  voiceTranscription: "off" | "local";
  voiceMaxDurationSec: number;
  reactToVoiceTranscribing?: (chatId: number, messageId: number) => Promise<void>;
}

export type TelegramInboundCaptureService = ReturnType<typeof createTelegramInboundCaptureService>;

function extractAgent(
  rawText: string,
  defaultAgent: AgentKind
): { agent: AgentKind; cleanedText: string } {
  const match = AGENT_PREFIX_RE.exec(rawText);
  if (!match) return { agent: defaultAgent, cleanedText: rawText };
  const tag: AgentKind = match[1]?.toLowerCase() === "codex" ? "codex" : "claude";
  const cleanedText = rawText.slice(match[0].length).trimStart();
  return { agent: tag, cleanedText };
}

export function createTelegramInboundCaptureService(deps: TelegramInboundCaptureDeps) {
  function reject(args: {
    text: string;
    chatId: number;
    messageId: number;
    error: string;
    agent?: AgentKind;
  }): TelegramInboundCaptureResult {
    const id = deps.messagesRepo.insertRejected(
      args.text,
      args.chatId,
      args.messageId,
      args.error,
      args.agent
    );
    deps.log.info({ id, error: args.error }, "INBOUND rejected");
    return { kind: "rejected", id, replyText: args.text };
  }

  async function capture(
    command: TelegramInboundCaptureCommand
  ): Promise<TelegramInboundCaptureResult> {
    const rawText = command.rawText.trim();
    const defaultAgent = deps.userBuddy.getDefault(command.fromUserId) ?? DEFAULT_AGENT;
    const { agent, cleanedText } = extractAgent(rawText, defaultAgent);
    const text = cleanedText;

    if (command.voice) {
      if (deps.voiceTranscription !== "local") {
        return reject({
          text: VOICE_DISABLED_REPLY,
          chatId: command.chatId,
          messageId: command.messageId,
          error: "voice transcription disabled",
          agent,
        });
      }
      if (command.voice.durationSec > deps.voiceMaxDurationSec) {
        return reject({
          text: VOICE_TOO_LONG_REPLY,
          chatId: command.chatId,
          messageId: command.messageId,
          error: "voice too long",
          agent,
        });
      }
      if (command.voice.fileSize !== null && command.voice.fileSize > TIMING.mediaMaxBytes) {
        return reject({
          text: VOICE_TOO_BIG_REPLY,
          chatId: command.chatId,
          messageId: command.messageId,
          error: "voice too big",
          agent,
        });
      }
      if (command.media === undefined) return { kind: "download_media" };
      if (!command.media) {
        return reject({
          text: VOICE_DOWNLOAD_FAILED_REPLY,
          chatId: command.chatId,
          messageId: command.messageId,
          error: "voice download failed",
          agent,
        });
      }
      const id = deps.messagesRepo.insertTranscribingVoice(
        command.chatId,
        command.messageId,
        command.fromUserId,
        command.media.path,
        agent
      );
      deps.log.info(
        { id, path: command.media.path, durationSec: command.voice.durationSec },
        "INBOUND queued voice transcription"
      );
      if (deps.reactToVoiceTranscribing) {
        try {
          await deps.reactToVoiceTranscribing(command.chatId, command.messageId);
        } catch (error) {
          deps.log.debug({ err: String(error) }, "voice transcribing reaction failed (cosmetic)");
        }
      }
      return { kind: "queued", id };
    }

    const media = command.media ?? null;
    if (!text && !media) {
      if (command.unsupportedMedia) {
        return reject({
          text: UNSUPPORTED_MEDIA_REPLY,
          chatId: command.chatId,
          messageId: command.messageId,
          error: "unsupported media",
          agent,
        });
      }
      return { kind: "ignored" };
    }

    const body = media ? `[${media.kind}: ${media.path}] ${text || "(no caption)"}` : text;
    const paneText = `${buildTgPrefix({
      chatId: command.chatId,
      msgId: command.messageId,
      userToken: command.userToken,
    })} ${body}`;
    const id = deps.messagesRepo.insertInbound(
      paneText,
      command.chatId,
      command.messageId,
      command.fromUserId,
      agent
    );
    if (media) {
      deps.messagesRepo.update(id, { kind: media.kind });
      deps.log.info({ id, kind: media.kind, path: media.path }, "INBOUND queued media");
    } else {
      deps.log.info({ id, len: text.length }, "INBOUND queued text");
    }
    return { kind: "queued", id };
  }

  return { capture };
}
