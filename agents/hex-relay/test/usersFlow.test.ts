import { test } from "node:test";
import assert from "node:assert/strict";
import pino from "pino";
import { Context, Api } from "grammy";
import type { Update, UserFromGetMe } from "grammy/types";
import { renderUsersList } from "../src/handlers/telegram/users.js";
import { buildUsersCallbackHandler } from "../src/handlers/telegram/usersCallback.js";
import type { Logger } from "../src/lib/logger.js";
import type { AllowlistService } from "../src/services/allowlist.service.js";
import type { AllowedUserRow } from "../src/domain/user.js";
import { TIMING } from "../src/config/paths.js";
import type { Bot } from "grammy";

const log = pino({ enabled: false }) as Logger;

function row(o: Partial<AllowedUserRow> = {}): AllowedUserRow {
  return {
    userId: 1,
    username: "user1",
    status: "allowed",
    addedBy: null,
    addedAt: 0,
    pendingNotifiedAt: null,
    notes: null,
    ...o,
  };
}

/* ---------------------------- Pure renderer ---------------------------- */

test("renderUsersList: empty shows zero count + only Refresh button", () => {
  const screen = renderUsersList({ rows: [], primary: 1 });
  assert.match(screen.text, /Allowlist \(0\)/);
  const buttons = screen.keyboard.inline_keyboard.flat();
  assert.equal(buttons.length, 1);
  assert.equal(buttons[0]?.text, "🔄 Refresh");
  assert.equal(
    "callback_data" in (buttons[0] ?? {}) ? buttons[0]!.callback_data : null,
    "usr_list"
  );
});

test("renderUsersList: caps at maxMenuItems with +N more", () => {
  const rows = Array.from({ length: TIMING.maxMenuItems + 7 }, (_, i) =>
    row({ userId: i + 1, username: `u${i}` })
  );
  const screen = renderUsersList({ rows, primary: 1 });
  const buttons = screen.keyboard.inline_keyboard.flat();
  assert.equal(buttons.length, TIMING.maxMenuItems + 1);
  assert.match(screen.text, /\+7 more/);
});

test("renderUsersList: numbered buttons map to user ids", () => {
  const rows = [row({ userId: 42, username: "alice" }), row({ userId: 99, username: "bob" })];
  const screen = renderUsersList({ rows, primary: 42 });
  const buttons = screen.keyboard.inline_keyboard.flat();
  assert.equal(
    "callback_data" in (buttons[0] ?? {}) ? buttons[0]!.callback_data : null,
    "usr_view:42"
  );
  assert.equal(
    "callback_data" in (buttons[1] ?? {}) ? buttons[1]!.callback_data : null,
    "usr_view:99"
  );
  // Primary marker present in the text.
  assert.match(screen.text, /alice.*🛡/);
});

/* ---------------------------- Callback routing -------------------------- */

interface CtxRecording {
  edits: { text: string }[];
  acks: ({ text: string; show_alert: boolean | undefined } | "noargs")[];
}

interface FakeAllowlistOpts {
  primary: number;
  rows: AllowedUserRow[];
  upsertCalls?: { userId: number; status: "allowed" | "blocked" }[];
  deleteCalls?: number[];
}

function fakeAllowlist(opts: FakeAllowlistOpts): AllowlistService {
  return {
    primaryOperator: opts.primary,
    isPrimary: (uid: number | null | undefined) => uid === opts.primary,
    list: () => opts.rows,
    getRow: (uid: number) => opts.rows.find((r) => r.userId === uid) ?? null,
    upsertUser: (cmd: { userId: number; status: "allowed" | "blocked" }) => {
      opts.upsertCalls?.push({ userId: cmd.userId, status: cmd.status });
    },
    deleteUser: (uid: number) => {
      opts.deleteCalls?.push(uid);
      return 1;
    },
  } as unknown as AllowlistService;
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
  allowlist: AllowlistService;
}) {
  const api = makeApi(args.rec);
  const ctx = new Context(makeUpdate(args.data, args.fromId), api, ME);
  // bot is not actually used by the callback handler beyond `bot.api.sendMessage`
  // for notify; we pass a stubbed object.
  const bot = { api: { sendMessage: () => Promise.resolve() } } as unknown as Bot;
  const handler = buildUsersCallbackHandler({ log, bot, allowlist: args.allowlist });
  const middleware = handler.middleware();
  await middleware(ctx, async () => {
    /* no next */
  });
}

test("usersCallback: usr_list edits to refreshed list for primary", async () => {
  const rec: CtxRecording = { edits: [], acks: [] };
  const allowlist = fakeAllowlist({ primary: 1, rows: [row({ userId: 1, username: "p" })] });
  await dispatch({ data: "usr_list", fromId: 1, rec, allowlist });
  assert.equal(rec.edits.length, 1);
  assert.match(rec.edits[0]!.text, /Allowlist \(1\)/);
});

test("usersCallback: usr_list rejected for non-primary", async () => {
  const rec: CtxRecording = { edits: [], acks: [] };
  const allowlist = fakeAllowlist({ primary: 1, rows: [row({ userId: 1 })] });
  await dispatch({ data: "usr_list", fromId: 999, rec, allowlist });
  assert.equal(rec.edits.length, 0);
  assert.equal(rec.acks.length, 1);
});

test("usersCallback: usr_view shows detail screen for primary", async () => {
  const rec: CtxRecording = { edits: [], acks: [] };
  const allowlist = fakeAllowlist({
    primary: 1,
    rows: [row({ userId: 1 }), row({ userId: 42, username: "victim", status: "pending" })],
  });
  await dispatch({ data: "usr_view:42", fromId: 1, rec, allowlist });
  assert.equal(rec.edits.length, 1);
  assert.match(rec.edits[0]!.text, /victim/);
  assert.match(rec.edits[0]!.text, /pending/);
});

test("usersCallback: legacy usr_allow updates status and shows success screen", async () => {
  const rec: CtxRecording = { edits: [], acks: [] };
  const upsertCalls: { userId: number; status: "allowed" | "blocked" }[] = [];
  const allowlist = fakeAllowlist({
    primary: 1,
    rows: [row({ userId: 1 }), row({ userId: 42, username: "victim", status: "pending" })],
    upsertCalls,
  });
  await dispatch({ data: "usr_allow:42", fromId: 1, rec, allowlist });
  assert.deepEqual(upsertCalls, [{ userId: 42, status: "allowed" }]);
  assert.equal(rec.edits.length, 1);
  assert.match(rec.edits[0]!.text, /Allowed user 42/);
});

test("usersCallback: legacy usr_del removes user and shows success screen", async () => {
  const rec: CtxRecording = { edits: [], acks: [] };
  const deleteCalls: number[] = [];
  const allowlist = fakeAllowlist({
    primary: 1,
    rows: [row({ userId: 1 }), row({ userId: 42, username: "gone" })],
    deleteCalls,
  });
  await dispatch({ data: "usr_del:42", fromId: 1, rec, allowlist });
  assert.deepEqual(deleteCalls, [42]);
  assert.equal(rec.edits.length, 1);
  assert.match(rec.edits[0]!.text, /Deleted user 42/);
});

test("usersCallback: cannot mutate primary operator", async () => {
  const rec: CtxRecording = { edits: [], acks: [] };
  const upsertCalls: { userId: number; status: "allowed" | "blocked" }[] = [];
  const allowlist = fakeAllowlist({
    primary: 1,
    rows: [row({ userId: 1 })],
    upsertCalls,
  });
  await dispatch({ data: "usr_block:1", fromId: 1, rec, allowlist });
  assert.equal(upsertCalls.length, 0);
  assert.equal(rec.edits.length, 0);
  assert.equal(rec.acks.length, 1);
});
