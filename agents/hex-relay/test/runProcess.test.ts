import { test } from "node:test";
import assert from "node:assert/strict";
import { runProcess, RunProcessTimeoutError } from "../src/infrastructure/process/runProcess.js";

test("runProcess captures stdout, stderr, and exit code", async () => {
  const result = await runProcess(
    process.execPath,
    ["-e", "console.log('stdout text'); console.error('stderr text'); process.exit(3);"],
    { timeoutMs: 1000, label: "node fixture" }
  );
  assert.equal(result.code, 3);
  assert.equal(result.signal, null);
  assert.match(result.stdout, /stdout text/);
  assert.match(result.stderr, /stderr text/);
});

test("runProcess rejects on timeout after child close", async () => {
  const started = Date.now();
  let error: unknown;
  try {
    await runProcess(
      process.execPath,
      [
        "-e",
        "console.log('before sleep'); console.error('stderr before sleep'); setTimeout(() => {}, 2000);",
      ],
      {
        timeoutMs: 50,
        label: "slow fixture",
      }
    );
  } catch (error_) {
    error = error_;
  }

  assert.ok(error instanceof RunProcessTimeoutError);
  assert.match(error.message, /slow fixture timed out after 50ms/);
  assert.equal(error.code, -1);
  assert.equal(error.signal, "SIGKILL");
  assert.match(error.stdout, /before sleep/);
  assert.match(error.stderr, /stderr before sleep/);
  assert.ok(Date.now() - started >= 50);
});
