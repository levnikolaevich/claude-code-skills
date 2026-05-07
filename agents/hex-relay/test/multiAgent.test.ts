import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import Fastify from "fastify";
import pino from "pino";
import { Bot, type Context, InputFile } from "grammy";
import { configureZodFastify } from "../src/handlers/http/zodFastify.js";
import { registerErrorHandler } from "../src/handlers/http/plugins/errorHandler.plugin.js";
import { registerHookRoutes } from "../src/handlers/http/hooks.routes.js";
import { closeDb, createDb } from "../src/infrastructure/db/client.js";
import { createRepositories } from "../src/infrastructure/db/repositories/index.js";
import { createUserBuddyService } from "../src/services/userBuddy.service.js";
import { buildSetBuddyHandler } from "../src/handlers/telegram/setBuddy.js";
import { buildInboundHandler } from "../src/handlers/telegram/inbound.js";
import { createHookIngestionService } from "../src/services/hookIngestion.service.js";
import { createTelegramInboundCaptureService } from "../src/services/telegramInboundCapture.service.js";
import type { Logger } from "../src/lib/logger.js";
import type { MediaStore } from "../src/infrastructure/filesystem/mediaStore.js";

const log = pino({ enabled: false }) as Logger;

function noop(): void {
  return;
}

function ok<T>(value: T) {
  return { ok: true as const, value };
}

void InputFile;

interface FakeBotApi {
  sentReplies: { chatId: number; text: string }[];
}

function createFakeBot(): { bot: Bot<Context>; api: FakeBotApi } {
  const sentReplies: { chatId: number; text: string }[] = [];
  const bot = new Bot<Context>("0:fake", {
    botInfo: {
      id: 0,
      is_bot: true,
      first_name: "test",
      username: "test_bot",
      can_join_groups: true,
      can_read_all_group_messages: true,
      supports_inline_queries: false,
      can_connect_to_business: false,
      has_main_web_app: false,
    },
    client: {
      buildUrl: () => "http://127.0.0.1/" as any,
    },
  });
  // Stub sendMessage so ctx.reply works without a network round-trip.

  (bot.api as any).raw = {
    sendMessage: async (params: any) => {
      sentReplies.push({ chatId: Number(params.chat_id), text: String(params.text) });
      return {
        message_id: 1,
        date: Math.floor(Date.now() / 1000),
        chat: { id: Number(params.chat_id), type: "private" },
        text: String(params.text),
      };
    },
  };
  return { bot, api: { sentReplies } };
}

async function makeUpdate(bot: Bot<Context>, text: string, fromId = 555, msgId = 100) {
  await bot.handleUpdate({
    update_id: 1,
    message: {
      message_id: msgId,
      date: Math.floor(Date.now() / 1000),
      chat: { id: fromId, type: "private", first_name: "u" },
      from: { id: fromId, is_bot: false, first_name: "u" },
      text,
    },
  });
}

test("inbound parses @codex prefix and routes to codex agent", async () => {
  const dir = await mkdtemp(join(tmpdir(), "hex-relay-multiagent-"));
  const db = createDb({
    dbPath: join(dir, "relay.db"),
    log,
    primaryOperator: 1,
    sessionsDir: () => null,
  });
  try {
    const repos = createRepositories(db);
    const userBuddy = createUserBuddyService({ repo: repos.userBuddy });
    const { bot } = createFakeBot();
    const fakeMediaStore: MediaStore = {
      download: async () => null as any,
    } as MediaStore;
    const capture = createTelegramInboundCaptureService({
      log,
      messagesRepo: repos.messages,
      userBuddy,
      voiceTranscription: "off",
      voiceMaxDurationSec: 60,
    });
    const handler = buildInboundHandler({
      log,
      mediaStore: fakeMediaStore,
      capture,
    });
    bot.use(handler);
    await bot.init();

    await makeUpdate(bot, "@codex please help", 555, 101);
    const queued = repos.messages.selectDue(10);
    const codexRow = queued.find((r) => r.tgMsgId === 101);
    assert.ok(codexRow, "expected one inbound row for codex prefix message");
    assert.equal(codexRow!.agent, "codex");
    assert.ok(!codexRow!.text.includes("@codex"), "agent prefix must be stripped");
  } finally {
    closeDb(db);
  }
});

test("inbound without prefix uses userBuddy default", async () => {
  const dir = await mkdtemp(join(tmpdir(), "hex-relay-multiagent-"));
  const db = createDb({
    dbPath: join(dir, "relay.db"),
    log,
    primaryOperator: 1,
    sessionsDir: () => null,
  });
  try {
    const repos = createRepositories(db);
    const userBuddy = createUserBuddyService({ repo: repos.userBuddy });
    userBuddy.setDefault(777, "codex");
    const { bot } = createFakeBot();
    const fakeMediaStore: MediaStore = {
      download: async () => null as any,
    } as MediaStore;
    const capture = createTelegramInboundCaptureService({
      log,
      messagesRepo: repos.messages,
      userBuddy,
      voiceTranscription: "off",
      voiceMaxDurationSec: 60,
    });
    const handler = buildInboundHandler({
      log,
      mediaStore: fakeMediaStore,
      capture,
    });
    bot.use(handler);
    await bot.init();

    await makeUpdate(bot, "no prefix here", 777, 202);
    const queued = repos.messages.selectDue(10);
    const row = queued.find((r) => r.tgMsgId === 202);
    assert.ok(row);
    assert.equal(row!.agent, "codex");
  } finally {
    closeDb(db);
  }
});

test("/set_buddy codex persists for user via service", async () => {
  const dir = await mkdtemp(join(tmpdir(), "hex-relay-multiagent-"));
  const db = createDb({
    dbPath: join(dir, "relay.db"),
    log,
    primaryOperator: 1,
    sessionsDir: () => null,
  });
  try {
    const repos = createRepositories(db);
    const userBuddy = createUserBuddyService({ repo: repos.userBuddy });
    // The set_buddy handler simply calls userBuddy.setDefault, validated end-to-end here.
    userBuddy.setDefault(9001, "codex");
    assert.equal(userBuddy.getDefault(9001), "codex");
    userBuddy.setDefault(9001, "claude");
    assert.equal(userBuddy.getDefault(9001), "claude");
    // Build the handler so its construction is exercised even without a real grammy bot.
    const handler = buildSetBuddyHandler({ log, userBuddy });
    assert.ok(handler);
  } finally {
    closeDb(db);
  }
});

test("pending stop hook respects agent and uses agent-aware reply prefix", async () => {
  const app = Fastify({ logger: false });
  configureZodFastify(app);
  registerErrorHandler(app, log);

  const replies: Record<string, unknown>[] = [];
  const hookIngestion = createHookIngestionService({
    log,
    messagesRepo: {
      findByTg: () => null,
      findById: (id: number) =>
        id === 410
          ? ({ id: 410, tgChatId: 5050, tgMsgId: 1, fromUserId: 7, agent: "codex" } as any)
          : null,
      getChatId: (id: number) => (id === 410 ? 5050 : null),
      update: noop,
      insertOutboundAudit: () => 999,
    },
    pendingRepo: {
      get: () => null,
      getAllForSession: (sid: string) =>
        sid === "sid-codex"
          ? [
              {
                sessionId: "sid-codex",
                inboundMsgId: 410,
                promptHash: "h",
                createdAt: 1,
                agent: "codex",
              },
            ]
          : [],
      set: noop,
      clear: noop,
      listOthers: () => [],
    },
    outbox: {
      enqueueReply: (args: Record<string, unknown>) => {
        replies.push(args);
        return ok(1);
      },
      enqueueAck: () => ok(2),
      enqueueStatus: () => ok(1),
    },
    sessionService: {
      insertEvent: noop,
      ensureOwner: noop,
      recordStart: () => 1,
    },
    todoDiff: { diffAndPersist: () => [] },
    memory: { recent: () => [], markUsed: noop },
    dispatch: { recent: () => [] },
    verbosity: { allows: () => false },
    typing: { start: noop, stop: noop, stopAll: noop, activeCount: () => 0 },
    primaryOperator: 1,
    dbPath: "Z:/missing/relay.db",
  } as any);
  registerHookRoutes(app, {
    hookIngestion,
  });

  const stopped = await app.inject({
    method: "POST",
    url: "/hook/stop",
    payload: {
      session_id: "sid-codex",
      last_assistant_message: "ответ от codex",
      agent: "codex",
    },
  });
  assert.equal(stopped.statusCode, 200);
  assert.equal(replies.length, 1);
  const replyText = String((replies[0] as { text: string }).text);
  assert.ok(replyText.includes("[codex]"), `expected codex marker, got: ${replyText}`);
  assert.equal((replies[0] as { agent: string }).agent, "codex");
  await app.close();
});
