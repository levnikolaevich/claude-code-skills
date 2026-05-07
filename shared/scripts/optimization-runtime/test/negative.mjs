#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { OPTIMIZATION_GATE_VERDICTS } from "../../coordinator-runtime/lib/runtime-constants.mjs";
import { PHASES } from "../lib/phases.mjs";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const cliPath = join(__dirname, "..", "cli.mjs");
const projectRoot = mkdtempSync(join(tmpdir(), "optimization-runtime-negative-"));

function childRun(worker, identifier, runId) {
    return {
        worker,
        identifier,
        run_id: runId,
        phase_context: identifier,
    };
}

function workerSummary(runId, worker, identifier, payload) {
    return {
        schema_version: "1.0.0",
        summary_kind: "optimization-worker",
        run_id: runId,
        identifier,
        producer_skill: worker,
        produced_at: new Date().toISOString(),
        payload: {
            status: "completed",
            worker,
            ...payload,
        },
    };
}

function run(args, options = {}) {
    try {
        return JSON.parse(execFileSync("node", [cliPath, ...args], {
            cwd: projectRoot,
            encoding: "utf8",
            stdio: ["ignore", "pipe", "pipe"],
        }));
    } catch (error) {
        if (options.allowFailure) {
            return JSON.parse(error.stdout || error.stderr);
        }
        throw error;
    }
}

try {
    const manifestPath = join(projectRoot, "manifest.json");
    writeFileSync(manifestPath, JSON.stringify({
        slug: "neg-test",
        target: "src/api/test.py::test_fn",
        observed_metric: { type: "response_time", value: 5000, unit: "ms" },
        cycle_config: { max_cycles: 1, plateau_threshold: 5 },
        execution_mode: "execute",
    }, null, 2));

    run(["start", "--project-root", projectRoot, "--slug", "neg-test", "--manifest-file", manifestPath]);
    const cycleOneProfileId = "ln-811--neg-test--cycle-1";
    const cycleOneResearchId = "ln-812--neg-test--cycle-1";
    const cycleOneValidateId = "ln-813--neg-test--cycle-1";
    const cycleOneExecuteId = "ln-814--neg-test--cycle-1";

    // Fast-forward to WRONG_TOOL_GATE
    run(["checkpoint", "--project-root", projectRoot, "--slug", "neg-test", "--phase", PHASES.PREFLIGHT]);
    run(["advance", "--project-root", projectRoot, "--slug", "neg-test", "--to", PHASES.PARSE_INPUT]);
    run(["checkpoint", "--project-root", projectRoot, "--slug", "neg-test", "--phase", PHASES.PARSE_INPUT, "--payload", "{\"target_metric\":{\"value\":500,\"unit\":\"ms\"}}"]);
    run(["advance", "--project-root", projectRoot, "--slug", "neg-test", "--to", PHASES.PROFILE]);
    run(["checkpoint", "--project-root", projectRoot, "--slug", "neg-test", "--phase", PHASES.PROFILE, "--payload", JSON.stringify({
        child_run: childRun("ln-811", cycleOneProfileId, "child-profile-1"),
    })]);
    run(["record-worker-result", "--project-root", projectRoot, "--slug", "neg-test", "--payload", JSON.stringify(
        workerSummary("child-profile-1", "ln-811", cycleOneProfileId, {
            baseline: { wall_time_ms: 5000 },
            cycle: 1,
        }),
    )]);
    run(["advance", "--project-root", projectRoot, "--slug", "neg-test", "--to", PHASES.WRONG_TOOL_GATE]);

    // TEST 1: BLOCK verdict should prevent RESEARCH
    run([
        "checkpoint", "--project-root", projectRoot, "--slug", "neg-test",
        "--phase", PHASES.WRONG_TOOL_GATE,
        "--payload", JSON.stringify({ gate_verdict: OPTIMIZATION_GATE_VERDICTS.BLOCK }),
    ]);
    const blocked1 = run([
        "advance", "--project-root", projectRoot, "--slug", "neg-test",
        "--to", PHASES.RESEARCH,
    ], { allowFailure: true });
    if (blocked1.ok !== false || !String(blocked1.error || "").includes("Wrong Tool Gate")) {
        throw new Error("Expected RESEARCH blocked after BLOCK verdict");
    }

    // TEST 2: DONE without final_result should block
    // Reset gate to PROCEED and fast-forward to REPORT
    run([
        "checkpoint", "--project-root", projectRoot, "--slug", "neg-test",
        "--phase", PHASES.WRONG_TOOL_GATE,
        "--payload", JSON.stringify({ gate_verdict: OPTIMIZATION_GATE_VERDICTS.PROCEED }),
    ]);
    run(["advance", "--project-root", projectRoot, "--slug", "neg-test", "--to", PHASES.RESEARCH]);
    run(["checkpoint", "--project-root", projectRoot, "--slug", "neg-test", "--phase", PHASES.RESEARCH, "--payload", JSON.stringify({
        hypotheses_count: 1,
        child_run: childRun("ln-812", cycleOneResearchId, "child-research-1"),
    })]);
    run(["record-worker-result", "--project-root", projectRoot, "--slug", "neg-test", "--payload", JSON.stringify(
        workerSummary("child-research-1", "ln-812", cycleOneResearchId, {
            hypotheses: ["H1"],
            cycle: 1,
        }),
    )]);
    run(["advance", "--project-root", projectRoot, "--slug", "neg-test", "--to", PHASES.SET_TARGET]);
    run(["checkpoint", "--project-root", projectRoot, "--slug", "neg-test", "--phase", PHASES.SET_TARGET, "--payload", "{\"target_metric\":{\"value\":500}}"]);
    run(["advance", "--project-root", projectRoot, "--slug", "neg-test", "--to", PHASES.WRITE_CONTEXT]);
    run(["checkpoint", "--project-root", projectRoot, "--slug", "neg-test", "--phase", PHASES.WRITE_CONTEXT, "--payload", "{\"context_file\":\"ctx.md\"}"]);
    run(["advance", "--project-root", projectRoot, "--slug", "neg-test", "--to", PHASES.VALIDATE_PLAN]);
    run(["checkpoint", "--project-root", projectRoot, "--slug", "neg-test", "--phase", PHASES.VALIDATE_PLAN, "--payload", JSON.stringify({
        validation_verdict: "GO",
        child_run: childRun("ln-813", cycleOneValidateId, "child-validate-1"),
    })]);
    run(["record-worker-result", "--project-root", projectRoot, "--slug", "neg-test", "--payload", JSON.stringify(
        workerSummary("child-validate-1", "ln-813", cycleOneValidateId, {
            verdict: "GO",
            cycle: 1,
        }),
    )]);
    run(["advance", "--project-root", projectRoot, "--slug", "neg-test", "--to", PHASES.EXECUTE]);
    run(["checkpoint", "--project-root", projectRoot, "--slug", "neg-test", "--phase", PHASES.EXECUTE, "--payload", JSON.stringify({
        execution_result: { target_met: true },
        child_run: childRun("ln-814", cycleOneExecuteId, "child-execute-1"),
    })]);
    run(["record-worker-result", "--project-root", projectRoot, "--slug", "neg-test", "--payload", JSON.stringify(
        workerSummary("child-execute-1", "ln-814", cycleOneExecuteId, {
            target_met: true,
            cycle: 1,
        }),
    )]);
    run(["advance", "--project-root", projectRoot, "--slug", "neg-test", "--to", PHASES.CYCLE_BOUNDARY]);
    run(["checkpoint", "--project-root", projectRoot, "--slug", "neg-test", "--phase", PHASES.CYCLE_BOUNDARY, "--payload", "{\"stop_reason\":\"TARGET_MET\"}"]);
    run(["advance", "--project-root", projectRoot, "--slug", "neg-test", "--to", PHASES.AGGREGATE]);
    run(["checkpoint", "--project-root", projectRoot, "--slug", "neg-test", "--phase", PHASES.AGGREGATE]);
    run(["advance", "--project-root", projectRoot, "--slug", "neg-test", "--to", PHASES.REPORT]);
    run([
        "checkpoint", "--project-root", projectRoot, "--slug", "neg-test",
        "--phase", PHASES.REPORT,
        "--payload", JSON.stringify({ report_ready: true }),
    ]);
    const blocked2 = run([
        "complete", "--project-root", projectRoot, "--slug", "neg-test",
    ], { allowFailure: true });
    if (blocked2.ok !== false || !String(blocked2.error || "").includes("Final result")) {
        throw new Error("Expected DONE blocked without final_result");
    }

    process.stdout.write("optimization-runtime negative passed\n");
} finally {
    rmSync(projectRoot, { recursive: true, force: true });
}
