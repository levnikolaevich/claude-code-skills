#!/usr/bin/env node
// SOURCE-OF-TRUTH: shared/scripts/task-worker-runtime/test/negative.mjs. Edit ONLY here; run `node tools/marketplace/shared.mjs sync`

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
    // --- Blueprint guard test: PHASE_4 blocked without blueprint ---
    const bpManifestPath = join(projectRoot, "bp-manifest.json");
    writeJson(bpManifestPath, {});
    run(["start", "--skill", "ln-401", "--task-id", "T-BP", "--manifest-file", bpManifestPath]);
    for (const p of ["PHASE_0_CONFIG", "PHASE_1_RESOLVE_TASK", "PHASE_2_LOAD_CONTEXT", "PHASE_3_GOAL_GATE_BLUEPRINT"]) {
        run(["checkpoint", "--skill", "ln-401", "--task-id", "T-BP", "--phase", p, "--payload", "{}"]);
        const next = p === "PHASE_0_CONFIG" ? "PHASE_1_RESOLVE_TASK"
            : p === "PHASE_1_RESOLVE_TASK" ? "PHASE_2_LOAD_CONTEXT"
            : p === "PHASE_2_LOAD_CONTEXT" ? "PHASE_3_GOAL_GATE_BLUEPRINT" : null;
        if (next) run(["advance", "--skill", "ln-401", "--task-id", "T-BP", "--to", next]);
    }
    const noBlueprint = run(["advance", "--skill", "ln-401", "--task-id", "T-BP", "--to", "PHASE_4_START_WORK"], { allowFailure: true });
    if (noBlueprint.ok !== false || !/blueprint/i.test(noBlueprint.error || "")) {
        throw new Error("Expected blueprint guard failure at PHASE_4");
    }

    // --- Summary guard test (existing): full run without recording summary ---
    for (let index = 0; index < phases.length; index += 1) {
        const phase = phases[index];
        let payload;
        if (phase === "PHASE_8_SELF_CHECK") {
            payload = "{\"pass\":true,\"final_result\":\"READY\"}";
        } else if (phase === "PHASE_3_GOAL_GATE_BLUEPRINT") {
            payload = JSON.stringify({ blueprint: { change_order: [{ file: "neg.ts", action: "create", reason: "test" }] } });
        } else if (phase === "PHASE_6_QUALITY_AND_HANDOFF") {
            payload = JSON.stringify({ blueprint_status: { planned_count: 1, completed: ["neg.ts"], skipped: [], added: [], completion_pct: 100 } });
        } else {
            payload = "{}";
        }
        run(["checkpoint", "--skill", "ln-401", "--task-id", "T-NEG", "--phase", phase, "--payload", payload]);
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
