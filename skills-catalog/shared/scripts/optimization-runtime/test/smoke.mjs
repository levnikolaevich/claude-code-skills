#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
    OPTIMIZATION_CYCLE_STATUSES,
    OPTIMIZATION_GATE_VERDICTS,
    OPTIMIZATION_VALIDATION_VERDICTS,
} from "../../coordinator-runtime/lib/runtime-constants.mjs";
import { PHASES } from "../lib/phases.mjs";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const cliPath = join(__dirname, "..", "cli.mjs");
const projectRoot = mkdtempSync(join(tmpdir(), "optimization-runtime-"));

function run(args) {
    return JSON.parse(execFileSync("node", [cliPath, ...args], {
        cwd: projectRoot,
        encoding: "utf8",
    }));
}

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

function coordinatorSummary(runId, identifier, payload) {
    return {
        schema_version: "1.0.0",
        summary_kind: "optimization-coordinator",
        run_id: runId,
        identifier,
        producer_skill: "ln-810",
        produced_at: new Date().toISOString(),
        payload: {
            status: "completed",
            ...payload,
        },
    };
}

try {
    const manifestPath = join(projectRoot, "manifest.json");
    writeFileSync(manifestPath, JSON.stringify({
        slug: "align-endpoint",
        target: "src/api/alignment.py::align_endpoint",
        observed_metric: { type: "response_time", value: 6300, unit: "ms" },
        cycle_config: { max_cycles: 3, plateau_threshold: 5 },
        execution_mode: "execute",
    }, null, 2));

    const started = run(["start", "--project-root", projectRoot, "--slug", "align-endpoint", "--manifest-file", manifestPath]);
    if (!started.ok) {
        throw new Error("Failed to start optimization runtime");
    }

    const optimizationRunId = started.run_id;
    const cycleOneProfileId = "ln-811--align-endpoint--cycle-1";
    const cycleOneResearchId = "ln-812--align-endpoint--cycle-1";
    const cycleOneValidateId = "ln-813--align-endpoint--cycle-1";
    const cycleOneExecuteId = "ln-814--align-endpoint--cycle-1";

    run(["checkpoint", "--project-root", projectRoot, "--slug", "align-endpoint", "--phase", PHASES.PREFLIGHT]);
    run(["advance", "--project-root", projectRoot, "--slug", "align-endpoint", "--to", PHASES.PARSE_INPUT]);
    run(["checkpoint", "--project-root", projectRoot, "--slug", "align-endpoint", "--phase", PHASES.PARSE_INPUT, "--payload", "{\"target_metric\":{\"value\":500,\"unit\":\"ms\"}}"]);
    run(["advance", "--project-root", projectRoot, "--slug", "align-endpoint", "--to", PHASES.PROFILE]);
    run(["checkpoint", "--project-root", projectRoot, "--slug", "align-endpoint", "--phase", PHASES.PROFILE, "--payload", JSON.stringify({
        child_run: childRun("ln-811", cycleOneProfileId, "child-profile-1"),
    })]);
    run(["record-worker-result", "--project-root", projectRoot, "--slug", "align-endpoint", "--payload", JSON.stringify(
        workerSummary("child-profile-1", "ln-811", cycleOneProfileId, {
            baseline: { wall_time_ms: 6300 },
            cycle: 1,
        }),
    )]);
    run(["advance", "--project-root", projectRoot, "--slug", "align-endpoint", "--to", PHASES.WRONG_TOOL_GATE]);
    run(["checkpoint", "--project-root", projectRoot, "--slug", "align-endpoint", "--phase", PHASES.WRONG_TOOL_GATE, "--payload", JSON.stringify({ gate_verdict: OPTIMIZATION_GATE_VERDICTS.PROCEED })]);
    run(["advance", "--project-root", projectRoot, "--slug", "align-endpoint", "--to", PHASES.RESEARCH]);
    run(["checkpoint", "--project-root", projectRoot, "--slug", "align-endpoint", "--phase", PHASES.RESEARCH, "--payload", JSON.stringify({
        hypotheses_count: 1,
        child_run: childRun("ln-812", cycleOneResearchId, "child-research-1"),
    })]);
    run(["record-worker-result", "--project-root", projectRoot, "--slug", "align-endpoint", "--payload", JSON.stringify(
        workerSummary("child-research-1", "ln-812", cycleOneResearchId, {
            hypotheses: ["H1"],
            cycle: 1,
        }),
    )]);
    run(["advance", "--project-root", projectRoot, "--slug", "align-endpoint", "--to", PHASES.SET_TARGET]);
    run(["checkpoint", "--project-root", projectRoot, "--slug", "align-endpoint", "--phase", PHASES.SET_TARGET, "--payload", "{\"target_metric\":{\"value\":500,\"unit\":\"ms\"}}"]);
    run(["advance", "--project-root", projectRoot, "--slug", "align-endpoint", "--to", PHASES.WRITE_CONTEXT]);
    run(["checkpoint", "--project-root", projectRoot, "--slug", "align-endpoint", "--phase", PHASES.WRITE_CONTEXT, "--payload", "{\"context_file\":\".hex-skills/optimization/align-endpoint/context.md\"}"]);
    run(["advance", "--project-root", projectRoot, "--slug", "align-endpoint", "--to", PHASES.VALIDATE_PLAN]);
    run(["checkpoint", "--project-root", projectRoot, "--slug", "align-endpoint", "--phase", PHASES.VALIDATE_PLAN, "--payload", JSON.stringify({
        validation_verdict: OPTIMIZATION_VALIDATION_VERDICTS.GO,
        child_run: childRun("ln-813", cycleOneValidateId, "child-validate-1"),
    })]);
    run(["record-worker-result", "--project-root", projectRoot, "--slug", "align-endpoint", "--payload", JSON.stringify(
        workerSummary("child-validate-1", "ln-813", cycleOneValidateId, {
            verdict: OPTIMIZATION_VALIDATION_VERDICTS.GO,
            cycle: 1,
        }),
    )]);
    run(["advance", "--project-root", projectRoot, "--slug", "align-endpoint", "--to", PHASES.EXECUTE]);
    run(["checkpoint", "--project-root", projectRoot, "--slug", "align-endpoint", "--phase", PHASES.EXECUTE, "--payload", JSON.stringify({
        child_run: childRun("ln-814", cycleOneExecuteId, "child-execute-1"),
    })]);
    run(["record-worker-result", "--project-root", projectRoot, "--slug", "align-endpoint", "--payload", JSON.stringify(
        workerSummary("child-execute-1", "ln-814", cycleOneExecuteId, {
            target_met: true,
            total_improvement_pct: 92.1,
            cycle: 1,
        }),
    )]);
    run(["advance", "--project-root", projectRoot, "--slug", "align-endpoint", "--to", PHASES.CYCLE_BOUNDARY]);
    run(["record-cycle", "--project-root", projectRoot, "--slug", "align-endpoint", "--payload", JSON.stringify({
        cycle: 1,
        status: OPTIMIZATION_CYCLE_STATUSES.COMPLETED,
        stop_reason: "TARGET_MET",
        final_result: "TARGET_MET",
    })]);
    run(["checkpoint", "--project-root", projectRoot, "--slug", "align-endpoint", "--phase", PHASES.CYCLE_BOUNDARY, "--payload", "{\"stop_reason\":\"TARGET_MET\",\"final_result\":\"TARGET_MET\"}"]);
    run(["advance", "--project-root", projectRoot, "--slug", "align-endpoint", "--to", PHASES.AGGREGATE]);
    run(["checkpoint", "--project-root", projectRoot, "--slug", "align-endpoint", "--phase", PHASES.AGGREGATE]);
    run(["advance", "--project-root", projectRoot, "--slug", "align-endpoint", "--to", PHASES.REPORT]);
    run(["checkpoint", "--project-root", projectRoot, "--slug", "align-endpoint", "--phase", PHASES.REPORT, "--payload", "{\"report_ready\":true,\"final_result\":\"TARGET_MET\"}"]);
    run(["record-summary", "--project-root", projectRoot, "--slug", "align-endpoint", "--payload", JSON.stringify(
        coordinatorSummary(optimizationRunId, "align-endpoint", {
            final_result: "TARGET_MET",
            cycle_count: 1,
            stop_reason: "TARGET_MET",
            report_ready: true,
            execution_mode: "execute",
            target_met: true,
            total_improvement_pct: 92.1,
        }),
    )]);
    const completed = run(["complete", "--project-root", projectRoot, "--slug", "align-endpoint"]);

    if (!completed.ok || completed.state.phase !== PHASES.DONE) {
        throw new Error("Optimization runtime did not complete");
    }

    process.stdout.write("optimization-runtime smoke passed\n");
} finally {
    rmSync(projectRoot, { recursive: true, force: true });
}
