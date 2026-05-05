import { Composer, type Context } from "grammy";
import type { Logger } from "../../lib/logger.js";
import type { TaskService } from "../../services/task.service.js";
import { taskCardKb } from "./kb.js";

export interface TasksDeps {
  log: Logger;
  tasks: TaskService;
}

const MAX_TASK_CARDS = 20;

function taskText(id: number, title: string, labels: string[]): string {
  const labelText = labels.length > 0 ? `\nlabels: ${labels.join(", ")}` : "";
  return `#${id} - ${title}${labelText}`;
}

export function buildTasksHandler(deps: TasksDeps): Composer<Context> {
  const c = new Composer<Context>();
  c.command("tasks", async (ctx) => {
    const tasks = await deps.tasks.listOpenTasks();
    if (tasks.length === 0) {
      await ctx.reply("No open tasks.");
      return;
    }

    await ctx.reply(`Open tasks: ${tasks.length}`);
    for (const task of tasks.slice(0, MAX_TASK_CARDS)) {
      try {
        await ctx.api.sendMessage(ctx.chat.id, taskText(task.id, task.title, task.labels), {
          reply_markup: taskCardKb(task),
        });
      } catch (error) {
        deps.log.error({ err: String(error), taskId: task.id }, "send task card failed");
      }
    }
    if (tasks.length > MAX_TASK_CARDS) {
      await ctx.reply(`+${tasks.length - MAX_TASK_CARDS} more tasks not shown.`);
    }
  });
  return c;
}
