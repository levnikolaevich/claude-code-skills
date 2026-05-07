import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readdirSync } from "node:fs";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import pino from "pino";
import type { Context } from "grammy";
import { TIMING } from "../src/config/paths.js";
import { createMediaStore } from "../src/infrastructure/filesystem/mediaStore.js";
import type { Logger } from "../src/lib/logger.js";

const log = pino({ enabled: false }) as Logger;

function imageContext(chatId: number, messageId: number, fileId: string, fileUniqueId?: string) {
  return {
    message: {
      message_id: messageId,
      chat: { id: chatId },
      photo: [{ file_id: fileId, file_unique_id: fileUniqueId ?? fileId }],
    },
    api: {
      getFile: async () => ({ file_path: `${fileId}.jpg` }),
    },
  } as unknown as Context;
}

function responseFromBytes(bytes: Uint8Array): Response {
  return new Response(
    new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(bytes);
        controller.close();
      },
    })
  );
}

test("media download writes distinct paths for same message id in different chats", async () => {
  const dir = await mkdtemp(join(tmpdir(), "hex-relay-media-"));
  const previousFetch = globalThis.fetch;
  globalThis.fetch = async () => responseFromBytes(new TextEncoder().encode("image-bytes"));
  try {
    const store = createMediaStore({ log, mediaDir: dir, botToken: "token" });
    const first = await store.download(imageContext(10, 42, "file-a", "unique-a"));
    const second = await store.download(imageContext(20, 42, "file-b", "unique-b"));

    assert.ok(first);
    assert.ok(second);
    assert.notEqual(first!.path, second!.path);
    assert.ok(first!.path.endsWith("10-42-unique-a.jpg"));
    assert.ok(second!.path.endsWith("20-42-unique-b.jpg"));
    assert.ok(existsSync(first!.path));
    assert.ok(existsSync(second!.path));
  } finally {
    globalThis.fetch = previousFetch;
  }
});

test("media download aborts oversized streams and removes partial file", async () => {
  const dir = await mkdtemp(join(tmpdir(), "hex-relay-media-"));
  const previousFetch = globalThis.fetch;
  const previousCap = TIMING.mediaMaxBytes;
  (TIMING as { mediaMaxBytes: number }).mediaMaxBytes = 8;
  globalThis.fetch = async () => responseFromBytes(new Uint8Array(16));
  try {
    const store = createMediaStore({ log, mediaDir: dir, botToken: "token" });
    const result = await store.download(imageContext(10, 99, "oversized", "oversized"));

    assert.equal(result, null);
    assert.deepEqual(readdirSync(dir), []);
  } finally {
    (TIMING as { mediaMaxBytes: number }).mediaMaxBytes = previousCap;
    globalThis.fetch = previousFetch;
  }
});
