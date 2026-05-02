import { Composer, type Context } from "grammy";
import type { Logger } from "../../lib/logger.js";
import type { MessagesRepo } from "../../infrastructure/db/repositories/messages.repo.js";
import type { MediaStore } from "../../infrastructure/filesystem/mediaStore.js";

export interface InboundDeps {
  log: Logger;
  messagesRepo: MessagesRepo;
  mediaStore: MediaStore;
}

const UNSUPPORTED_MEDIA_REPLY =
  "Из media сейчас принимаются картинки (PNG/JPG/GIF/WebP) и любые документы " +
  "(PDF/DOCX/TXT/CSV/JSON/код-файлы — claude сам решит, как читать). " +
  "Голосовые/аудио/видео/стикеры — пока нет (нужна транскрипция, в работе).";

function userTag(ctx: Context): string {
  const u = ctx.from;
  if (!u) return "";
  if (u.username) return ` user=${u.username}`;
  return ` user=${u.id}`;
}

function hasUnsupportedMedia(ctx: Context): boolean {
  const m = ctx.message;
  if (!m) return false;
  return Boolean(m.voice ?? m.audio ?? m.video ?? m.video_note ?? m.animation ?? m.sticker);
}

export function buildInboundHandler(deps: InboundDeps): Composer<Context> {
  const c = new Composer<Context>();
  c.on("message", async (ctx) => {
    const text = (ctx.message.text ?? ctx.message.caption ?? "").trim();
    const media = await deps.mediaStore.download(ctx);
    if (!text && !media) {
      if (hasUnsupportedMedia(ctx)) {
        const id = deps.messagesRepo.insertRejected(
          UNSUPPORTED_MEDIA_REPLY,
          ctx.chat.id,
          ctx.message.message_id,
          "unsupported media (voice/audio/video/sticker)"
        );
        deps.log.info({ id }, "INBOUND rejected unsupported media");
        try {
          await ctx.reply(UNSUPPORTED_MEDIA_REPLY);
        } catch {
          /* ignore */
        }
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
    const id = deps.messagesRepo.insertInbound(paneText, ctx.chat.id, ctx.message.message_id);
    if (media) {
      deps.messagesRepo.update(id, { kind: media.kind });
      deps.log.info({ id, kind: media.kind, path: media.path }, "INBOUND queued media");
    } else {
      deps.log.info({ id, len: text.length }, "INBOUND queued text");
    }
  });
  return c;
}
