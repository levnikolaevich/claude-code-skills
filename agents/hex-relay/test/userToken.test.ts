import { test } from "node:test";
import assert from "node:assert/strict";
import type { Context } from "grammy";
import { userTokenFromContext } from "../src/handlers/telegram/userToken.js";

function ctx(from?: { id?: number; username?: string }): Context {
  return { from } as unknown as Context;
}

test("userTokenFromContext: missing ctx.from returns null", () => {
  assert.equal(userTokenFromContext(ctx()), null);
});

test("userTokenFromContext: prefers username when present", () => {
  assert.equal(userTokenFromContext(ctx({ id: 300, username: "alice" })), "alice");
});

test("userTokenFromContext: falls back to stringified user id", () => {
  assert.equal(userTokenFromContext(ctx({ id: 300 })), "300");
});

test("userTokenFromContext: empty username falls back to id", () => {
  assert.equal(userTokenFromContext(ctx({ id: 42, username: "" })), "42");
});
