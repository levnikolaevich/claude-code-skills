import { Composer, type Context } from "grammy";
import type { Logger } from "../../lib/logger.js";
import type {
  CapturedMedia,
  TelegramInboundCaptureService,
} from "../../services/telegramInboundCapture.service.js";
import { userTokenFromContext } from "./userToken.js";

export interface TelegramMediaDownloader {
  download(ctx: Context): Promise<CapturedMedia | null>;
}

export interface InboundDeps {
  log: Logger;
  mediaStore: TelegramMediaDownloader;
  capture: TelegramInboundCaptureService;
}

function hasUnsupportedMedia(ctx: Context): boolean {
  const m = ctx.message;
  if (!m) return false;
  return Boolean(m.audio ?? m.video ?? m.video_note ?? m.animation ?? m.sticker);
}

async function sendRejectReply(ctx: Context, text: string): Promise<void> {
  try {
    await ctx.reply(text);
  } catch {
    /* ignore */
  }
}

async function handleCaptureResult(
  deps: InboundDeps,
  ctx: Context,
  result: Awaited<ReturnType<TelegramInboundCaptureService["capture"]>>
): Promise<void> {
  if (!result.ok) {
    deps.log.error({ error: result.error }, "Telegram inbound capture failed");
    await sendRejectReply(ctx, `Failed to queue message: ${result.error.message}`);
    return;
  }
  if (result.value.kind === "rejected") await sendRejectReply(ctx, result.value.replyText);
}

export function buildInboundHandler(deps: InboundDeps): Composer<Context> {
  const c = new Composer<Context>();
  c.on("message", async (ctx) => {
    const fromUserId = ctx.from?.id;
    if (fromUserId === undefined) {
      deps.log.warn({ chatId: ctx.chat.id }, "INBOUND rejected: missing Telegram user id");
      return;
    }
    const rawText = (ctx.message.text ?? ctx.message.caption ?? "").trim();
    const baseCommand = {
      chatId: ctx.chat.id,
      messageId: ctx.message.message_id,
      fromUserId,
      rawText,
      userToken: userTokenFromContext(ctx),
      unsupportedMedia: hasUnsupportedMedia(ctx),
    };

    if (ctx.message.voice) {
      const initial = await deps.capture.capture({
        ...baseCommand,
        voice: {
          durationSec: ctx.message.voice.duration,
          fileSize: ctx.message.voice.file_size ?? null,
        },
      });
      if (!initial.ok) {
        await handleCaptureResult(deps, ctx, initial);
        return;
      }
      if (initial.value.kind === "download_media") {
        const media = await deps.mediaStore.download(ctx);
        const result = await deps.capture.capture({
          ...baseCommand,
          voice: {
            durationSec: ctx.message.voice.duration,
            fileSize: ctx.message.voice.file_size ?? null,
          },
          media,
        });
        await handleCaptureResult(deps, ctx, result);
        return;
      }
      await handleCaptureResult(deps, ctx, initial);
      return;
    }

    const media = await deps.mediaStore.download(ctx);
    const result = await deps.capture.capture({ ...baseCommand, media });
    await handleCaptureResult(deps, ctx, result);
  });
  return c;
}
