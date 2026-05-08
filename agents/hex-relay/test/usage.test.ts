import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Bot, type Context, InputFile } from "grammy";
import pino from "pino";
import { buildUsageHandler } from "../src/handlers/telegram/usage.js";
import { closeDb, createDb } from "../src/infrastructure/db/client.js";
import { createRepositories } from "../src/infrastructure/db/repositories/index.js";
import { createUserBuddyService } from "../src/services/userBuddy.service.js";
import type { Logger } from "../src/lib/logger.js";
import type { GodRuntimeService } from "../src/services/godRuntime.service.js";

const log = pino({ enabled: false }) as Logger;
void InputFile;

const CODEX_USAGE_JSON = JSON.stringify({
  rateLimits: {
    limitId: "codex",
    limitName: null,
    primary: {
      usedPercent: 37,
      windowDurationMins: 300,
      resetsAt: 4_102_444_800,
    },
    secondary: {
      usedPercent: 26,
      windowDurationMins: 10_080,
      resetsAt: 4_102_790_400,
    },
    credits: {
      hasCredits: false,
      unlimited: false,
      balance: "0",
    },
    planType: "prolite",
    rateLimitReachedType: null,
  },
});

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
  });
  bot.api.config.use((_prev, method, payload) => {
    if (method === "sendMessage") {
      const params = payload as { chat_id: number | string; text: string };
      sentReplies.push({ chatId: Number(params.chat_id), text: String(params.text) });
      return Promise.resolve({
        ok: true,
        result: {
          message_id: 1,
          date: Math.floor(Date.now() / 1000),
          chat: { id: Number(params.chat_id), type: "private" as const, first_name: "u" },
          text: String(params.text),
        },
      }) as never;
    }
    return Promise.resolve({ ok: true, result: true }) as never;
  });
  return { bot, api: { sentReplies } };
}

async function fireUsage(bot: Bot<Context>, fromId = 555, msgId = 100): Promise<void> {
  await bot.handleUpdate({
    update_id: 1,
    message: {
      message_id: msgId,
      date: Math.floor(Date.now() / 1000),
      chat: { id: fromId, type: "private", first_name: "u" },
      from: { id: fromId, is_bot: false, first_name: "u" },
      text: "/usage",
      entities: [{ type: "bot_command", offset: 0, length: 6 }],
    },
  });
}

interface FakeGodOpts {
  claudeActive?: boolean;
  codexActive?: boolean;
  isActiveThrows?: boolean;
}

function fakeGodRuntime(opts: FakeGodOpts): GodRuntimeService {
  return {
    runtimeFor: (() => {
      throw new Error("not used");
    }) as unknown as GodRuntimeService["runtimeFor"],
    ensureStarted: async () => null,
    isActive: async (_userId: number, agent?: "claude" | "codex") => {
      if (opts.isActiveThrows) throw new Error("systemd unavailable");
      if (agent === "codex") return { ok: true, value: opts.codexActive ?? false };
      return { ok: true, value: opts.claudeActive ?? false };
    },
    restart: async () => null,
  };
}

test("/usage routes through buddy agent when buddy session is active", async () => {
  const dir = await mkdtemp(join(tmpdir(), "hex-relay-usage-"));
  const db = createDb({
    dbPath: join(dir, "relay.db"),
    log,
    primaryOperator: 1,
    sessionsDir: () => null,
  });
  try {
    const repos = createRepositories(db);
    const userBuddy = createUserBuddyService({ repo: repos.userBuddy });
    const { bot, api } = createFakeBot();
    const handler = buildUsageHandler({
      log,
      godRuntime: fakeGodRuntime({ claudeActive: true, codexActive: true }),
      messagesRepo: repos.messages,
      userBuddy,
      runClaudeUsageReport: async () => "\u{1F4CA} Claude usage\nSession (5hr): 42% used",
      runCodexUsageReport: async () => CODEX_USAGE_JSON,
    });
    bot.use(handler);
    await bot.init();

    await fireUsage(bot, 555, 100);

    // Routed through agent: no direct ctx.reply, but a queued inbound row exists.
    assert.equal(api.sentReplies.length, 0, "must not reply directly when routed through agent");
    const queued = repos.messages.selectDue(10);
    const row = queued.find((r) => r.tgMsgId === 100);
    assert.ok(row, "expected one queued inbound row");
    assert.equal(row!.agent, "claude", "default buddy is claude");
    assert.ok(row!.text.startsWith("[tg id=555:100"), "must include standard tg-prefix");
    assert.ok(row!.text.includes("[system: usage report]"), "must carry instruction header");
    assert.ok(
      row!.text.includes("language the user has been using"),
      "must instruct to respond in user's language"
    );
    assert.ok(row!.text.includes("📊 Claude usage"), "claude data block preserved");
    assert.ok(row!.text.includes("42% used"), "raw numbers preserved");
    assert.ok(
      row!.text.includes("Current session: 37% used"),
      "codex 5h used percentage is normalized"
    );
    assert.ok(
      row!.text.includes("Current week: 26% used"),
      "codex weekly used percentage is normalized"
    );
    assert.ok(!row!.text.includes("remaining"), "codex usage must not be reported as remaining");
  } finally {
    closeDb(db);
  }
});

test("/usage honors user buddy preference (codex)", async () => {
  const dir = await mkdtemp(join(tmpdir(), "hex-relay-usage-"));
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
    const handler = buildUsageHandler({
      log,
      godRuntime: fakeGodRuntime({ claudeActive: false, codexActive: true }),
      messagesRepo: repos.messages,
      userBuddy,
      runClaudeUsageReport: async () => "\u{1F4CA} Claude usage\nok",
      runCodexUsageReport: async () => CODEX_USAGE_JSON,
    });
    bot.use(handler);
    await bot.init();

    await fireUsage(bot, 777, 200);

    const queued = repos.messages.selectDue(10);
    const row = queued.find((r) => r.tgMsgId === 200);
    assert.ok(row);
    assert.equal(row!.agent, "codex", "must route to codex when buddy=codex");
  } finally {
    closeDb(db);
  }
});

test("/usage replies directly in English when buddy session is inactive", async () => {
  const dir = await mkdtemp(join(tmpdir(), "hex-relay-usage-"));
  const db = createDb({
    dbPath: join(dir, "relay.db"),
    log,
    primaryOperator: 1,
    sessionsDir: () => null,
  });
  try {
    const repos = createRepositories(db);
    const userBuddy = createUserBuddyService({ repo: repos.userBuddy });
    const { bot, api } = createFakeBot();
    const handler = buildUsageHandler({
      log,
      godRuntime: fakeGodRuntime({ claudeActive: false, codexActive: false }),
      messagesRepo: repos.messages,
      userBuddy,
      runClaudeUsageReport: async () => "\u{1F4CA} Claude usage\nSession (5hr): 7% used",
      runCodexUsageReport: async () => CODEX_USAGE_JSON,
    });
    bot.use(handler);
    await bot.init();

    await fireUsage(bot, 555, 300);

    assert.equal(api.sentReplies.length, 1, "must reply directly when no agent active");
    const text = api.sentReplies[0]!.text;
    assert.ok(text.includes("📊 Claude usage"), "claude block preserved");
    assert.ok(text.includes("7% used"), "raw numbers preserved");
    assert.ok(
      text.includes("Current session: 37% used"),
      "codex usage is collected even when codex session is inactive"
    );
    assert.ok(
      text.includes("⚪ Codex"),
      "codex inactive marker is included as runtime status only"
    );
    assert.ok(!/[а-яА-ЯёЁ]/.test(text), "direct reply text must be English (no Cyrillic)");

    const queued = repos.messages.selectDue(10);
    assert.equal(
      queued.find((r) => r.tgMsgId === 300),
      undefined,
      "no inbound row enqueued in direct reply path"
    );
  } finally {
    closeDb(db);
  }
});

test("/usage direct reply still renders when live Claude usage query throws", async () => {
  const dir = await mkdtemp(join(tmpdir(), "hex-relay-usage-"));
  const db = createDb({
    dbPath: join(dir, "relay.db"),
    log,
    primaryOperator: 1,
    sessionsDir: () => null,
  });
  try {
    const repos = createRepositories(db);
    const userBuddy = createUserBuddyService({ repo: repos.userBuddy });
    const { bot, api } = createFakeBot();
    const handler = buildUsageHandler({
      log,
      godRuntime: fakeGodRuntime({ claudeActive: false, codexActive: false }),
      messagesRepo: repos.messages,
      userBuddy,
      runClaudeUsageReport: async () => {
        throw new Error("ENOENT");
      },
      runCodexUsageReport: async () => CODEX_USAGE_JSON,
    });
    bot.use(handler);
    await bot.init();

    await fireUsage(bot, 555, 400);

    assert.equal(api.sentReplies.length, 1);
    const text = api.sentReplies[0]!.text;
    assert.ok(text.includes("live Claude usage query failed"), "claude failure block present");
    assert.ok(
      text.includes("Current session: 37% used"),
      "codex section still renders independently"
    );
  } finally {
    closeDb(db);
  }
});

test("/usage direct reply handles codex isActive throw", async () => {
  const dir = await mkdtemp(join(tmpdir(), "hex-relay-usage-"));
  const db = createDb({
    dbPath: join(dir, "relay.db"),
    log,
    primaryOperator: 1,
    sessionsDir: () => null,
  });
  try {
    const repos = createRepositories(db);
    const userBuddy = createUserBuddyService({ repo: repos.userBuddy });
    const { bot, api } = createFakeBot();
    const handler = buildUsageHandler({
      log,
      godRuntime: fakeGodRuntime({ isActiveThrows: true }),
      messagesRepo: repos.messages,
      userBuddy,
      runClaudeUsageReport: async () => "\u{1F4CA} Claude usage\nok",
      runCodexUsageReport: async () => CODEX_USAGE_JSON,
    });
    bot.use(handler);
    await bot.init();

    await fireUsage(bot, 555, 500);

    assert.equal(api.sentReplies.length, 1);
    const text = api.sentReplies[0]!.text;
    assert.ok(text.includes("📊 Claude usage"), "claude block preserved");
    assert.ok(
      text.includes("Current session: 37% used"),
      "codex usage is still collected when systemd probe fails"
    );
    assert.ok(text.includes("status unavailable"), "codex status note rendered in English");
  } finally {
    closeDb(db);
  }
});
