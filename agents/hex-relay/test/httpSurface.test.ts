import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { PROTECTED_HTTP_PREFIXES, PUBLIC_OPERATIONAL_ROUTES } from "../src/domain/httpSurface.js";

const repoRoot = dirname(dirname(dirname(dirname(fileURLToPath(import.meta.url)))));

test("app auth wiring consumes protected HTTP surface constants", () => {
  const source = readFileSync(join(repoRoot, "agents/hex-relay/src/app.ts"), "utf8");

  assert.ok(PROTECTED_HTTP_PREFIXES.length > 0);
  assert.ok(PUBLIC_OPERATIONAL_ROUTES.length > 0);
  assert.match(source, /protectedPrefixes: PROTECTED_HTTP_PREFIXES/);
  assert.doesNotMatch(source, /protectedPrefixes: \["\/hook"/);
});
