import { createWriteStream, mkdirSync, unlinkSync } from "node:fs";
import { once } from "node:events";
import { createHash } from "node:crypto";
import { join } from "node:path";
import type { Context } from "grammy";
import type { Logger } from "../../lib/logger.js";
import { IMAGE_MIMES, TIMING } from "../../config/paths.js";

export type MediaKind = "image" | "document" | "voice";

export interface DownloadedMedia {
  path: string;
  kind: MediaKind;
}

export interface MediaStoreDeps {
  log: Logger;
  mediaDir: string;
  botToken: string;
}

export type MediaStore = ReturnType<typeof createMediaStore>;

function sanitizeExt(raw: string | null | undefined, fallback: string): string {
  const candidate = (raw ?? "").toLowerCase();
  const cleaned = candidate.replaceAll(/[^a-z0-9]/g, "").slice(0, 8);
  return cleaned || fallback;
}

function safeToken(raw: string): string {
  const cleaned = raw.replaceAll(/[^A-Za-z0-9_.-]/g, "").slice(0, 80);
  return cleaned || createHash("sha256").update(raw).digest("hex").slice(0, 16);
}

async function writeResponseBody(resp: Response, dest: string): Promise<void> {
  if (!resp.body) throw new Error("media download response body missing");
  const reader: ReadableStreamDefaultReader<Uint8Array> = resp.body.getReader();
  const out = createWriteStream(dest, { flags: "wx", mode: 0o640 });
  let bytes = 0;
  try {
    for (;;) {
      const chunk = await reader.read();
      if (chunk.done) break;
      const value = chunk.value;
      bytes += value.byteLength;
      if (bytes > TIMING.mediaMaxBytes) {
        throw new Error(`media exceeds ${TIMING.mediaMaxBytes} bytes`);
      }
      if (!out.write(Buffer.from(value))) {
        await once(out, "drain");
      }
    }
    out.end();
    await once(out, "finish");
  } catch (error) {
    out.destroy();
    try {
      unlinkSync(dest);
    } catch {
      // Best-effort cleanup for partial downloads.
    }
    throw error;
  } finally {
    reader.releaseLock();
  }
}

export function createMediaStore(deps: MediaStoreDeps) {
  return {
    async download(ctx: Context): Promise<DownloadedMedia | null> {
      const msg = ctx.message;
      if (!msg) return null;
      let fileId: string | null = null;
      let fileUniqueId: string | null = null;
      let ext = "bin";
      let kind: MediaKind | null = null;

      if (msg.photo && msg.photo.length > 0) {
        const largest = msg.photo.at(-1);
        if (!largest) return null;
        fileId = largest.file_id;
        fileUniqueId = largest.file_unique_id;
        ext = "jpg";
        kind = "image";
      } else if (msg.document) {
        const mime = (msg.document.mime_type ?? "").toLowerCase();
        const orig = msg.document.file_name ?? "";
        const dotIdx = orig.lastIndexOf(".");
        const guessed = dotIdx === -1 ? null : orig.slice(dotIdx + 1);
        if (mime in IMAGE_MIMES) {
          ext = sanitizeExt(guessed, IMAGE_MIMES[mime] ?? "bin");
          kind = "image";
        } else {
          ext = sanitizeExt(guessed, "bin");
          kind = "document";
        }
        fileId = msg.document.file_id;
        fileUniqueId = msg.document.file_unique_id;
      } else if (msg.voice) {
        fileId = msg.voice.file_id;
        fileUniqueId = msg.voice.file_unique_id;
        ext = "oga";
        kind = "voice";
      }

      if (!fileId || !kind) return null;

      mkdirSync(deps.mediaDir, { recursive: true, mode: 0o750 });
      const fileIdentity =
        fileUniqueId ?? createHash("sha256").update(fileId).digest("hex").slice(0, 16);
      const dest = join(
        deps.mediaDir,
        `${msg.chat.id}-${msg.message_id}-${safeToken(fileIdentity)}.${ext}`
      );
      try {
        const file = await ctx.api.getFile(fileId);
        if (file.file_size && file.file_size > TIMING.mediaMaxBytes) {
          deps.log.warn({ size: file.file_size, cap: TIMING.mediaMaxBytes }, "media too big");
          return null;
        }
        if (!file.file_path) {
          deps.log.warn({ fileId }, "media getFile returned no file_path");
          return null;
        }
        const url = `https://api.telegram.org/file/bot${deps.botToken}/${file.file_path}`;
        const resp = await fetch(url);
        if (!resp.ok) {
          deps.log.warn({ status: resp.status, fileId }, "media download HTTP non-OK");
          return null;
        }
        await writeResponseBody(resp, dest);
      } catch (error) {
        deps.log.warn({ err: String(error), tgMsgId: msg.message_id }, "media download failed");
        return null;
      }
      return { path: dest, kind };
    },
  };
}
