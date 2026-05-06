#!/usr/bin/env node

import { rmSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
    createJsonCliRunner,
    createProjectRoot,
    writeJson,
} from "../../coordinator-runtime/test/cli-test-helpers.mjs";
import { getWorkerPhases } from "../lib/phases.mjs";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const cliPath = join(__dirname, "..", "cli.mjs");
const projectRoot = createProjectRoot("task-plan-worker-runtime-");
const run = createJsonCliRunner(cliPath, projectRoot);

function buildSummary(skill, runId, storyId) {
    return {
        schema_version: "1.0.0",
        summary_kind: "task-plan",
        run_id: runId,
        identifier: storyId,
        producer_skill: skill,
        produced_at: "2026-04-06T00:00:00Z",
        payload: {
            mode: skill === "ln-301" ? "CREATE" : "REPLAN",
            story_id: storyId,
            task_type: "implementation",
            tasks_created: 2,
            tasks_updated: skill === "ln-302" ? 1 : 0,
            tasks_canceled: 0,
            task_urls: ["TASK-1", "TASK-2"],
            dry_warnings_count: 0,
            warnings: [],
            kanban_updated: true,
        },
    };
}

try {
    for (const skill of ["ln-301", "ln-302"]) {
        const storyId = `${skill}-story`;
        const manifestPath = join(projectRoot, `${skill}.manifest.json`);
        writeJson(manifestPath, { task_type: "implementation", auto_approve: true });
        const parentRunId = skill === "ln-301" ? "parent-ln-300" : "parent-ln-523";
        const childRunId = `${parentRunId}--${skill}--${storyId}`;
        const artifactPath = `.hex-skills/runtime-artifacts/runs/${parentRunId}/task-plan/${skill}--${storyId}.json`;
        const started = run([
            "start", "--skill", skill, "--story", storyId, "--manifest-file", manifestPath,
            "--run-id", childRunId, "--summary-artifact-path", artifactPath,
        ]);
        if (!started.ok) {
            throw new Error(`Failed to start ${skill}`);
        }
        const phases = getWorkerPhases(skill);
        for (let index = 0; index < phases.length; index += 1) {
            const phase = phases[index];
            run(["checkpoint", "--skill", skill, "--story", storyId, "--phase", phase, "--payload", phase.endsWith("SELF_CHECK")
                ? "{\"pass\":true,\"final_result\":\"PLAN_READY\"}"
                : "{}"]);
            if (phase.includes("WRITE_SUMMARY")) {
                run(["record-summary", "--skill", skill, "--story", storyId, "--payload", JSON.stringify(buildSummary(skill, childRunId, storyId))]);
            }
            if (phases[index + 1]) {
                run(["advance", "--skill", skill, "--story", storyId, "--to", phases[index + 1]]);
            }
        }
        const completed = run(["complete", "--skill", skill, "--story", storyId]);
        if (!completed.ok || completed.state.phase !== "DONE") {
            throw new Error(`Task-plan worker runtime did not complete for ${skill}`);
        }
    }
    process.stdout.write("task-plan-worker-runtime smoke passed\n");
} finally {
    rmSync(projectRoot, { recursive: true, force: true });
}
