import { test } from "node:test";
import assert from "node:assert/strict";
import {
  fail,
  isOk,
  mapError,
  ok,
  okVoid,
  serviceError,
  unwrapOrThrowInvariant,
} from "../src/services/outcome.js";

test("outcome helpers construct and narrow success values", () => {
  const value = ok(42);
  assert.equal(value.ok, true);
  assert.equal(isOk(value), true);
  if (isOk(value)) assert.equal(value.value, 42);

  const empty = okVoid();
  assert.equal(empty.ok, true);
  assert.equal(empty.value, undefined);
});

test("serviceError defaults retryable for transient and rate-limited errors only", () => {
  assert.equal(
    serviceError({ code: "temporary", kind: "transient", message: "temporary" }).retryable,
    true
  );
  assert.equal(
    serviceError({ code: "rate", kind: "rate_limited", message: "rate limited" }).retryable,
    true
  );
  assert.equal(
    serviceError({ code: "bad", kind: "validation", message: "bad input" }).retryable,
    false
  );
});

test("mapError preserves success and maps failure payloads", () => {
  assert.deepEqual(
    mapError(ok("kept"), () => serviceError({ code: "unused", kind: "permanent", message: "x" })),
    ok("kept")
  );

  const mapped = mapError(
    fail(serviceError({ code: "old", kind: "transient", message: "old" })),
    (error) =>
      serviceError({
        code: "new",
        kind: error.kind,
        message: `mapped ${error.code}`,
      })
  );
  assert.equal(mapped.ok, false);
  if (!mapped.ok) {
    assert.equal(mapped.error.code, "new");
    assert.equal(mapped.error.message, "mapped old");
  }
});

test("unwrapOrThrowInvariant unwraps only success or invariant failures", () => {
  assert.equal(unwrapOrThrowInvariant(ok("ready")), "ready");

  assert.throws(
    () =>
      unwrapOrThrowInvariant(
        fail(serviceError({ code: "broken", kind: "invariant", message: "broken invariant" }))
      ),
    /broken invariant/
  );
  assert.throws(
    () =>
      unwrapOrThrowInvariant(
        fail(serviceError({ code: "down", kind: "transient", message: "system unavailable" }))
      ),
    /unexpected non-invariant outcome: down/
  );
});

test("serviceError records Error causes without default object stringification", () => {
  const error = serviceError({
    code: "repo_failed",
    kind: "transient",
    message: "repo failed",
    cause: new Error("sqlite busy"),
  });
  assert.equal(error.cause, "sqlite busy");
});
