import type { Env } from "../config/env.js";
import type { ProviderTask } from "../domain/task.js";
import type { MessagesRepo } from "../infrastructure/db/repositories/messages.repo.js";
import type { TaskPollStateRepo } from "../infrastructure/db/repositories/taskPollState.repo.js";
import type { Logger } from "../lib/logger.js";
import type { InboundService } from "./inbound.service.js";
import type { OutboxService } from "./outbox.service.js";
import type { TaskProviderService } from "./taskProvider.service.js";

export type TaskService = ReturnType<typeof createTaskService>;

const TASK_BODY_LIMIT = 5000;
const NOTIFY_COOLDOWN_SEC = 24 * 60 * 60;

function nowTs(): number {
  return Math.floor(Date.now() / 1000);
}

function compactLabels(labels: string[]): string {
  return labels.length > 0 ? labels.join(", ") : "none";
}

function taskHandoffPrompt(task: ProviderTask): string {
  const body = task.body.trim();
  const bodyBlock = body.length > 0 ? body.slice(0, TASK_BODY_LIMIT) : "(empty)";
  return [
    "[control-plane task handoff]",
    `Task: #${task.id} ${task.title}`,
    `URL: ${task.url}`,
    `Labels: ${compactLabels(task.labels)}`,
    "",
    "Work on this selected task in the current project session.",
    "Keep all reads and edits inside the project folder, except read-only installed skills.",
    "Do not fetch provider tokens or VPS secrets from the work plane.",
    "",
    "Issue body:",
    bodyBlock,
  ].join("\n");
}

export function createTaskService(deps: {
  env: Env;
  log: Logger;
  provider: TaskProviderService;
  outbox: OutboxService;
  messagesRepo: MessagesRepo;
  taskPollState: TaskPollStateRepo;
  inbound: InboundService;
}) {
  async function listOpenTasks(): Promise<ProviderTask[]> {
    return deps.provider.listOpenTasks();
  }

  async function pollAndNotifyPrimary(): Promise<{ count: number }> {
    const tasks = await listOpenTasks();
    if (tasks.length === 0) {
      const prev = deps.taskPollState.get();
      deps.taskPollState.save({ lastNotifiedAt: prev?.lastNotifiedAt ?? null, lastCount: 0 });
      deps.log.info({ provider: deps.env.gitProvider }, "TASKS poll empty");
      return { count: 0 };
    }

    const state = deps.taskPollState.get();
    const now = nowTs();
    const lastNotifiedAt = state?.lastNotifiedAt ?? null;
    const shouldNotify = lastNotifiedAt === null || now - lastNotifiedAt >= NOTIFY_COOLDOWN_SEC;
    if (shouldNotify) {
      deps.outbox.enqueueStatus({
        chatId: deps.env.allowedChat,
        eventType: "system",
        text: `Tasks: ${tasks.length} open task(s). Use /tasks to choose one.`,
      });
      deps.taskPollState.save({ lastNotifiedAt: now, lastCount: tasks.length });
      deps.log.info(
        { count: tasks.length, provider: deps.env.gitProvider },
        "TASKS poll notified primary"
      );
    } else {
      deps.taskPollState.save({ lastNotifiedAt, lastCount: tasks.length });
      deps.log.info(
        { count: tasks.length, provider: deps.env.gitProvider, lastNotifiedAt },
        "TASKS poll notification suppressed by daily throttle"
      );
    }
    return { count: tasks.length };
  }

  async function queueTaskForUser(args: {
    taskId: number;
    chatId: number;
    fromUserId: number;
    telegramMessageId: number;
  }): Promise<ProviderTask | null> {
    const tasks = await listOpenTasks();
    const task = tasks.find((t) => t.id === args.taskId) ?? null;
    if (!task) return null;

    const paneText = `[tg id=${args.chatId}:${args.telegramMessageId} user=${args.fromUserId}] ${taskHandoffPrompt(task)}`;
    const id = deps.messagesRepo.insertInbound(
      paneText,
      args.chatId,
      args.telegramMessageId,
      args.fromUserId
    );
    deps.log.info({ id, taskId: task.id, userId: args.fromUserId }, "TASKS queued handoff");
    await deps.inbound.tick();
    return task;
  }

  return { listOpenTasks, pollAndNotifyPrimary, queueTaskForUser };
}
