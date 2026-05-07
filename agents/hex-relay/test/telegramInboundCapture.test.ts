import { test } from "node:test";
import assert from "node:assert/strict";
import pino from "pino";
import { TIMING } from "../src/config/paths.js";
import type { AgentKind } from "../src/domain/message.js";
import type { Logger } from "../src/lib/logger.js";
import {
  createTelegramInboundCaptureService,
  UNSUPPORTED_MEDIA_REPLY,
  VOICE_DISABLED_REPLY,
  VOICE_DOWNLOAD_FAILED_REPLY,
  VOICE_TOO_BIG_REPLY,
  VOICE_TOO_LONG_REPLY,
} from "../src/services/telegramInboundCapture.service.js";

const log = pino({ enabled: false }) as Logger;

function noop(): void {
  return;
}

function unwrap<T>(outcome: { ok: true; value: T } | { ok: false; error: { message: string } }): T {
  if (!outcome.ok) throw new Error(outcome.error.message);
  return outcome.value;
}

function createService(
  defaults = new Map<number, AgentKind>(),
  voiceTranscription: "off" | "local" = "local"
) {
  const state = {
    inbound: [] as Record<string, unknown>[],
    rejected: [] as Record<string, unknown>[],
    voice: [] as Record<string, unknown>[],
    updates: [] as unknown[],
    reactions: [] as unknown[],
  };
  const service = createTelegramInboundCaptureService({
    log,
    messagesRepo: {
      insertRejected: (text, tgChatId, tgMsgId, error, agent) => {
        const id = state.rejected.length + 1;
        state.rejected.push({ id, text, tgChatId, tgMsgId, error, agent });
        return id;
      },
      insertTranscribingVoice: (tgChatId, tgMsgId, fromUserId, mediaPath, agent) => {
        const id = state.voice.length + 10;
        state.voice.push({ id, tgChatId, tgMsgId, fromUserId, mediaPath, agent });
        return id;
      },
      insertInbound: (text, tgChatId, tgMsgId, fromUserId, agent) => {
        const id = state.inbound.length + 20;
        state.inbound.push({ id, text, tgChatId, tgMsgId, fromUserId, agent });
        return id;
      },
      update: (...args: unknown[]) => state.updates.push(args),
    },
    userBuddy: {
      getDefault: (userId: number) => defaults.get(userId) ?? null,
      setDefault: noop,
      clearDefault: noop,
    },
    voiceTranscription,
    voiceMaxDurationSec: 60,
    reactToVoiceTranscribing: async (chatId, messageId) => {
      state.reactions.push([chatId, messageId]);
    },
  } as any);
  return { service, state };
}

test("captures text inbound with user buddy default and codex override", async () => {
  const { service, state } = createService(new Map([[7, "codex"]]));

  await service.capture({
    chatId: 10,
    messageId: 20,
    fromUserId: 7,
    rawText: "hello",
    userToken: "alice",
    unsupportedMedia: false,
    media: null,
  });
  await service.capture({
    chatId: 11,
    messageId: 21,
    fromUserId: 8,
    rawText: "@codex help",
    userToken: "bob",
    unsupportedMedia: false,
    media: null,
  });

  assert.equal(state.inbound[0]?.agent, "codex");
  assert.match(String(state.inbound[0]?.text), /^\[tg id=10:20 user=alice\] hello$/);
  assert.equal(state.inbound[1]?.agent, "codex");
  assert.match(String(state.inbound[1]?.text), /^\[tg id=11:21 user=bob\] help$/);
});

test("captures media inbound and updates media kind", async () => {
  const { service, state } = createService();

  const result = unwrap(
    await service.capture({
      chatId: 10,
      messageId: 22,
      fromUserId: 7,
      rawText: "caption",
      userToken: null,
      unsupportedMedia: false,
      media: { kind: "document", path: "/tmp/file.pdf" },
    })
  );

  assert.equal(result.kind, "queued");
  assert.match(String(state.inbound[0]?.text), /\[document: \/tmp\/file\.pdf\] caption$/);
  assert.deepEqual(state.updates[0], [20, { kind: "document" }]);
});

test("rejects unsupported media without text or supported media", async () => {
  const { service, state } = createService();

  const result = unwrap(
    await service.capture({
      chatId: 10,
      messageId: 23,
      fromUserId: 7,
      rawText: "",
      userToken: null,
      unsupportedMedia: true,
      media: null,
    })
  );

  assert.equal(result.kind, "rejected");
  assert.equal(state.rejected[0]?.text, UNSUPPORTED_MEDIA_REPLY);
  assert.equal(state.rejected[0]?.error, "unsupported media");
});

test("rejects voice disabled, too long, too big, and download failed", async () => {
  const off = createService(new Map(), "off");

  const disabledResult = unwrap(
    await off.service.capture({
      chatId: 1,
      messageId: 2,
      fromUserId: 3,
      rawText: "",
      userToken: null,
      unsupportedMedia: false,
      voice: { durationSec: 1, fileSize: null },
    })
  );
  assert.deepEqual(disabledResult, { kind: "rejected", id: 1, replyText: VOICE_DISABLED_REPLY });

  const { service, state } = createService();
  const tooLong = unwrap(
    await service.capture({
      chatId: 1,
      messageId: 3,
      fromUserId: 4,
      rawText: "",
      userToken: null,
      unsupportedMedia: false,
      voice: { durationSec: 61, fileSize: null },
    })
  );
  const tooBig = unwrap(
    await service.capture({
      chatId: 1,
      messageId: 4,
      fromUserId: 4,
      rawText: "",
      userToken: null,
      unsupportedMedia: false,
      voice: { durationSec: 10, fileSize: TIMING.mediaMaxBytes + 1 },
    })
  );
  const needDownload = unwrap(
    await service.capture({
      chatId: 1,
      messageId: 5,
      fromUserId: 4,
      rawText: "",
      userToken: null,
      unsupportedMedia: false,
      voice: { durationSec: 10, fileSize: null },
    })
  );
  const failed = unwrap(
    await service.capture({
      chatId: 1,
      messageId: 6,
      fromUserId: 4,
      rawText: "",
      userToken: null,
      unsupportedMedia: false,
      voice: { durationSec: 10, fileSize: null },
      media: null,
    })
  );

  assert.equal(tooLong.kind, "rejected");
  assert.equal(tooLong.kind === "rejected" ? tooLong.replyText : "", VOICE_TOO_LONG_REPLY);
  assert.equal(tooBig.kind, "rejected");
  assert.equal(tooBig.kind === "rejected" ? tooBig.replyText : "", VOICE_TOO_BIG_REPLY);
  assert.equal(needDownload.kind, "download_media");
  assert.equal(failed.kind, "rejected");
  assert.equal(failed.kind === "rejected" ? failed.replyText : "", VOICE_DOWNLOAD_FAILED_REPLY);
  assert.equal(state.rejected.length, 3);
});

test("queues voice transcription and triggers cosmetic reaction", async () => {
  const { service, state } = createService(new Map([[9, "codex"]]));

  const result = unwrap(
    await service.capture({
      chatId: 10,
      messageId: 30,
      fromUserId: 9,
      rawText: "",
      userToken: null,
      unsupportedMedia: false,
      voice: { durationSec: 12, fileSize: 1024 },
      media: { kind: "voice", path: "/tmp/30.oga" },
    })
  );

  assert.equal(result.kind, "queued");
  assert.equal(state.voice[0]?.mediaPath, "/tmp/30.oga");
  assert.equal(state.voice[0]?.agent, "codex");
  assert.deepEqual(state.reactions, [[10, 30]]);
});

test("returns typed failure when inbound DB enqueue fails", async () => {
  const broken = createTelegramInboundCaptureService({
    log,
    messagesRepo: {
      insertRejected: () => 1,
      insertTranscribingVoice: () => 2,
      insertInbound: () => {
        throw new Error("sqlite busy");
      },
      update: noop,
    },
    userBuddy: {
      getDefault: () => null,
    },
    voiceTranscription: "local",
    voiceMaxDurationSec: 60,
  } as any);

  const outcome = await broken.capture({
    chatId: 10,
    messageId: 31,
    fromUserId: 9,
    rawText: "hello",
    userToken: null,
    unsupportedMedia: false,
    media: null,
  });

  assert.equal(outcome.ok, false);
  if (!outcome.ok) {
    assert.equal(outcome.error.code, "telegram_inbound_enqueue_failed");
    assert.equal(outcome.error.kind, "transient");
  }
});
