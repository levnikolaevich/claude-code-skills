import { test } from "node:test";
import assert from "node:assert/strict";
import pino from "pino";
import { Context, GrammyError, Api } from "grammy";
import type { Update, UserFromGetMe } from "grammy/types";
import { buildSessionsHandler, renderSessionsList } from "../src/handlers/telegram/sessions.js";
import { buildSessionsCallbackHandler } from "../src/handlers/telegram/sessionsCallback.js";
import type { Logger } from "../src/lib/logger.js";
import type { SessionService } from "../src/services/session.service.js";
import type { ControlLane } from "../src/services/controlLane.service.js";
import type { GodRuntimeService } from "../src/services/godRuntime.service.js";
import type { MutexMap } from "../src/lib/mutex.js";
import { TIMING } from "../src/config/paths.js";
import type { SessionListItem } from "../src/domain/session.js";

const log = pino({ enabled: false }) as Logger;

function makeSession(overrides: Partial<SessionListItem> = {}): SessionListItem {
  return {
    sid: "11111111-1111-1111-1111-111111111111",
    slug: "demo-slug",
    ts: 1_700_000_000,
    owner: 111,
    ...overrides,
  };
}

/* ---------------------------- Pure renderer ---------------------------- */

test("renderSessionsList: empty list shows zero count and just Refresh button", () => {
  const screen = renderSessionsList({ sessions: [], ownerId: 111, totalCount: 0 });
  assert.match(screen.text, /Sessions \(0\)/);
  assert.match(screen.text, /No sessions yet/);
  const buttons = screen.keyboard.inline_keyboard.flat();
  assert.equal(buttons.length, 1);
  assert.equal(buttons[0]?.text, "🔄 Refresh");
  assert.equal(
    "callback_data" in (buttons[0] ?? {}) ? buttons[0]!.callback_data : null,
    "s_list:111"
  );
});

test("renderSessionsList: numbered buttons + owner-bound Refresh", () => {
  const sessions = [
    makeSession({ sid: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", slug: "alpha" }),
    makeSession({ sid: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb", slug: "beta" }),
  ];
  const screen = renderSessionsList({ sessions, ownerId: 222, totalCount: 2 });
  assert.match(screen.text, /Sessions \(2\)/);
  assert.match(screen.text, /1\. alpha/);
  assert.match(screen.text, /2\. beta/);
  const buttons = screen.keyboard.inline_keyboard.flat();
  assert.equal(buttons.length, 3);
  assert.equal(buttons[0]?.text, "1");
  assert.equal(
    "callback_data" in (buttons[0] ?? {}) ? buttons[0]!.callback_data : null,
    "s_view:aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"
  );
  assert.equal(buttons[2]?.text, "🔄 Refresh");
  assert.equal(
    "callback_data" in (buttons[2] ?? {}) ? buttons[2]!.callback_data : null,
    "s_list:222"
  );
});

test("renderSessionsList: cap at maxMenuItems with +N more", () => {
  const sessions = Array.from({ length: TIMING.maxMenuItems + 5 }, (_, i) =>
    makeSession({
      sid: `${String(i).padStart(8, "0")}-1111-1111-1111-111111111111`,
      slug: `s${i}`,
    })
  );
  const screen = renderSessionsList({
    sessions,
    ownerId: 333,
    totalCount: sessions.length,
  });
  const buttons = screen.keyboard.inline_keyboard.flat();
  assert.equal(buttons.length, TIMING.maxMenuItems + 1);
  assert.match(screen.text, /\+5 more/);
});

test("renderSessionsList: preserves Markdown reserved chars in slug verbatim", () => {
  const sessions = [makeSession({ slug: "feature_x*y" })];
  const screen = renderSessionsList({ sessions, ownerId: 1, totalCount: 1 });
  assert.match(screen.text, /feature_x\*y/);
});

/* ---------------------------- Callback routing -------------------------- */

interface CtxRecording {
  edits: { text: string }[];
  acks: ({ text: string; show_alert: boolean | undefined } | "noargs")[];
  sends?: { text: string }[];
}

function fakeSessionService(args: {
  sessions: SessionListItem[];
  primaryOperator?: number;
}): SessionService {
  return {
    listSessions: () => args.sessions,
    getOwner: (sid: string) => args.sessions.find((s) => s.sid === sid)?.owner ?? null,
    validateSessionPath: (sid: string) =>
      args.sessions.some((s) => s.sid === sid) ? `/tmp/${sid}.jsonl` : null,
    deleteSessionFile: () => true,
    primaryOperator: args.primaryOperator ?? 999,
  } as unknown as SessionService;
}

function fakeControlLane(): ControlLane {
  return {
    run: <T>(_label: string, fn: () => Promise<T> | T) => Promise.resolve(fn()),
  } as unknown as ControlLane;
}

function fakeMutexMap(): MutexMap {
  return {
    for: () => ({
      run: <T>(_label: string, fn: () => Promise<T> | T) => Promise.resolve(fn()),
    }),
  } as unknown as MutexMap;
}

function fakeGodRuntime(): GodRuntimeService {
  return {
    runtimeFor: () => ({
      ok: true,
      value: {
        atomicCmd: { write: () => void 0 },
        pane: {
          hasSession: async () => false,
          killGracefully: () => Promise.resolve(),
        },
      },
    }),
    ensureStarted: async () => ({ ok: true, value: void 0 }),
  } as unknown as GodRuntimeService;
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

function makeApi(rec: CtxRecording, opts: { editError?: Error } = {}): Api {
  const api = new Api("0:fake", { buildUrl: () => "http://127.0.0.1/" as any });
  api.config.use(async (_prev, method, payload) => {
    if (method === "editMessageText") {
      rec.edits.push({ text: String((payload as any).text) });
      if (opts.editError) throw opts.editError;
      return { ok: true, result: true } as any;
    }
    if (method === "answerCallbackQuery") {
      const p = payload as { text?: string; show_alert?: boolean };
      if (p.text === undefined) rec.acks.push("noargs");
      else rec.acks.push({ text: String(p.text), show_alert: p.show_alert });
      return { ok: true, result: true } as any;
    }
    if (method === "editMessageReplyMarkup") return { ok: true, result: true } as any;
    if (method === "sendMessage") {
      rec.sends?.push({ text: String((payload as any).text) });
      return {
        ok: true,
        result: { message_id: 1, date: 0, chat: { id: 0, type: "private" } },
      } as any;
    }
    return { ok: true, result: true } as any;
  });
  return api;
}

function makeCommandUpdate(text: string, fromId: number): Update {
  return {
    update_id: 1,
    message: {
      message_id: 7,
      date: 0,
      chat: { id: fromId, type: "private", first_name: "u" },
      from: { id: fromId, is_bot: false, first_name: "u" },
      text,
      entities: [{ type: "bot_command", offset: 0, length: "/sessions".length }],
    },
  } as Update;
}

async function dispatchCommand(args: {
  text: string;
  fromId: number;
  rec: CtxRecording;
  sessionService: SessionService;
  controlLane: ControlLane;
  sessionLocks: MutexMap;
}) {
  const api = makeApi(args.rec);
  const ctx = new Context(makeCommandUpdate(args.text, args.fromId), api, ME);
  const handler = buildSessionsHandler({
    log,
    sessionService: args.sessionService,
    controlLane: args.controlLane,
    sessionLocks: args.sessionLocks,
  });
  const middleware = handler.middleware();
  await middleware(ctx, async () => {
    /* no next */
  });
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

async function dispatchCallback(args: {
  data: string;
  fromId: number;
  sessions: SessionListItem[];
  rec: CtxRecording;
  editError?: Error;
}) {
  const api = makeApi(args.rec, { editError: args.editError });
  const ctx = new Context(makeUpdate(args.data, args.fromId), api, ME);
  const handler = buildSessionsCallbackHandler({
    log,
    sessionService: fakeSessionService({ sessions: args.sessions }),
    controlLane: fakeControlLane(),
    sessionLocks: fakeMutexMap(),
    godRuntime: fakeGodRuntime(),
  });
  const middleware = handler.middleware();
  await middleware(ctx, async () => {
    /* no next */
  });
}

test("sessionsCallback: cross-actor s_list reject without edit", async () => {
  const rec: CtxRecording = { edits: [], acks: [] };
  await dispatchCallback({
    data: "s_list:111",
    fromId: 222,
    sessions: [makeSession({ owner: 111 })],
    rec,
  });
  assert.equal(rec.edits.length, 0, "must not edit other user's menu");
  assert.equal(rec.acks.length, 1);
  const ack = rec.acks[0];
  if (ack !== "noargs") {
    assert.equal(ack.text, "not your menu");
    assert.equal(ack.show_alert, false);
  }
});

test("sessionsCallback: owner s_list refreshes the list (edit happens)", async () => {
  const rec: CtxRecording = { edits: [], acks: [] };
  await dispatchCallback({
    data: "s_list:111",
    fromId: 111,
    sessions: [makeSession({ owner: 111 })],
    rec,
  });
  assert.equal(rec.edits.length, 1);
  assert.match(rec.edits[0]!.text, /Sessions \(1\)/);
});

test("sessionsCallback: 'message is not modified' on Refresh = silent ack", async () => {
  const rec: CtxRecording = { edits: [], acks: [] };
  const grammyErr = new GrammyError(
    "call failed",
    { ok: false, error_code: 400, description: "Bad Request: message is not modified" },
    "editMessageText",
    {}
  );
  await dispatchCallback({
    data: "s_list:111",
    fromId: 111,
    sessions: [makeSession({ owner: 111 })],
    rec,
    editError: grammyErr,
  });
  assert.deepEqual(rec.acks, ["noargs"]);
});

test("sessionsCallback: s_view drills into detail screen for owner", async () => {
  const sid = "cccccccc-cccc-cccc-cccc-cccccccccccc";
  const rec: CtxRecording = { edits: [], acks: [] };
  await dispatchCallback({
    data: `s_view:${sid}`,
    fromId: 111,
    sessions: [makeSession({ sid, slug: "deep", owner: 111 })],
    rec,
  });
  assert.equal(rec.edits.length, 1);
  assert.match(rec.edits[0]!.text, /deep/);
  assert.match(rec.edits[0]!.text, new RegExp(sid));
});

test("sessionsCallback: legacy s_run produces success screen with Back", async () => {
  const sid = "dddddddd-dddd-dddd-dddd-dddddddddddd";
  const rec: CtxRecording = { edits: [], acks: [] };
  await dispatchCallback({
    data: `s_run:${sid}`,
    fromId: 111,
    sessions: [makeSession({ sid, slug: "resume-me", owner: 111 })],
    rec,
  });
  assert.ok(rec.edits.length > 0);
  assert.match(rec.edits.at(-1)!.text, /Resuming/);
});

test("sessionsCallback: s_view by non-owner is rejected without edit", async () => {
  const sid = "eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee";
  const rec: CtxRecording = { edits: [], acks: [] };
  await dispatchCallback({
    data: `s_view:${sid}`,
    fromId: 222,
    sessions: [makeSession({ sid, owner: 111 })],
    rec,
  });
  assert.equal(rec.edits.length, 0);
  assert.equal(rec.acks.length, 1);
  const ack = rec.acks[0];
  if (ack !== "noargs") assert.equal(ack.text, "not your session");
});

test("/sessions delete takes session lock before controlLane", async () => {
  const sid = "ffffffff-ffff-ffff-ffff-ffffffffffff";
  const order: string[] = [];
  const rec: CtxRecording = { edits: [], acks: [], sends: [] };
  const sessionService = {
    listSessions: () => [],
    getOwner: () => 111,
    validateSessionPath: () => `/tmp/${sid}.jsonl`,
    deleteSessionFile: () => {
      order.push("delete");
      return true;
    },
    primaryOperator: 111,
  } as unknown as SessionService;
  const controlLane = {
    run: async <T>(_label: string, fn: () => Promise<T> | T): Promise<T> => {
      order.push("control:start");
      try {
        return await fn();
      } finally {
        order.push("control:end");
      }
    },
  } as unknown as ControlLane;
  const sessionLocks = {
    for: () => ({
      run: async <T>(_label: string, fn: () => Promise<T> | T): Promise<T> => {
        order.push("lock:start");
        try {
          return await fn();
        } finally {
          order.push("lock:end");
        }
      },
    }),
  } as unknown as MutexMap;

  await dispatchCommand({
    text: `/sessions delete ${sid}`,
    fromId: 111,
    rec,
    sessionService,
    controlLane,
    sessionLocks,
  });

  assert.deepEqual(order, ["lock:start", "control:start", "delete", "control:end", "lock:end"]);
  assert.match(rec.sends?.at(-1)?.text ?? "", /Deleted/);
});

test("/sessions delete is race-safe when session disappears inside lock", async () => {
  const sid = "abababab-abab-abab-abab-abababababab";
  const rec: CtxRecording = { edits: [], acks: [], sends: [] };
  let validateCalls = 0;
  const order: string[] = [];
  const sessionService = {
    listSessions: () => [],
    getOwner: () => 111,
    validateSessionPath: () => {
      validateCalls += 1;
      return validateCalls === 1 ? `/tmp/${sid}.jsonl` : null;
    },
    deleteSessionFile: () => {
      order.push("delete");
      return true;
    },
    primaryOperator: 111,
  } as unknown as SessionService;
  const controlLane = {
    run: async <T>(_label: string, fn: () => Promise<T> | T): Promise<T> => {
      order.push("control");
      return fn();
    },
  } as unknown as ControlLane;
  const sessionLocks = {
    for: () => ({
      run: async <T>(_label: string, fn: () => Promise<T> | T): Promise<T> => {
        order.push("lock");
        return fn();
      },
    }),
  } as unknown as MutexMap;

  await dispatchCommand({
    text: `/sessions delete ${sid}`,
    fromId: 111,
    rec,
    sessionService,
    controlLane,
    sessionLocks,
  });

  assert.deepEqual(order, ["lock"]);
  assert.match(rec.sends?.at(-1)?.text ?? "", /not found or already deleted/);
});
