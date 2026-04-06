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

function buildSummary(skill, runId, taskId, toStatus) {
    return {
        schema_version: "1.0.0",
        summary_kind: "task-status",
        run_id: runId,
        identifier: taskId,
        producer_skill: skill,
        produced_at: "2026-04-06T00:00:00Z",
        payload: {
            worker: skill,
            status: "completed",
            from_status: skill === "ln-402" ? "To Review" : (skill === "ln-403" ? "To Rework" : "Todo"),
            to_status: toStatus,
            warnings: [],
        },
    };
}

const projectRoot = createProjectRoot("task-worker-runtime-");
const run = createJsonCliRunner(cliPath, projectRoot);

try {
    const workers = [
        ["ln-401", "T-401", "To Review"],
        ["ln-402", "T-402", "Done"],
        ["ln-403", "T-403", "To Review"],
        ["ln-404", "T-404", "To Review"],
    ];

    for (const [skill, taskId, toStatus] of workers) {
        const manifestPath = join(projectRoot, `${skill}.manifest.json`);
        writeJson(manifestPath, { story_id: "PROJ-100" });
        const parentRunId = "parent-ln-400";
        const childRunId = `${parentRunId}--${skill}--${taskId}`;
        const artifactPath = `.hex-skills/runtime-artifacts/runs/${parentRunId}/task-status/${taskId}--${skill}.json`;
        const started = run([
            "start",
            "--skill",
            skill,
            "--task-id",
            taskId,
            "--manifest-file",
            manifestPath,
            "--run-id",
            childRunId,
            "--summary-artifact-path",
            artifactPath,
        ]);
        if (!started.ok) {
            throw new Error(`Failed to start ${skill}`);
        }
        const phases = getWorkerPhases(skill);
        for (let index = 0; index < phases.length; index += 1) {
            const phase = phases[index];
            const payload = phase.endsWith("SELF_CHECK")
                ? JSON.stringify({ pass: true, final_result: "READY" })
                : "{}";
            run(["checkpoint", "--skill", skill, "--task-id", taskId, "--phase", phase, "--payload", payload]);
            if (phase.includes("WRITE_SUMMARY")) {
                run(["record-summary", "--skill", skill, "--task-id", taskId, "--payload", JSON.stringify(buildSummary(skill, childRunId, taskId, toStatus))]);
            }
            if (phases[index + 1]) {
                run(["advance", "--skill", skill, "--task-id", taskId, "--to", phases[index + 1]]);
            }
        }
        const completed = run(["complete", "--skill", skill, "--task-id", taskId]);
        if (!completed.ok || completed.state.phase !== "DONE") {
            throw new Error(`Task worker runtime did not complete for ${skill}`);
        }
        if (completed.state.summary_artifact_path.replace(/\\/gu, "/").endsWith(`${taskId}--${skill}.json`) !== true) {
            throw new Error(`Unexpected artifact path for ${skill}`);
        }
    }

    process.stdout.write("task-worker-runtime smoke passed\n");
} finally {
    rmSync(projectRoot, { recursive: true, force: true });
}
