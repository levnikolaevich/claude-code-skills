import type { ProviderTask } from "../domain/task.js";
import type { Logger } from "../lib/logger.js";
import type { InboundService } from "./inbound.service.js";
import type { OutboxService } from "./outbox.service.js";
import type { MessagesRepository, TaskPollStateRepository, TaskProviderPort } from "./ports.js";
import { buildTgPrefix } from "../domain/tgPrefix.js";
import { fail, ok, serviceError, type ServiceError, type ServiceOutcome } from "./outcome.js";

export type TaskService = ReturnType<typeof createTaskService>;
export type TaskServiceError = ServiceError;

export interface TaskServiceConfig {
  allowedChat: number;
  gitProvider: "github" | "gitlab";
}

export interface TaskPollResult {
  count: number;
  notified: boolean;
}

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
  config: TaskServiceConfig;
  log: Logger;
  provider: TaskProviderPort;
  outbox: OutboxService;
  messagesRepo: MessagesRepository;
  taskPollState: TaskPollStateRepository;
  inbound: InboundService;
}) {
  async function fetchOpenTasks(): Promise<ServiceOutcome<ProviderTask[], TaskServiceError>> {
    try {
      return ok(await deps.provider.fetchOpenTasks());
    } catch (error) {
      return fail(
        serviceError({
          code: "task_provider_fetch_failed",
          kind: "transient",
          message: "failed to fetch provider tasks",
          details: { provider: deps.config.gitProvider },
          cause: error,
        })
      );
    }
  }

  async function pollAndNotifyPrimary(): Promise<ServiceOutcome<TaskPollResult, TaskServiceError>> {
    const fetched = await fetchOpenTasks();
    if (!fetched.ok) return fetched;
    const tasks = fetched.value;
    if (tasks.length === 0) {
      const prev = deps.taskPollState.get();
      deps.taskPollState.save({ lastNotifiedAt: prev?.lastNotifiedAt ?? null, lastCount: 0 });
      deps.log.info({ provider: deps.config.gitProvider }, "TASKS poll empty");
      return ok({ count: 0, notified: false });
    }

    const state = deps.taskPollState.get();
    const now = nowTs();
    const lastNotifiedAt = state?.lastNotifiedAt ?? null;
    const shouldNotify = lastNotifiedAt === null || now - lastNotifiedAt >= NOTIFY_COOLDOWN_SEC;
    if (shouldNotify) {
      const enqueued = deps.outbox.enqueueStatus({
        chatId: deps.config.allowedChat,
        eventType: "system",
        text: `Tasks: ${tasks.length} open task(s). Use /tasks to choose one.`,
      });
      if (!enqueued.ok) return enqueued;
      deps.taskPollState.save({ lastNotifiedAt: now, lastCount: tasks.length });
      deps.log.info(
        { count: tasks.length, provider: deps.config.gitProvider },
        "TASKS poll notified primary"
      );
    } else {
      deps.taskPollState.save({ lastNotifiedAt, lastCount: tasks.length });
      deps.log.info(
        { count: tasks.length, provider: deps.config.gitProvider, lastNotifiedAt },
        "TASKS poll notification suppressed by daily throttle"
      );
    }
    return ok({ count: tasks.length, notified: shouldNotify });
  }

  async function queueTaskForUser(args: {
    taskId: number;
    chatId: number;
    fromUserId: number;
    telegramMessageId: number;
  }): Promise<ServiceOutcome<ProviderTask, TaskServiceError>> {
    const fetched = await fetchOpenTasks();
    if (!fetched.ok) return fetched;
    const task = fetched.value.find((t) => t.id === args.taskId) ?? null;
    if (!task) {
      return fail(
        serviceError({
          code: "task_not_found",
          kind: "not_found",
          message: "task was not found in open provider tasks",
          retryable: false,
          details: { taskId: args.taskId },
        })
      );
    }

    const prefix = buildTgPrefix({
      chatId: args.chatId,
      msgId: args.telegramMessageId,
      userToken: String(args.fromUserId),
    });
    const paneText = `${prefix} ${taskHandoffPrompt(task)}`;
    let id: number;
    try {
      id = deps.messagesRepo.insertInbound(
        paneText,
        args.chatId,
        args.telegramMessageId,
        args.fromUserId
      );
    } catch (error) {
      return fail(
        serviceError({
          code: "task_handoff_enqueue_failed",
          kind: "transient",
          message: "failed to enqueue selected task for delivery",
          details: { taskId: task.id, userId: args.fromUserId },
          cause: error,
        })
      );
    }
    deps.log.info({ id, taskId: task.id, userId: args.fromUserId }, "TASKS queued handoff");
    const tick = await deps.inbound.tick();
    if (!tick.ok) return tick;
    return ok(task);
  }

  return { fetchOpenTasks, pollAndNotifyPrimary, queueTaskForUser };
}
