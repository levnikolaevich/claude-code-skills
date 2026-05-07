import { test } from "node:test";
import assert from "node:assert/strict";
import { Bot, type Context, InputFile } from "grammy";
import pino from "pino";
import { buildUsageHandler } from "../src/handlers/telegram/usage.js";
import type { Logger } from "../src/lib/logger.js";
import type { GodRuntimeService } from "../src/services/godRuntime.service.js";

const log = pino({ enabled: false }) as Logger;
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

function fakeGodRuntime(opts: { codexActive: boolean; throws?: boolean }): GodRuntimeService {
  return {
    runtimeFor: (() => {
      throw new Error("not used");
    }) as unknown as GodRuntimeService["runtimeFor"],
    ensureStarted: async () => null,
    isActive: async (_userId: number, agent?: "claude" | "codex") => {
      if (opts.throws) throw new Error("systemd unavailable");
      if (agent === "codex") return opts.codexActive;
      return false;
    },
    restart: async () => null,
  };
}

test("/usage combines claude report and codex active status", async () => {
  const { bot, api } = createFakeBot();
  const handler = buildUsageHandler({
    log,
    godRuntime: fakeGodRuntime({ codexActive: true }),
    runClaudeUsageReport: async () =>
      "📊 Claude usage\n\nSession (5hr):    42% потрачено — сброс через 1h 15m\nWeekly (7 day):   18% потрачено — сброс через 4d",
  });
  bot.use(handler);
  await bot.init();

  await fireUsage(bot, 555, 100);

  assert.equal(api.sentReplies.length, 1);
  const text = api.sentReplies[0]!.text;
  assert.ok(text.includes("📊 Claude usage"), "claude block must be present");
  assert.ok(text.includes("42% потрачено"), "claude details must be preserved");
  assert.ok(text.includes("🟢 Codex"), "codex active marker must be present");
  assert.ok(text.includes("активна"), "codex must be reported as active");
});

test("/usage reports codex as inactive when isActive returns false", async () => {
  const { bot, api } = createFakeBot();
  const handler = buildUsageHandler({
    log,
    godRuntime: fakeGodRuntime({ codexActive: false }),
    runClaudeUsageReport: async () => "📊 Claude usage\n\nSession (5hr):    0% потрачено",
  });
  bot.use(handler);
  await bot.init();

  await fireUsage(bot, 555, 101);

  assert.equal(api.sentReplies.length, 1);
  const text = api.sentReplies[0]!.text;
  assert.ok(text.includes("⚪ Codex"), "codex inactive marker must be present");
  assert.ok(text.includes("не запущена"), "codex must be reported as not started");
  assert.ok(text.includes("/set_buddy codex"), "codex hint should mention /set_buddy");
});

test("/usage falls back to claude error message when report binary throws", async () => {
  const { bot, api } = createFakeBot();
  const handler = buildUsageHandler({
    log,
    godRuntime: fakeGodRuntime({ codexActive: true }),
    runClaudeUsageReport: async () => {
      throw new Error("ENOENT: claude-usage-report not found");
    },
  });
  bot.use(handler);
  await bot.init();

  await fireUsage(bot, 555, 102);

  assert.equal(api.sentReplies.length, 1);
  const text = api.sentReplies[0]!.text;
  assert.ok(text.includes("Не удалось получить отчёт"), "must show claude fallback");
  assert.ok(text.includes("🟢 Codex"), "codex section still rendered");
});

test("/usage still replies if codex status probe throws", async () => {
  const { bot, api } = createFakeBot();
  const handler = buildUsageHandler({
    log,
    godRuntime: fakeGodRuntime({ codexActive: false, throws: true }),
    runClaudeUsageReport: async () => "📊 Claude usage\nok",
  });
  bot.use(handler);
  await bot.init();

  await fireUsage(bot, 555, 103);

  assert.equal(api.sentReplies.length, 1);
  const text = api.sentReplies[0]!.text;
  assert.ok(text.includes("📊 Claude usage"), "claude section preserved");
  assert.ok(text.includes("статус недоступен"), "codex fallback must be present");
});
