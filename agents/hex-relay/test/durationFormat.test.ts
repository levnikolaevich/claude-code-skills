import { test } from "node:test";
import assert from "node:assert/strict";
import { formatDurationSuffix } from "../src/domain/durationFormat.js";

test("formatDurationSuffix: undefined/invalid returns empty string", () => {
  assert.equal(formatDurationSuffix(), "");
  assert.equal(formatDurationSuffix(Number.NaN), "");
  assert.equal(formatDurationSuffix(Number.POSITIVE_INFINITY), "");
  assert.equal(formatDurationSuffix(-1), "");
});

test("formatDurationSuffix: sub-second uses ms with rounding", () => {
  assert.equal(formatDurationSuffix(0), " (0 ms)");
  assert.equal(formatDurationSuffix(7.4), " (7 ms)");
  assert.equal(formatDurationSuffix(423), " (423 ms)");
  assert.equal(formatDurationSuffix(999.9), " (1000 ms)");
});

test("formatDurationSuffix: sub-10s uses one decimal", () => {
  assert.equal(formatDurationSuffix(1000), " (1.0s)");
  assert.equal(formatDurationSuffix(2456), " (2.5s)");
  assert.equal(formatDurationSuffix(9949), " (9.9s)");
});

test("formatDurationSuffix: 10s+ rounds to whole seconds", () => {
  assert.equal(formatDurationSuffix(10_000), " (10s)");
  assert.equal(formatDurationSuffix(12_734), " (13s)");
  assert.equal(formatDurationSuffix(60_000), " (60s)");
});
