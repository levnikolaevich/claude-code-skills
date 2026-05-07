import { Composer, type Context } from "grammy";
import type { Logger } from "../../lib/logger.js";
import type { TaskService } from "../../services/task.service.js";
import type { ProviderTask } from "../../domain/task.js";
import { TIMING } from "../../config/paths.js";
import { listKeyboard, type MenuScreen } from "./kb.js";
import { truncate } from "../../domain/events.js";

export interface TasksDeps {
  log: Logger;
  tasks: TaskService;
}

const TITLE_DISPLAY_MAX = 48;

/**
 * Render the v2 tasks list screen. Plain text, no parse_mode (Option A).
 * Owner-bound Refresh via `t_list:{ownerId}` so cross-actor taps in shared
 * chats get rejected without disturbing the menu state.
 */
export function renderTasksList(args: {
  tasks: ProviderTask[];
  ownerId: number;
  totalCount: number;
}): MenuScreen {
  const { tasks, ownerId, totalCount } = args;
  const cap = TIMING.maxMenuItems;
  const visible = tasks.slice(0, cap);
  if (visible.length === 0) {
    return {
      text: "📋 Tasks (0)\n\nNo open tasks.",
      keyboard: listKeyboard({
        items: [],
        viewActionPrefix: "t_view",
        listAction: `t_list:${ownerId}`,
      }),
    };
  }
  const lines = visible.map((task, idx) => {
    const title = truncate(task.title, TITLE_DISPLAY_MAX);
    return `${idx + 1}. #${task.id} ${title}`;
  });
  let text = `📋 Tasks (${totalCount})\n${lines.join("\n")}`;
  if (totalCount > visible.length) text += `\n\n+${totalCount - visible.length} more`;
  return {
    text,
    keyboard: listKeyboard({
      items: visible.map((task, idx) => ({ index: idx + 1, id: String(task.id) })),
      viewActionPrefix: "t_view",
      listAction: `t_list:${ownerId}`,
    }),
  };
}

export function buildTasksHandler(deps: TasksDeps): Composer<Context> {
  const c = new Composer<Context>();
  c.command("tasks", async (ctx) => {
    const outcome = await deps.tasks.fetchOpenTasks();
    if (!outcome.ok) {
      deps.log.warn({ error: outcome.error }, "fetch open tasks failed");
      await ctx.reply(`Failed to fetch tasks: ${outcome.error.message}`);
      return;
    }
    const tasks = outcome.value;
    if (tasks.length === 0) {
      await ctx.reply("No open tasks.");
      return;
    }
    const ownerId = ctx.from?.id ?? 0;
    const screen = renderTasksList({ tasks, ownerId, totalCount: tasks.length });
    try {
      await ctx.reply(screen.text, { reply_markup: screen.keyboard });
    } catch (error) {
      deps.log.error({ err: String(error) }, "send tasks list failed");
    }
  });
  return c;
}
