#!/usr/bin/env node

import {
    cleanupScenarioContext,
    createScenarioContext,
    runHappyPathScenario,
    runValidationRetryExhaustedScenario,
    runValidationRetryThenGoScenario,
} from "./scenario-helpers.mjs";

const scenarios = [
    { name: "happy_path_done", fn: runHappyPathScenario },
    { name: "validation_retry_then_go", fn: runValidationRetryThenGoScenario },
    { name: "validation_retry_exhausted", fn: runValidationRetryExhaustedScenario },
];

let passed = 0;

for (const [index, scenario] of scenarios.entries()) {
    const context = createScenarioContext(`pipeline-scenario-${index + 1}-`, {
        storyId: `PROJ-${100 + index}`,
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

process.stdout.write(`pipeline-runtime core scenarios passed (${passed}/${scenarios.length})\n`);
