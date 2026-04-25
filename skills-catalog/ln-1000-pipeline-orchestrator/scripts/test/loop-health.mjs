#!/usr/bin/env node

import {
    cleanupScenarioContext,
    createScenarioContext,
} from "./scenario-helpers.mjs";
import { PHASES } from "../lib/phases.mjs";

function assert(condition, message) {
    if (!condition) {
        throw new Error(message);
    }
}

const context = createScenarioContext("pipeline-loop-health-", {
    storyId: "PROJ-LOOP",
    title: "Loop health story",
});

try {
    const started = context.runPipeline(["start", "--story", context.storyId, "--title", context.title]);
    assert(started.ok === true, "pipeline should start");

    let third = null;
    for (let i = 0; i < 3; i += 1) {
        third = context.runPipeline([
            "record-loop-health",
            "--story", context.storyId,
            "--stage", "2",
            "--payload", JSON.stringify({ error: "ASSERT failure: unchanged stage evidence", progress_detected: false }),
        ]);
    }
    assert(third.pause.pause === true, "same ASSERT failure should pause");
    assert(third.state.phase === PHASES.PAUSED, "pipeline should be paused");
    assert(third.state.loop_health.stages.stage_2.same_error_count === 3, "same error counter should reach threshold");

    process.stdout.write("pipeline loop-health tests passed\n");
} finally {
    cleanupScenarioContext(context);
}
