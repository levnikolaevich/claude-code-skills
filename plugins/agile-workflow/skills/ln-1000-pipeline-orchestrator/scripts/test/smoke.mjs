#!/usr/bin/env node

import {
    cleanupScenarioContext,
    createScenarioContext,
    runHappyPathScenario,
} from "./scenario-helpers.mjs";

const context = createScenarioContext("pipeline-runtime-", {
    storyId: "PROJ-123",
    title: "Story title",
});

try {
    runHappyPathScenario(context);
    process.stdout.write("pipeline-runtime smoke passed\n");
} finally {
    cleanupScenarioContext(context);
}
