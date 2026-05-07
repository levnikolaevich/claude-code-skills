import { test } from "node:test";
import assert from "node:assert/strict";
import pino from "pino";
import { createWorkerLoop } from "../src/workers/workerLoop.js";
import type { Logger } from "../src/lib/logger.js";

const log = pino({ enabled: false }) as Logger;

function deferred(): {
  promise: Promise<void>;
  resolve: () => void;
} {
  let resolve!: () => void;
  const promise = new Promise<void>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

test("worker stop waits for an in-flight tick to finish", async () => {
  const tickStarted = deferred();
  const tickRelease = deferred();
  const loop = createWorkerLoop({
    log,
    name: "test worker",
    intervalMs: 10_000,
    async runOnce() {
      tickStarted.resolve();
      await tickRelease.promise;
    },
  });

  const startPromise = loop.start();
  await tickStarted.promise;

  let stopped = false;
  const stopPromise = loop.stop().then(() => {
    stopped = true;
  });
  await Promise.race([stopPromise, new Promise((resolve) => setTimeout(resolve, 20))]);
  assert.equal(stopped, false, "stop must wait for active runOnce");

  tickRelease.resolve();
  await stopPromise;
  await startPromise;
});

test("worker stop aborts sleep and prevents a new tick", async () => {
  let ticks = 0;
  const firstTickDone = deferred();
  const loop = createWorkerLoop({
    log,
    name: "test worker",
    intervalMs: 10_000,
    runOnce() {
      ticks += 1;
      firstTickDone.resolve();
    },
  });

  const startPromise = loop.start();
  await firstTickDone.promise;
  const startedStop = Date.now();
  await loop.stop();
  await startPromise;
  const stopMs = Date.now() - startedStop;

  assert.ok(stopMs < 500, `stop should abort long sleep, took ${stopMs}ms`);
  await new Promise((resolve) => setTimeout(resolve, 20));
  assert.equal(ticks, 1, "no extra tick after stop");
});

test("worker can preserve sleep-before-first-tick scheduling", async () => {
  let ticks = 0;
  const loop = createWorkerLoop({
    log,
    name: "scheduled worker",
    intervalMs: 10_000,
    runImmediately: false,
    runOnce() {
      ticks += 1;
    },
  });

  const startPromise = loop.start();
  await new Promise((resolve) => setTimeout(resolve, 20));
  await loop.stop();
  await startPromise;

  assert.equal(ticks, 0);
});
