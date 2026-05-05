import { Composer, type Context } from "grammy";
import type { Logger } from "../../lib/logger.js";
import type { TaskService } from "../../services/task.service.js";

export interface TasksCallbackDeps {
  log: Logger;
  tasks: TaskService;
}

export function buildTasksCallbackHandler(deps: TasksCallbackDeps): Composer<Context> {
  const c = new Composer<Context>();
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

    try {
      const task = await deps.tasks.queueTaskForUser({
        taskId,
        chatId,
        fromUserId,
        telegramMessageId: msgId,
      });
      if (!task) {
        await ctx.answerCallbackQuery({ text: "task not found", show_alert: true });
        return;
      }
      await ctx.answerCallbackQuery({ text: "queued" });
      try {
        await ctx.editMessageText(`Queued #${task.id} for your current session.`);
      } catch {
        /* ignore stale/edited task card */
      }
    } catch (error) {
      deps.log.error({ err: String(error), taskId, userId: fromUserId }, "task handoff failed");
      await ctx.answerCallbackQuery({ text: `failed: ${String(error)}`, show_alert: true });
    }
  });
  return c;
}
