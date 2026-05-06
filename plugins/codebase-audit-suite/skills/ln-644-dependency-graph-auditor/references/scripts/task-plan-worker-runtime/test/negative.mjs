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
const projectRoot = createProjectRoot("task-plan-worker-runtime-negative-");
const run = createJsonCliRunner(cliPath, projectRoot);

try {
    const manifestPath = join(projectRoot, "ln-301.manifest.json");
    writeJson(manifestPath, { task_type: "implementation", auto_approve: true });

    const missingManagedInput = run([
        "start",
        "--skill", "ln-301",
        "--story", "NEG-1",
        "--manifest-file", manifestPath,
        "--run-id", "parent--ln-301--NEG-1",
    ], { allowFailure: true });
    if (!String(missingManagedInput.error || "").includes("both --run-id and --summary-artifact-path")) {
        throw new Error(`Expected managed start transport failure, got: ${JSON.stringify(missingManagedInput)}`);
    }

    const started = run([
        "start",
        "--skill", "ln-301",
        "--story", "NEG-2",
        "--manifest-file", manifestPath,
        "--run-id", "parent--ln-301--NEG-2",
        "--summary-artifact-path", ".hex-skills/runtime-artifacts/runs/parent/task-plan/ln-301--NEG-2.json",
    ]);
    if (!started.ok) {
        throw new Error("Failed to start negative worker runtime");
    }

    const phases = getWorkerPhases("ln-301");
    for (let index = 0; index < phases.length - 1; index += 1) {
        const phase = phases[index];
        run([
            "checkpoint",
            "--skill", "ln-301",
            "--story", "NEG-2",
            "--phase", phase,
            "--payload", "{}",
        ]);
        run([
            "advance",
            "--skill", "ln-301",
            "--story", "NEG-2",
            "--to", phases[index + 1],
        ]);
    }

    const missingSelfCheckCheckpoint = run([
        "complete",
        "--skill", "ln-301",
        "--story", "NEG-2",
    ], { allowFailure: true });
    if (!String(missingSelfCheckCheckpoint.error || "").includes("Checkpoint missing for")) {
        throw new Error(`Expected self-check checkpoint failure, got: ${JSON.stringify(missingSelfCheckCheckpoint)}`);
    }

    run([
        "checkpoint",
        "--skill", "ln-301",
        "--story", "NEG-2",
        "--phase", phases.at(-1),
        "--payload", "{\"pass\":true,\"final_result\":\"PLAN_READY\"}",
    ]);
    const missingSummary = run([
        "complete",
        "--skill", "ln-301",
        "--story", "NEG-2",
    ], { allowFailure: true });
    if (!String(missingSummary.error || "").includes("Worker summary must be recorded")) {
        throw new Error(`Expected missing summary guard failure, got: ${JSON.stringify(missingSummary)}`);
    }

    run([
        "record-summary",
        "--skill", "ln-301",
        "--story", "NEG-2",
        "--payload",
        JSON.stringify({
            schema_version: "1.0.0",
            summary_kind: "task-plan",
            run_id: "parent--ln-301--NEG-2",
            identifier: "NEG-2",
            producer_skill: "ln-301",
            produced_at: "2026-04-09T00:00:00Z",
            payload: {
                mode: "ADD",
                story_id: "NEG-2",
                task_type: "implementation",
                tasks_created: 1,
                tasks_updated: 0,
                tasks_canceled: 0,
                task_urls: ["TASK-NEG-2"],
                dry_warnings_count: 0,
                warnings: [],
                kanban_updated: false,
            },
        }),
    ]);
    const completed = run([
        "complete",
        "--skill", "ln-301",
        "--story", "NEG-2",
    ]);
    if (!completed.ok || completed.state.phase !== "DONE") {
        throw new Error("Expected worker runtime to complete after summary + self-check");
    }

    process.stdout.write("task-plan-worker-runtime negative passed\n");
} finally {
    rmSync(projectRoot, { recursive: true, force: true });
}
