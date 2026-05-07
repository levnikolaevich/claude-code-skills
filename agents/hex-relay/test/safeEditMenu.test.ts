import { test } from "node:test";
import assert from "node:assert/strict";
import pino from "pino";
import { GrammyError, InlineKeyboard, type Context } from "grammy";
import { safeEditMenu } from "../src/handlers/telegram/kb.js";
import type { Logger } from "../src/lib/logger.js";

const log = pino({ enabled: false }) as Logger;

interface FakeCtxRecording {
  editCalls: { text: string }[];
  ackCalls: ({ text: string; show_alert: boolean | undefined } | "noargs")[];
}

function makeFakeCtx(opts: { editBehavior: () => Promise<void> }): {
  ctx: Context;
  rec: FakeCtxRecording;
} {
  const rec: FakeCtxRecording = { editCalls: [], ackCalls: [] };
  const ctx = {
    async editMessageText(text: string) {
      rec.editCalls.push({ text });
      await opts.editBehavior();
    },
    async answerCallbackQuery(args?: { text?: string; show_alert?: boolean }) {
      if (args === undefined) {
        rec.ackCalls.push("noargs");
      } else {
        rec.ackCalls.push({ text: args.text ?? "", show_alert: args.show_alert });
      }
    },
  } as unknown as Context;
  return { ctx, rec };
}

function fakeGrammyError(description: string): GrammyError {
  // GrammyError requires (message, payload, method). Construct minimally.
  const payload = { ok: false as const, error_code: 400, description };
  return new GrammyError("call failed", payload, "editMessageText", {});
}

const screen = {
  text: "hello",
  keyboard: new InlineKeyboard().text("x", "y"),
};

test("safeEditMenu: successful edit returns edited and acks once", async () => {
  const { ctx, rec } = makeFakeCtx({ editBehavior: () => Promise.resolve() });
  const result = await safeEditMenu(ctx, screen, { log });
  assert.equal(result.kind, "edited");
  assert.equal(rec.editCalls.length, 1);
  assert.deepEqual(rec.ackCalls, ["noargs"]);
});

test("safeEditMenu: 'message is not modified' is silent success", async () => {
  const { ctx, rec } = makeFakeCtx({
    editBehavior: () => Promise.reject(fakeGrammyError("Bad Request: message is not modified")),
  });
  const result = await safeEditMenu(ctx, screen, { log });
  assert.equal(result.kind, "noop");
  assert.deepEqual(rec.ackCalls, ["noargs"]);
});

test("safeEditMenu: 'message to edit not found' produces expired alert", async () => {
  const { ctx, rec } = makeFakeCtx({
    editBehavior: () => Promise.reject(fakeGrammyError("Bad Request: message to edit not found")),
  });
  const result = await safeEditMenu(ctx, screen, { log });
  assert.equal(result.kind, "expired");
  assert.equal(rec.ackCalls.length, 1);
  const ack = rec.ackCalls[0];
  assert.notEqual(ack, "noargs");
  if (ack !== "noargs") {
    assert.equal(ack.text, "menu expired");
    assert.equal(ack.show_alert, true);
  }
});

test("safeEditMenu: 'chat not found' is treated as expired", async () => {
  const { ctx, rec } = makeFakeCtx({
    editBehavior: () => Promise.reject(fakeGrammyError("Forbidden: chat not found")),
  });
  const result = await safeEditMenu(ctx, screen, { log });
  assert.equal(result.kind, "expired");
  assert.equal(rec.ackCalls.length, 1);
});

test("safeEditMenu: unexpected error returns failed and acks", async () => {
  const { ctx, rec } = makeFakeCtx({
    editBehavior: () => Promise.reject(new Error("boom")),
  });
  const result = await safeEditMenu(ctx, screen, { log });
  assert.equal(result.kind, "failed");
  assert.equal(rec.ackCalls.length, 1);
  const ack = rec.ackCalls[0];
  if (ack !== "noargs") {
    assert.match(ack.text, /^failed:/);
    assert.equal(ack.show_alert, true);
  }
});

test("safeEditMenu: skipAck suppresses callback ack", async () => {
  const { ctx, rec } = makeFakeCtx({ editBehavior: () => Promise.resolve() });
  await safeEditMenu(ctx, screen, { log, skipAck: true });
  assert.equal(rec.ackCalls.length, 0);
});
