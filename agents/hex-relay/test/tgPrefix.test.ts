import { test } from "node:test";
import assert from "node:assert/strict";
import { buildTgPrefix } from "../src/domain/tgPrefix.js";

test("buildTgPrefix omits user= when token is null", () => {
  assert.equal(buildTgPrefix({ chatId: 100, msgId: 200 }), "[tg id=100:200]");
  assert.equal(buildTgPrefix({ chatId: 100, msgId: 200, userToken: null }), "[tg id=100:200]");
});

test("buildTgPrefix uses string token verbatim (username path)", () => {
  assert.equal(
    buildTgPrefix({ chatId: 1_633_575, msgId: 362, userToken: "lev" }),
    "[tg id=1633575:362 user=lev]"
  );
});

test("buildTgPrefix accepts numeric id stringified (fallback path)", () => {
  assert.equal(
    buildTgPrefix({ chatId: 100, msgId: 200, userToken: "300" }),
    "[tg id=100:200 user=300]"
  );
});

test("buildTgPrefix output is parseable by TG_PREFIX_RE", async () => {
  const { TG_PREFIX_RE } = await import("../src/config/paths.js");
  const prefix = buildTgPrefix({ chatId: 555, msgId: 999, userToken: "alice" });
  const match = TG_PREFIX_RE.exec(`${prefix} hello`);
  assert.ok(match, "regex must match prefix produced by buildTgPrefix");
  assert.equal(match![1], "555");
  assert.equal(match![2], "999");
});
