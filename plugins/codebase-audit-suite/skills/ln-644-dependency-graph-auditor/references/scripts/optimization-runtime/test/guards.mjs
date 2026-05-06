#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
    OPTIMIZATION_GATE_VERDICTS,
    OPTIMIZATION_VALIDATION_VERDICTS,
} from "../../coordinator-runtime/lib/runtime-constants.mjs";
import { PHASES } from "../lib/phases.mjs";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const cliPath = join(__dirname, "..", "cli.mjs");

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

function createRuntime() {
    const root = mkdtempSync(join(tmpdir(), "optimization-guards-"));
    const manifestPath = join(root, "manifest.json");
    writeFileSync(manifestPath, JSON.stringify({
        slug: "guard-test",
        target: "src/test.py::fn",
        observed_metric: { type: "response_time", value: 5000, unit: "ms" },
        cycle_config: { max_cycles: 1, plateau_threshold: 5 },
        execution_mode: "execute",
    }, null, 2));

    const run = (args, options = {}) => {
        try {
            return JSON.parse(execFileSync("node", [cliPath, ...args], {
                cwd: root,
                encoding: "utf8",
                stdio: ["ignore", "pipe", "pipe"],
            }));
        } catch (error) {
            if (options.allowFailure) {
                return JSON.parse(error.stdout || error.stderr);
            }
            throw error;
        }
    };

    const started = run(["start", "--project-root", root, "--slug", "guard-test", "--manifest-file", manifestPath]);
    return { root, run, runtimeRunId: started.run_id };
}

function destroyRuntime(root) {
    try {
        rmSync(root, { recursive: true, force: true });
    } catch {}
}

let passed = 0;
let failed = 0;

function expect(name, result, expectedOk) {
    const ok = result.ok === expectedOk;
    if (ok) {
        passed++;
        process.stdout.write(`  PASS: ${name}\n`);
        return;
    }
    failed++;
    process.stdout.write(`  FAIL: ${name} (expected ok=${expectedOk}, got ok=${result.ok}, error=${result.error})\n`);
}

let runtimeOne;
let runtimeTwo;

try {
    runtimeOne = createRuntime();
    const { root, run } = runtimeOne;

    run(["checkpoint", "--project-root", root, "--slug", "guard-test", "--phase", PHASES.PREFLIGHT]);
    run(["advance", "--project-root", root, "--slug", "guard-test", "--to", PHASES.PARSE_INPUT]);
    run(["checkpoint", "--project-root", root, "--slug", "guard-test", "--phase", PHASES.PARSE_INPUT, "--payload", "{\"target_metric\":{\"value\":500}}"]);
    run(["advance", "--project-root", root, "--slug", "guard-test", "--to", PHASES.PROFILE]);
    run(["checkpoint", "--project-root", root, "--slug", "guard-test", "--phase", PHASES.PROFILE, "--payload", JSON.stringify({
        child_run: childRun("ln-811", "ln-811--guard-test--cycle-1", "child-profile-1"),
    })]);
    run(["record-worker-result", "--project-root", root, "--slug", "guard-test", "--payload", JSON.stringify(
        workerSummary("child-profile-1", "ln-811", "ln-811--guard-test--cycle-1", { cycle: 1 }),
    )]);
    run(["advance", "--project-root", root, "--slug", "guard-test", "--to", PHASES.WRONG_TOOL_GATE]);

    run(["checkpoint", "--project-root", root, "--slug", "guard-test", "--phase", PHASES.WRONG_TOOL_GATE, "--payload", JSON.stringify({
        gate_verdict: OPTIMIZATION_GATE_VERDICTS.BLOCK,
    })]);
    const t1 = run(["advance", "--project-root", root, "--slug", "guard-test", "--to", PHASES.RESEARCH], { allowFailure: true });
    expect("RESEARCH blocked with BLOCK verdict", t1, false);

    const t2 = run(["advance", "--project-root", root, "--slug", "guard-test", "--to", PHASES.AGGREGATE]);
    expect("AGGREGATE allowed from WRONG_TOOL_GATE with BLOCK", t2, true);

    runtimeTwo = createRuntime();
    const { root: root2, run: run2, runtimeRunId } = runtimeTwo;

    run2(["checkpoint", "--project-root", root2, "--slug", "guard-test", "--phase", PHASES.PREFLIGHT]);
    run2(["advance", "--project-root", root2, "--slug", "guard-test", "--to", PHASES.PARSE_INPUT]);
    run2(["checkpoint", "--project-root", root2, "--slug", "guard-test", "--phase", PHASES.PARSE_INPUT, "--payload", "{\"target_metric\":{\"value\":500}}"]);
    run2(["advance", "--project-root", root2, "--slug", "guard-test", "--to", PHASES.PROFILE]);
    run2(["checkpoint", "--project-root", root2, "--slug", "guard-test", "--phase", PHASES.PROFILE, "--payload", JSON.stringify({
        child_run: childRun("ln-811", "ln-811--guard-test--cycle-1", "child-profile-1"),
    })]);
    run2(["record-worker-result", "--project-root", root2, "--slug", "guard-test", "--payload", JSON.stringify(
        workerSummary("child-profile-1", "ln-811", "ln-811--guard-test--cycle-1", { cycle: 1 }),
    )]);
    run2(["advance", "--project-root", root2, "--slug", "guard-test", "--to", PHASES.WRONG_TOOL_GATE]);

    run2(["checkpoint", "--project-root", root2, "--slug", "guard-test", "--phase", PHASES.WRONG_TOOL_GATE, "--payload", JSON.stringify({
        gate_verdict: OPTIMIZATION_GATE_VERDICTS.PROCEED,
    })]);
    const t3 = run2(["advance", "--project-root", root2, "--slug", "guard-test", "--to", PHASES.RESEARCH]);
    expect("RESEARCH allowed with PROCEED verdict", t3, true);

    run2(["checkpoint", "--project-root", root2, "--slug", "guard-test", "--phase", PHASES.RESEARCH, "--payload", JSON.stringify({
        hypotheses_count: 3,
        child_run: childRun("ln-812", "ln-812--guard-test--cycle-1", "child-research-1"),
    })]);
    run2(["record-worker-result", "--project-root", root2, "--slug", "guard-test", "--payload", JSON.stringify(
        workerSummary("child-research-1", "ln-812", "ln-812--guard-test--cycle-1", { cycle: 1 }),
    )]);
    const t4 = run2(["advance", "--project-root", root2, "--slug", "guard-test", "--to", PHASES.AGGREGATE], { allowFailure: true });
    expect("AGGREGATE blocked from RESEARCH with hypotheses", t4, false);

    run2(["advance", "--project-root", root2, "--slug", "guard-test", "--to", PHASES.SET_TARGET]);
    run2(["checkpoint", "--project-root", root2, "--slug", "guard-test", "--phase", PHASES.SET_TARGET, "--payload", "{\"target_metric\":{\"value\":500}}"]);
    run2(["advance", "--project-root", root2, "--slug", "guard-test", "--to", PHASES.WRITE_CONTEXT]);

    run2(["checkpoint", "--project-root", root2, "--slug", "guard-test", "--phase", PHASES.WRITE_CONTEXT]);
    const t5 = run2(["advance", "--project-root", root2, "--slug", "guard-test", "--to", PHASES.VALIDATE_PLAN], { allowFailure: true });
    expect("VALIDATE_PLAN blocked without context_file", t5, false);

    run2(["checkpoint", "--project-root", root2, "--slug", "guard-test", "--phase", PHASES.WRITE_CONTEXT, "--payload", "{\"context_file\":\"ctx.md\"}"]);
    const t6 = run2(["advance", "--project-root", root2, "--slug", "guard-test", "--to", PHASES.VALIDATE_PLAN]);
    expect("VALIDATE_PLAN allowed with context_file", t6, true);

    run2(["checkpoint", "--project-root", root2, "--slug", "guard-test", "--phase", PHASES.VALIDATE_PLAN, "--payload", JSON.stringify({
        validation_verdict: OPTIMIZATION_VALIDATION_VERDICTS.NO_GO,
        child_run: childRun("ln-813", "ln-813--guard-test--cycle-1", "child-validate-1"),
    })]);
    run2(["record-worker-result", "--project-root", root2, "--slug", "guard-test", "--payload", JSON.stringify(
        workerSummary("child-validate-1", "ln-813", "ln-813--guard-test--cycle-1", {
            verdict: OPTIMIZATION_VALIDATION_VERDICTS.NO_GO,
            cycle: 1,
        }),
    )]);
    const t7 = run2(["advance", "--project-root", root2, "--slug", "guard-test", "--to", PHASES.EXECUTE], { allowFailure: true });
    expect("EXECUTE blocked with NO_GO verdict", t7, false);

    run2(["checkpoint", "--project-root", root2, "--slug", "guard-test", "--phase", PHASES.VALIDATE_PLAN, "--payload", JSON.stringify({
        validation_verdict: OPTIMIZATION_VALIDATION_VERDICTS.GO,
        child_run: childRun("ln-813", "ln-813--guard-test--cycle-1", "child-validate-1"),
    })]);
    run2(["advance", "--project-root", root2, "--slug", "guard-test", "--to", PHASES.EXECUTE]);

    run2(["checkpoint", "--project-root", root2, "--slug", "guard-test", "--phase", PHASES.EXECUTE, "--payload", JSON.stringify({
        child_run: childRun("ln-814", "ln-814--guard-test--cycle-1", "child-execute-1"),
    })]);
    const t8 = run2(["advance", "--project-root", root2, "--slug", "guard-test", "--to", PHASES.CYCLE_BOUNDARY], { allowFailure: true });
    expect("CYCLE_BOUNDARY blocked without ln-814 summary", t8, false);

    run2(["record-worker-result", "--project-root", root2, "--slug", "guard-test", "--payload", JSON.stringify(
        workerSummary("child-execute-1", "ln-814", "ln-814--guard-test--cycle-1", {
            target_met: true,
            cycle: 1,
        }),
    )]);
    run2(["advance", "--project-root", root2, "--slug", "guard-test", "--to", PHASES.CYCLE_BOUNDARY]);
    run2(["checkpoint", "--project-root", root2, "--slug", "guard-test", "--phase", PHASES.CYCLE_BOUNDARY, "--payload", "{\"stop_reason\":\"TARGET_MET\",\"final_result\":\"TARGET_MET\"}"]);

    const t9 = run2(["advance", "--project-root", root2, "--slug", "guard-test", "--to", PHASES.PROFILE], { allowFailure: true });
    expect("PROFILE blocked after stop_reason", t9, false);

    run2(["advance", "--project-root", root2, "--slug", "guard-test", "--to", PHASES.AGGREGATE]);
    run2(["checkpoint", "--project-root", root2, "--slug", "guard-test", "--phase", PHASES.AGGREGATE]);
    run2(["advance", "--project-root", root2, "--slug", "guard-test", "--to", PHASES.REPORT]);
    run2(["checkpoint", "--project-root", root2, "--slug", "guard-test", "--phase", PHASES.REPORT, "--payload", "{\"final_result\":\"TARGET_MET\"}"]);
    const t10 = run2(["complete", "--project-root", root2, "--slug", "guard-test"], { allowFailure: true });
    expect("DONE blocked without report_ready", t10, false);

    run2(["checkpoint", "--project-root", root2, "--slug", "guard-test", "--phase", PHASES.REPORT, "--payload", "{\"report_ready\":true,\"final_result\":\"TARGET_MET\"}"]);
    const t11 = run2(["complete", "--project-root", root2, "--slug", "guard-test"], { allowFailure: true });
    expect("DONE blocked without coordinator summary", t11, false);

    run2(["record-summary", "--project-root", root2, "--slug", "guard-test", "--payload", JSON.stringify(
        coordinatorSummary(runtimeRunId, "guard-test", {
            final_result: "TARGET_MET",
            cycle_count: 1,
            stop_reason: "TARGET_MET",
            report_ready: true,
            execution_mode: "execute",
            target_met: true,
        }),
    )]);
    const t12 = run2(["complete", "--project-root", root2, "--slug", "guard-test"]);
    expect("DONE allowed after coordinator summary", t12, true);

    process.stdout.write(`\noptimization-runtime guards: ${passed} passed, ${failed} failed\n`);
    if (failed > 0) {
        process.exit(1);
    }
} finally {
    if (runtimeOne) {
        destroyRuntime(runtimeOne.root);
    }
    if (runtimeTwo) {
        destroyRuntime(runtimeTwo.root);
    }
}
