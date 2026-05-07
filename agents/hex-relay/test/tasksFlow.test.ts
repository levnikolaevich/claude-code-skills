import { test } from "node:test";
import assert from "node:assert/strict";
import pino from "pino";
import { Context, Api } from "grammy";
import type { Update, UserFromGetMe } from "grammy/types";
import { renderTasksList } from "../src/handlers/telegram/tasks.js";
import { buildTasksCallbackHandler } from "../src/handlers/telegram/tasksCallback.js";
import type { Logger } from "../src/lib/logger.js";
import type { TaskService } from "../src/services/task.service.js";
import type { ProviderTask } from "../src/domain/task.js";
import { TIMING } from "../src/config/paths.js";

const log = pino({ enabled: false }) as Logger;

function task(o: Partial<ProviderTask> = {}): ProviderTask {
  return {
    id: 1,
    title: "do the thing",
    url: "https://example.com/issues/1",
    labels: [],
    createdAt: "2026-01-01T00:00:00Z",
    body: "",
    ...o,
  };
}

/* ---------------------------- Pure renderer ---------------------------- */

test("renderTasksList: empty list -> Refresh only with owner-bound callback", () => {
  const screen = renderTasksList({ tasks: [], ownerId: 555, totalCount: 0 });
  const buttons = screen.keyboard.inline_keyboard.flat();
  assert.equal(buttons.length, 1);
  assert.equal(
    "callback_data" in (buttons[0] ?? {}) ? buttons[0]!.callback_data : null,
    "t_list:555"
  );
  assert.match(screen.text, /Tasks \(0\)/);
});

test("renderTasksList: numbered buttons map to task ids", () => {
  const tasks = [task({ id: 10, title: "first" }), task({ id: 11, title: "second" })];
  const screen = renderTasksList({ tasks, ownerId: 9, totalCount: 2 });
  const buttons = screen.keyboard.inline_keyboard.flat();
  assert.equal(
    "callback_data" in (buttons[0] ?? {}) ? buttons[0]!.callback_data : null,
    "t_view:10"
  );
  assert.equal(
    "callback_data" in (buttons[1] ?? {}) ? buttons[1]!.callback_data : null,
    "t_view:11"
  );
  assert.match(screen.text, /1\. #10 first/);
});

test("renderTasksList: caps at maxMenuItems with +N more", () => {
  const tasks = Array.from({ length: TIMING.maxMenuItems + 3 }, (_, i) =>
    task({ id: i, title: `t${i}` })
  );
  const screen = renderTasksList({ tasks, ownerId: 1, totalCount: tasks.length });
  const buttons = screen.keyboard.inline_keyboard.flat();
  assert.equal(buttons.length, TIMING.maxMenuItems + 1);
  assert.match(screen.text, /\+3 more/);
});

/* ---------------------------- Callback routing -------------------------- */

interface CtxRecording {
  edits: { text: string }[];
  acks: ({ text: string; show_alert: boolean | undefined } | "noargs")[];
}

interface FakeTaskOpts {
  tasks: ProviderTask[];
  fetchError?: string;
  queueResult?: { ok: true; value: ProviderTask } | { ok: false; error: { message: string } };
  queueCalls?: number[];
}

function fakeTaskService(opts: FakeTaskOpts): TaskService {
  return {
    fetchOpenTasks: async () => {
      if (opts.fetchError !== undefined) {
        return { ok: false, error: { message: opts.fetchError, code: "x" } } as any;
      }
      return { ok: true, value: opts.tasks } as any;
    },
    queueTaskForUser: async (args: { taskId: number }) => {
      opts.queueCalls?.push(args.taskId);
      if (opts.queueResult !== undefined) return opts.queueResult as any;
      const t = opts.tasks.find((x) => x.id === args.taskId);
      if (t === undefined) return { ok: false, error: { message: "missing", code: "x" } } as any;
      return { ok: true, value: t } as any;
    },
  } as unknown as TaskService;
}

const ME: UserFromGetMe = {
  id: 0,
  is_bot: true,
  first_name: "test",
  username: "test_bot",
  can_join_groups: true,
  can_read_all_group_messages: true,
  supports_inline_queries: false,
  can_connect_to_business: false,
  has_main_web_app: false,
};

function makeApi(rec: CtxRecording): Api {
  const api = new Api("0:fake", { buildUrl: () => "http://127.0.0.1/" as any });
  api.config.use(async (_prev, method, payload) => {
    if (method === "editMessageText") {
      rec.edits.push({ text: String((payload as any).text) });
      return { ok: true, result: true } as any;
    }
    if (method === "answerCallbackQuery") {
      const p = payload as { text?: string; show_alert?: boolean };
      if (p.text === undefined) rec.acks.push("noargs");
      else rec.acks.push({ text: String(p.text), show_alert: p.show_alert });
      return { ok: true, result: true } as any;
    }
    if (method === "sendMessage") {
      return {
        ok: true,
        result: { message_id: 1, date: 0, chat: { id: 0, type: "private" } },
      } as any;
    }
    return { ok: true, result: true } as any;
  });
  return api;
}

function makeUpdate(data: string, fromId: number): Update {
  return {
    update_id: 1,
    callback_query: {
      id: "c1",
      from: { id: fromId, is_bot: false, first_name: "u" },
      chat_instance: "ci",
      data,
      message: {
        message_id: 7,
        date: 0,
        chat: { id: fromId, type: "private", first_name: "u" },
        from: ME,
        text: "menu",
      },
    },
  } as Update;
}

async function dispatch(args: {
  data: string;
  fromId: number;
  rec: CtxRecording;
  service: TaskService;
}) {
  const api = makeApi(args.rec);
  const ctx = new Context(makeUpdate(args.data, args.fromId), api, ME);
  const handler = buildTasksCallbackHandler({ log, tasks: args.service });
  const middleware = handler.middleware();
  await middleware(ctx, async () => {
    /* no next */
  });
}

test("tasksCallback: cross-actor t_list rejected without edit", async () => {
  const rec: CtxRecording = { edits: [], acks: [] };
  const service = fakeTaskService({ tasks: [task()] });
  await dispatch({ data: "t_list:111", fromId: 222, rec, service });
  assert.equal(rec.edits.length, 0);
  assert.equal(rec.acks.length, 1);
  const ack = rec.acks[0];
  if (ack !== "noargs") assert.equal(ack.text, "not your menu");
});

test("tasksCallback: owner t_list refreshes the list", async () => {
  const rec: CtxRecording = { edits: [], acks: [] };
  const service = fakeTaskService({ tasks: [task({ id: 7, title: "fresh" })] });
  await dispatch({ data: "t_list:111", fromId: 111, rec, service });
  assert.equal(rec.edits.length, 1);
  assert.match(rec.edits[0]!.text, /#7 fresh/);
});

test("tasksCallback: t_view drills into detail screen", async () => {
  const rec: CtxRecording = { edits: [], acks: [] };
  const service = fakeTaskService({
    tasks: [task({ id: 42, title: "do it", url: "https://example.com/42" })],
  });
  await dispatch({ data: "t_view:42", fromId: 111, rec, service });
  assert.equal(rec.edits.length, 1);
  assert.match(rec.edits[0]!.text, /#42 do it/);
});

test("tasksCallback: legacy t_take queues task and shows success screen", async () => {
  const rec: CtxRecording = { edits: [], acks: [] };
  const queueCalls: number[] = [];
  const service = fakeTaskService({
    tasks: [task({ id: 9, title: "queue-me" })],
    queueCalls,
  });
  await dispatch({ data: "t_take:9", fromId: 111, rec, service });
  assert.deepEqual(queueCalls, [9]);
  assert.equal(rec.edits.length, 1);
  assert.match(rec.edits[0]!.text, /Queued #9/);
});
