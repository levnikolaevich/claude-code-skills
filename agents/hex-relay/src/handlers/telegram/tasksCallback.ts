import { Composer, type Context } from "grammy";
import type { Logger } from "../../lib/logger.js";
import type { TaskService } from "../../services/task.service.js";
import type { ProviderTask } from "../../domain/task.js";
import { detailKeyboard, safeEditMenu, successKeyboard, type MenuScreen } from "./kb.js";
import { renderTasksList } from "./tasks.js";
import { truncate } from "../../domain/events.js";

export interface TasksCallbackDeps {
  log: Logger;
  tasks: TaskService;
}

const TITLE_DISPLAY_MAX = 64;

async function loadList(
  deps: TasksCallbackDeps,
  ownerId: number
): Promise<MenuScreen | { error: string }> {
  const outcome = await deps.tasks.fetchOpenTasks();
  if (!outcome.ok) return { error: outcome.error.message };
  return renderTasksList({
    tasks: outcome.value,
    ownerId,
    totalCount: outcome.value.length,
  });
}

function detailScreen(args: { task: ProviderTask; ownerId: number }): MenuScreen {
  const labels = args.task.labels.length > 0 ? `\nlabels: ${args.task.labels.join(", ")}` : "";
  const title = truncate(args.task.title, TITLE_DISPLAY_MAX);
  const text = `📋 #${args.task.id} ${title}${labels}`;
  return {
    text,
    keyboard: detailKeyboard({
      actions: [{ label: "Take", callbackData: `t_take:${args.task.id}` }],
      urls: [{ label: "Open", url: args.task.url }],
      backAction: `t_list:${args.ownerId}`,
    }),
  };
}

function successScreen(text: string, ownerId: number): MenuScreen {
  return { text, keyboard: successKeyboard(`t_list:${ownerId}`) };
}

export function buildTasksCallbackHandler(deps: TasksCallbackDeps): Composer<Context> {
  const c = new Composer<Context>();

  c.callbackQuery(/^t_list:/, async (ctx) => {
    const data = ctx.callbackQuery.data ?? "";
    const ownerId = Number.parseInt(data.slice("t_list:".length), 10);
    if (!Number.isFinite(ownerId)) {
      await ctx.answerCallbackQuery({ text: "malformed", show_alert: true });
      return;
    }
    if (ctx.from?.id !== ownerId) {
      await ctx.answerCallbackQuery({ text: "not your menu", show_alert: false });
      return;
    }
    const screen = await loadList(deps, ownerId);
    if ("error" in screen) {
      deps.log.warn({ error: screen.error }, "fetch open tasks failed");
      await ctx.answerCallbackQuery({ text: `failed: ${screen.error}`, show_alert: true });
      return;
    }
    await safeEditMenu(ctx, screen, { log: deps.log });
  });

  c.callbackQuery(/^t_view:/, async (ctx) => {
    const data = ctx.callbackQuery.data ?? "";
    const taskId = Number.parseInt(data.slice("t_view:".length), 10);
    if (!Number.isFinite(taskId)) {
      await ctx.answerCallbackQuery({ text: "bad task id", show_alert: true });
      return;
    }
    const fromId = ctx.from?.id ?? 0;
    const outcome = await deps.tasks.fetchOpenTasks();
    if (!outcome.ok) {
      await ctx.answerCallbackQuery({ text: `failed: ${outcome.error.message}`, show_alert: true });
      return;
    }
    const task = outcome.value.find((t) => t.id === taskId);
    if (task === undefined) {
      await safeEditMenu(ctx, successScreen("✗ Task no longer open.", fromId), {
        log: deps.log,
      });
      return;
    }
    await safeEditMenu(ctx, detailScreen({ task, ownerId: fromId }), { log: deps.log });
  });

  // Take — legacy regex preserved for backward compat.
  c.callbackQuery(/^t_take:/, async (ctx) => {
    const fromUserId = ctx.from?.id;
    if (fromUserId === undefined) {
      await ctx.answerCallbackQuery({ text: "missing user id", show_alert: true });
      return;
    }
    const chatId = ctx.chat?.id;
    const msgId = ctx.callbackQuery.message?.message_id;
    if (chatId === undefined || msgId === undefined) {
      await ctx.answerCallbackQuery({ text: "missing message context", show_alert: true });
      return;
    }
    const raw = (ctx.callbackQuery.data ?? "").slice("t_take:".length);
    const taskId = Number.parseInt(raw, 10);
    if (!Number.isFinite(taskId)) {
      await ctx.answerCallbackQuery({ text: "bad task id", show_alert: true });
      return;
    }

    const outcome = await deps.tasks.queueTaskForUser({
      taskId,
      chatId,
      fromUserId,
      telegramMessageId: msgId,
    });
    if (!outcome.ok) {
      deps.log.warn({ error: outcome.error, taskId, userId: fromUserId }, "task handoff failed");
      await ctx.answerCallbackQuery({ text: outcome.error.message, show_alert: true });
      return;
    }
    try {
      const task = outcome.value;
      await safeEditMenu(
        ctx,
        successScreen(`✓ Queued #${task.id} for your current session.`, fromUserId),
        { log: deps.log, skipAck: true }
      );
      await ctx.answerCallbackQuery({ text: "queued" });
    } catch (error) {
      deps.log.error({ err: String(error), taskId, userId: fromUserId }, "task handoff failed");
      await ctx.answerCallbackQuery({ text: `failed: ${String(error)}`, show_alert: true });
    }
  });

  return c;
}
