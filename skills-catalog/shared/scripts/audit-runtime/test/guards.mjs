#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { WORKER_SUMMARY_STATUSES } from "../../coordinator-runtime/lib/runtime-constants.mjs";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const cliPath = join(__dirname, "..", "cli.mjs");
const projectRoot = mkdtempSync(join(tmpdir(), "audit-guards-"));

let passed = 0;
let failed = 0;

function run(args, options = {}) {
    try {
        return JSON.parse(execFileSync("node", [cliPath, ...args], {
            cwd: projectRoot, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"],
        }));
    } catch (error) {
        if (options.allowFailure) { return JSON.parse(error.stdout || error.stderr); }
        throw error;
    }
}

function expect(name, result, expectedOk) {
    if (result.ok === expectedOk) { passed++; process.stdout.write(`  PASS: ${name}\n`); }
    else { failed++; process.stdout.write(`  FAIL: ${name} (expected ok=${expectedOk}, got ok=${result.ok}, error=${result.error})\n`); }
}

function workerSummary(producer, category) {
    return JSON.stringify({
        schema_version: "1.0.0", summary_kind: "audit-worker",
        run_id: `guards-test--${producer}--global`, identifier: "global",
        producer_skill: producer, produced_at: "2026-03-30T00:00:00Z",
        payload: {
            status: WORKER_SUMMARY_STATUSES.COMPLETED, category,
            report_path: `.hex-skills/runtime-artifacts/runs/guards-test/audit-report/${producer}--global.md`,
            score: 8, issues_total: 0,
            severity_counts: { critical: 0, high: 0, medium: 0, low: 0 },
            warnings: [],
        },
    });
}

const P = "--project-root";
const S = "--skill";
const I = "--identifier";

try {
    const manifestPath = join(projectRoot, "manifest.json");
    writeFileSync(manifestPath, JSON.stringify({
        phase_order: [
            "PHASE_0_CONFIG", "PHASE_1_DISCOVERY", "PHASE_2_DELEGATE",
            "PHASE_3_AGGREGATE", "PHASE_4_REPORT", "PHASE_5_RESULTS_LOG",
            "PHASE_6_CLEANUP", "PHASE_7_SELF_CHECK",
        ],
        phase_policy: {
            delegate_phases: ["PHASE_2_DELEGATE"],
            aggregate_phase: "PHASE_3_AGGREGATE",
            report_phase: "PHASE_4_REPORT",
            results_log_phase: "PHASE_5_RESULTS_LOG",
            cleanup_phase: "PHASE_6_CLEANUP",
            self_check_phase: "PHASE_7_SELF_CHECK",
        },
        report_path: "docs/project/audit.md",
    }, null, 2));

    run(["start", P, projectRoot, S, "ln-620", I, "full", "--manifest-file", manifestPath]);
    const runId = run(["status", P, projectRoot, S, "ln-620", I, "full"]).runtime.run_id;
    run(["checkpoint", P, projectRoot, S, "ln-620", I, "full", "--phase", "PHASE_0_CONFIG"]);
    run(["advance", P, projectRoot, S, "ln-620", I, "full", "--to", "PHASE_1_DISCOVERY"]);
    run(["checkpoint", P, projectRoot, S, "ln-620", I, "full", "--phase", "PHASE_1_DISCOVERY",
        "--payload", JSON.stringify({ worker_plan: ["ln-621--global", "ln-623--global"] })]);
    run(["advance", P, projectRoot, S, "ln-620", I, "full", "--to", "PHASE_2_DELEGATE"]);
    run(["checkpoint", P, projectRoot, S, "ln-620", I, "full", "--phase", "PHASE_2_DELEGATE",
        "--payload", JSON.stringify({ child_run: {
            worker: "ln-621",
            identifier: "global",
            run_id: "guards-test--ln-621--global",
            summary_artifact_path: ".hex-skills/runtime-artifacts/runs/guards-test/audit-worker/ln-621--global.json",
            phase_context: "delegate",
        } })]);

    const t1 = run(["advance", P, projectRoot, S, "ln-620", I, "full", "--to", "PHASE_3_AGGREGATE"], { allowFailure: true });
    expect("AGGREGATE blocked without worker summaries", t1, false);

    run(["record-worker-result", P, projectRoot, S, "ln-620", I, "full",
        "--payload-file", (() => { const p = join(projectRoot, "w1.json"); writeFileSync(p, workerSummary("ln-621", "Security")); return p; })()]);

    const t2 = run(["advance", P, projectRoot, S, "ln-620", I, "full", "--to", "PHASE_3_AGGREGATE"], { allowFailure: true });
    expect("AGGREGATE blocked with 1/2 workers", t2, false);

    run(["record-worker-result", P, projectRoot, S, "ln-620", I, "full",
        "--payload-file", (() => { const p = join(projectRoot, "w2.json"); writeFileSync(p, workerSummary("ln-623", "Code Quality")); return p; })()]);

    const t3 = run(["advance", P, projectRoot, S, "ln-620", I, "full", "--to", "PHASE_3_AGGREGATE"]);
    expect("AGGREGATE allowed with 2/2 workers", t3, true);

    run(["checkpoint", P, projectRoot, S, "ln-620", I, "full", "--phase", "PHASE_3_AGGREGATE",
        "--payload", "{\"aggregation_summary\":{\"total\":2}}"]);
    run(["advance", P, projectRoot, S, "ln-620", I, "full", "--to", "PHASE_4_REPORT"]);
    run(["checkpoint", P, projectRoot, S, "ln-620", I, "full", "--phase", "PHASE_4_REPORT",
        "--payload", "{\"report_path\":\"docs/project/audit.md\"}"]);
    run(["advance", P, projectRoot, S, "ln-620", I, "full", "--to", "PHASE_5_RESULTS_LOG"]);
    run(["checkpoint", P, projectRoot, S, "ln-620", I, "full", "--phase", "PHASE_5_RESULTS_LOG",
        "--payload", "{\"results_log_appended\":true}"]);
    run(["advance", P, projectRoot, S, "ln-620", I, "full", "--to", "PHASE_6_CLEANUP"]);
    run(["checkpoint", P, projectRoot, S, "ln-620", I, "full", "--phase", "PHASE_6_CLEANUP",
        "--payload", "{\"cleanup_completed\":true}"]);
    run(["advance", P, projectRoot, S, "ln-620", I, "full", "--to", "PHASE_7_SELF_CHECK"]);

    run(["checkpoint", P, projectRoot, S, "ln-620", I, "full", "--phase", "PHASE_7_SELF_CHECK",
        "--payload", "{\"pass\":true}"]);
    const t4 = run(["complete", P, projectRoot, S, "ln-620", I, "full"], { allowFailure: true });
    expect("DONE blocked without final_result", t4, false);

    run(["checkpoint", P, projectRoot, S, "ln-620", I, "full", "--phase", "PHASE_7_SELF_CHECK",
        "--payload", "{\"pass\":true,\"final_result\":\"AUDIT_COMPLETE\"}"]);
    const t5 = run(["complete", P, projectRoot, S, "ln-620", I, "full"], { allowFailure: true });
    expect("DONE blocked without coordinator summary", t5, false);

    run(["record-summary", P, projectRoot, S, "ln-620", I, "full",
        "--payload",
        JSON.stringify({
            schema_version: "1.0.0",
            summary_kind: "audit-coordinator",
            run_id: runId,
            identifier: "full",
            producer_skill: "ln-620",
            produced_at: "2026-04-06T00:00:00Z",
            payload: {
                status: "completed",
                final_result: "AUDIT_COMPLETE",
                report_path: "docs/project/audit.md",
                results_log_path: "docs/project/.audit/results_log.md",
                overall_score: 8.0,
                worker_count: 2,
                issues_total: 0,
                severity_counts: { critical: 0, high: 0, medium: 0, low: 0 },
                warnings: [],
            },
        })]);
    const t6 = run(["complete", P, projectRoot, S, "ln-620", I, "full"]);
    expect("DONE allowed with coordinator summary", t6, true);

    process.stdout.write(`\naudit-runtime guards: ${passed} passed, ${failed} failed\n`);
    if (failed > 0) process.exit(1);
} finally {
    rmSync(projectRoot, { recursive: true, force: true });
}
