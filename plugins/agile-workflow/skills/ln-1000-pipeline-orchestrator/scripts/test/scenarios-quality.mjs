#!/usr/bin/env node

import {
    cleanupScenarioContext,
    createScenarioContext,
    runQualityFailLimitExhaustedScenario,
    runQualityFailReentryThenPassScenario,
    runStage3PauseResumeScenario,
} from "./scenario-helpers.mjs";

const scenarios = [
    { name: "quality_fail_reentry_then_pass", fn: runQualityFailReentryThenPassScenario },
    { name: "quality_fail_limit_exhausted", fn: runQualityFailLimitExhaustedScenario },
    { name: "stage3_pause_resume", fn: runStage3PauseResumeScenario },
];

let passed = 0;

for (const [index, scenario] of scenarios.entries()) {
    const context = createScenarioContext(`pipeline-quality-scenario-${index + 1}-`, {
        storyId: `PROJ-${200 + index}`,
        title: `Scenario ${scenario.name}`,
    });
    try {
        scenario.fn(context);
        passed += 1;
        process.stdout.write(`PASS: ${scenario.name}\n`);
    } finally {
        cleanupScenarioContext(context);
    }
}

process.stdout.write(`pipeline-runtime quality scenarios passed (${passed}/${scenarios.length})\n`);
