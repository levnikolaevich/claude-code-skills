#!/usr/bin/env node

import {
    classifyLoopSignal,
    LOOP_HEALTH_FAILURE_CLASSES,
    normalizeErrorSignature,
    updateLoopHealth,
} from "../lib/loop-health.mjs";

function assert(condition, message) {
    if (!condition) {
        throw new Error(message);
    }
}

function testNormalizeErrorSignature() {
    const a = normalizeErrorSignature("Error at D:\\repo\\file.ts:123 on 2026-04-25T10:20:30Z");
    const b = normalizeErrorSignature("Error at D:\\other\\file.ts:999 on 2026-04-25T11:22:33Z");
    assert(a === b, "volatile paths, numbers, and timestamps should normalize");
}

function testProgressResetsCounters() {
    const first = updateLoopHealth({}, { error: "ASSERT failed", progress_detected: false });
    const second = updateLoopHealth(first, { error: "ASSERT failed", progress_detected: true });
    assert(second.no_progress_count === 0, "progress should reset no-progress counter");
    assert(second.same_error_count === 0, "progress should reset same-error counter");
    assert(second.pause_recommended === false, "progress should not pause");
}

function testNoProgressThreshold() {
    let health = {};
    const errors = ["alpha failure", "beta failure", "gamma failure"];
    for (let i = 0; i < 3; i += 1) {
        health = updateLoopHealth(health, {
            failure_class: LOOP_HEALTH_FAILURE_CLASSES.UNKNOWN,
            error: errors[i],
            progress_detected: false,
        });
    }
    assert(health.pause_recommended === true, "third no-progress attempt should pause");
    assert(health.pause_category === "no_progress", "pause should be no_progress");
}

function testSameErrorThreshold() {
    let health = {};
    for (let i = 0; i < 3; i += 1) {
        health = updateLoopHealth(health, {
            failure_class: LOOP_HEALTH_FAILURE_CLASSES.AGENT_ERROR,
            error: "ASSERT failed: same segment",
            progress_detected: false,
        });
    }
    assert(health.pause_recommended === true, "third same-error attempt should pause");
    assert(health.pause_category === "same_error", "pause should be same_error");
}

function testImmediateBlockers() {
    const health = updateLoopHealth({}, {
        failure_class: LOOP_HEALTH_FAILURE_CLASSES.PERMISSION_DENIAL,
        error: "permission denied",
    });
    assert(health.pause_recommended === true, "permission denial should pause immediately");
    assert(health.pause_category === LOOP_HEALTH_FAILURE_CLASSES.PERMISSION_DENIAL, "pause category should preserve blocker");
}

function testRateLimitDefers() {
    const signal = classifyLoopSignal({ error: "429 too many requests" });
    const health = updateLoopHealth({}, signal);
    assert(signal.failure_class === LOOP_HEALTH_FAILURE_CLASSES.RATE_LIMITED, "rate limit should classify");
    assert(health.pause_recommended === true, "rate limit should pause/defer");
    assert(health.pause_category === LOOP_HEALTH_FAILURE_CLASSES.RATE_LIMITED, "pause category should be rate_limited");
}

testNormalizeErrorSignature();
testProgressResetsCounters();
testNoProgressThreshold();
testSameErrorThreshold();
testImmediateBlockers();
testRateLimitDefers();

process.stdout.write("loop-health helper tests passed\n");
