#!/usr/bin/env node

import { rmSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
    createJsonCliRunner,
    createProjectRoot,
    writeJson,
} from "../../coordinator-runtime/test/cli-test-helpers.mjs";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const cliPath = join(__dirname, "..", "cli.mjs");
const projectRoot = createProjectRoot("task-worker-runtime-negative-");
const run = createJsonCliRunner(cliPath, projectRoot);

try {
    const manifestPath = join(projectRoot, "manifest.json");
    writeJson(manifestPath, {});
    run(["start", "--skill", "ln-401", "--task-id", "T-NEG", "--manifest-file", manifestPath]);
    const phases = [
        "PHASE_0_CONFIG",
        "PHASE_1_RESOLVE_TASK",
        "PHASE_2_LOAD_CONTEXT",
        "PHASE_3_GOAL_GATE_BLUEPRINT",
        "PHASE_4_START_WORK",
        "PHASE_5_IMPLEMENT_AND_VERIFY_AC",
        "PHASE_6_QUALITY_AND_HANDOFF",
        "PHASE_7_WRITE_SUMMARY",
        "PHASE_8_SELF_CHECK",
    ];
    for (let index = 0; index < phases.length; index += 1) {
        const phase = phases[index];
        run(["checkpoint", "--skill", "ln-401", "--task-id", "T-NEG", "--phase", phase, "--payload", phase === "PHASE_8_SELF_CHECK"
            ? "{\"pass\":true,\"final_result\":\"READY\"}"
            : "{}"]);
        if (phases[index + 1]) {
            run(["advance", "--skill", "ln-401", "--task-id", "T-NEG", "--to", phases[index + 1]]);
        }
    }
    const prematureDone = run(["complete", "--skill", "ln-401", "--task-id", "T-NEG"], { allowFailure: true });
    if (prematureDone.ok !== false || !/summary/i.test(prematureDone.error || "")) {
        throw new Error("Expected summary guard failure before completion");
    }

    const invalidSummary = run([
        "record-summary",
        "--skill",
        "ln-401",
        "--task-id",
        "T-NEG",
        "--payload",
        JSON.stringify({
            schema_version: "1.0.0",
            summary_kind: "task-status",
            run_id: "ln-401-t-neg-bad",
            identifier: "T-NEG",
            producer_skill: "ln-401",
            produced_at: "2026-04-06T00:00:00Z",
            payload: {
                worker: "ln-401",
                status: "completed",
                from_status: "Todo",
                to_status: "Done",
                warnings: [],
            },
        }),
    ], { allowFailure: true });
    if (invalidSummary.ok !== false) {
        throw new Error("Expected invalid ln-401 summary to fail");
    }

    process.stdout.write("task-worker-runtime negative passed\n");
} finally {
    rmSync(projectRoot, { recursive: true, force: true });
}
