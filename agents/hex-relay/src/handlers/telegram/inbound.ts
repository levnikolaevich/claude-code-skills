import { Composer, type Context } from "grammy";
import type { Logger } from "../../lib/logger.js";
import type { MessagesRepo } from "../../infrastructure/db/repositories/messages.repo.js";
import type { MediaStore } from "../../infrastructure/filesystem/mediaStore.js";
import { TIMING } from "../../config/paths.js";

export interface InboundDeps {
  log: Logger;
  messagesRepo: MessagesRepo;
  mediaStore: MediaStore;
  voiceTranscription: "off" | "local";
  voiceMaxDurationSec: number;
  reactToVoiceTranscribing?: (chatId: number, messageId: number) => Promise<void>;
}

const UNSUPPORTED_MEDIA_REPLY =
  "Из media сейчас принимаются картинки (PNG/JPG/GIF/WebP) и любые документы " +
  "(PDF/DOCX/TXT/CSV/JSON/код-файлы — claude сам решит, как читать). " +
  "Аудио/видео/стикеры — пока нет.";
const VOICE_DISABLED_REPLY =
  "Голосовые сообщения сейчас выключены для этого relay. Включи RELAY_VOICE_TRANSCRIPTION=local.";
const VOICE_TOO_LONG_REPLY =
  "Голосовое сообщение слишком длинное для relay. Отправь короткую команду текстом или более короткий voice.";
const VOICE_DOWNLOAD_FAILED_REPLY =
  "Не смог скачать голосовое сообщение из Telegram. Попробуй отправить его ещё раз или текстом.";
const VOICE_TOO_BIG_REPLY =
  "Голосовое сообщение слишком большое для relay. Отправь короткую команду текстом или более короткий voice.";

function userTag(ctx: Context): string {
  const u = ctx.from;
  if (!u) return "";
  if (u.username) return ` user=${u.username}`;
  return ` user=${u.id}`;
}

function hasUnsupportedMedia(ctx: Context): boolean {
  const m = ctx.message;
  if (!m) return false;
  return Boolean(m.audio ?? m.video ?? m.video_note ?? m.animation ?? m.sticker);
}

async function rejectWithReply(
  ctx: Context,
  deps: InboundDeps,
  chatId: number,
  messageId: number,
  text: string,
  error: string
): Promise<void> {
  const id = deps.messagesRepo.insertRejected(text, chatId, messageId, error);
  deps.log.info({ id, error }, "INBOUND rejected");
  try {
    await ctx.reply(text);
  } catch {
    /* ignore */
  }
}

export function buildInboundHandler(deps: InboundDeps): Composer<Context> {
  const c = new Composer<Context>();
  c.on("message", async (ctx) => {
    const fromUserId = ctx.from?.id;
    if (fromUserId === undefined) {
      deps.log.warn({ chatId: ctx.chat.id }, "INBOUND rejected: missing Telegram user id");
      return;
    }
    const text = (ctx.message.text ?? ctx.message.caption ?? "").trim();
    if (ctx.message.voice) {
      if (deps.voiceTranscription !== "local") {
        await rejectWithReply(
          ctx,
          deps,
          ctx.chat.id,
          ctx.message.message_id,
          VOICE_DISABLED_REPLY,
          "voice transcription disabled"
        );
        return;
      }
      if (ctx.message.voice.duration > deps.voiceMaxDurationSec) {
        await rejectWithReply(
          ctx,
          deps,
          ctx.chat.id,
          ctx.message.message_id,
          VOICE_TOO_LONG_REPLY,
          "voice too long"
        );
        return;
      }
      if (ctx.message.voice.file_size && ctx.message.voice.file_size > TIMING.mediaMaxBytes) {
        await rejectWithReply(
          ctx,
          deps,
          ctx.chat.id,
          ctx.message.message_id,
          VOICE_TOO_BIG_REPLY,
          "voice too big"
        );
        return;
      }
      const media = await deps.mediaStore.download(ctx);
      if (!media) {
        await rejectWithReply(
          ctx,
          deps,
          ctx.chat.id,
          ctx.message.message_id,
          VOICE_DOWNLOAD_FAILED_REPLY,
          "voice download failed"
        );
        return;
      }
      const id = deps.messagesRepo.insertTranscribingVoice(
        ctx.chat.id,
        ctx.message.message_id,
        fromUserId,
        media.path
      );
      deps.log.info(
        { id, path: media.path, durationSec: ctx.message.voice.duration },
        "INBOUND queued voice transcription"
      );
      if (deps.reactToVoiceTranscribing) {
        try {
          await deps.reactToVoiceTranscribing(ctx.chat.id, ctx.message.message_id);
        } catch (error) {
          deps.log.debug({ err: String(error) }, "voice transcribing reaction failed (cosmetic)");
        }
      }
      return;
    }
    const media = await deps.mediaStore.download(ctx);
    if (!text && !media) {
      if (hasUnsupportedMedia(ctx)) {
        await rejectWithReply(
          ctx,
          deps,
          ctx.chat.id,
          ctx.message.message_id,
          UNSUPPORTED_MEDIA_REPLY,
          "unsupported media"
        );
      }
      return;
    }
    const tag = userTag(ctx);
    let body: string;
    if (media) {
      const marker = `[${media.kind}: ${media.path}]`;
      body = text ? `${marker} ${text}` : `${marker} (no caption)`;
    } else {
      body = text;
    }
    const paneText = `[tg id=${ctx.chat.id}:${ctx.message.message_id}${tag}] ${body}`;
    const id = deps.messagesRepo.insertInbound(
      paneText,
      ctx.chat.id,
      ctx.message.message_id,
      fromUserId
    );
    if (media) {
      deps.messagesRepo.update(id, { kind: media.kind });
      deps.log.info({ id, kind: media.kind, path: media.path }, "INBOUND queued media");
    } else {
      deps.log.info({ id, len: text.length }, "INBOUND queued text");
    }
  });
  return c;
}
