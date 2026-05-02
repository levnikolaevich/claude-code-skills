import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { Context } from "grammy";
import type { Logger } from "../../lib/logger.js";
import { IMAGE_MIMES, TIMING } from "../../config/paths.js";

export type MediaKind = "image" | "document";

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

export function createMediaStore(deps: MediaStoreDeps) {
  return {
    async download(ctx: Context): Promise<DownloadedMedia | null> {
      const msg = ctx.message;
      if (!msg) return null;
      let fileId: string | null = null;
      let ext = "bin";
      let kind: MediaKind | null = null;

      if (msg.photo && msg.photo.length > 0) {
        const largest = msg.photo.at(-1);
        if (!largest) return null;
        fileId = largest.file_id;
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
      }

      if (!fileId || !kind) return null;

      mkdirSync(deps.mediaDir, { recursive: true, mode: 0o750 });
      const dest = join(deps.mediaDir, `${msg.message_id}.${ext}`);
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
        const buf = Buffer.from(await resp.arrayBuffer());
        writeFileSync(dest, buf);
      } catch (error) {
        deps.log.warn({ err: String(error), tgMsgId: msg.message_id }, "media download failed");
        return null;
      }
      return { path: dest, kind };
    },
  };
}
