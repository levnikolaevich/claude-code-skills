#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { WORKER_SUMMARY_STATUSES } from "../../coordinator-runtime/lib/runtime-constants.mjs";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const cliPath = join(__dirname, "..", "cli.mjs");
const projectRoot = mkdtempSync(join(tmpdir(), "audit-runtime-smoke-"));

function run(args) {
    return JSON.parse(execFileSync("node", [cliPath, ...args], {
        cwd: projectRoot,
        encoding: "utf8",
    }));
}

try {
    const manifestPath = join(projectRoot, "manifest.json");
    writeFileSync(manifestPath, JSON.stringify({
        mode: "codebase_audit",
        phase_order: [
            "PHASE_0_CONFIG",
            "PHASE_1_DISCOVERY",
            "PHASE_2_DELEGATE",
            "PHASE_3_AGGREGATE",
            "PHASE_4_REPORT",
            "PHASE_5_RESULTS_LOG",
            "PHASE_6_CLEANUP",
            "PHASE_7_SELF_CHECK",
        ],
        phase_policy: {
            delegate_phases: ["PHASE_2_DELEGATE"],
            aggregate_phase: "PHASE_3_AGGREGATE",
            report_phase: "PHASE_4_REPORT",
            results_log_phase: "PHASE_5_RESULTS_LOG",
            cleanup_phase: "PHASE_6_CLEANUP",
            self_check_phase: "PHASE_7_SELF_CHECK",
        },
        report_path: "docs/project/codebase_audit.md",
        results_log_path: "docs/project/.audit/results_log.md",
    }, null, 2));

    const started = run([
        "start",
        "--project-root", projectRoot,
        "--skill", "ln-620",
        "--identifier", "global",
        "--manifest-file", manifestPath,
    ]);
    if (!started.ok) {
        throw new Error("Failed to start audit runtime");
    }

    run(["checkpoint", "--project-root", projectRoot, "--skill", "ln-620", "--identifier", "global", "--phase", "PHASE_0_CONFIG"]);
    run(["advance", "--project-root", projectRoot, "--skill", "ln-620", "--identifier", "global", "--to", "PHASE_1_DISCOVERY"]);
    run(["checkpoint", "--project-root", projectRoot, "--skill", "ln-620", "--identifier", "global", "--phase", "PHASE_1_DISCOVERY"]);
    run(["advance", "--project-root", projectRoot, "--skill", "ln-620", "--identifier", "global", "--to", "PHASE_2_DELEGATE"]);
    run([
        "checkpoint",
        "--project-root", projectRoot,
        "--skill", "ln-620",
        "--identifier", "global",
        "--phase", "PHASE_2_DELEGATE",
        "--payload",
        "{\"worker_plan\":[\"ln-621--global\"],\"child_run\":{\"worker\":\"ln-621\",\"identifier\":\"global\",\"run_id\":\"ln-620-global-smoke--ln-621--global\",\"summary_artifact_path\":\".hex-skills/runtime-artifacts/runs/ln-620-global-smoke/audit-worker/ln-621--global.json\",\"phase_context\":\"delegate\"}}",
    ]);
    run([
        "record-worker-result",
        "--project-root", projectRoot,
        "--skill", "ln-620",
        "--identifier", "global",
        "--payload",
        JSON.stringify({
            schema_version: "1.0.0",
            summary_kind: "audit-worker",
            run_id: `${started.run_id}--ln-621--global`,
            identifier: "global",
            producer_skill: "ln-621",
            produced_at: new Date().toISOString(),
            payload: {
                status: WORKER_SUMMARY_STATUSES.COMPLETED,
                category: "Security",
                report_path: ".hex-skills/runtime-artifacts/runs/demo/audit-report/ln-621--global.md",
                score: 8.5,
                issues_total: 1,
                severity_counts: { critical: 0, high: 1, medium: 0, low: 0 },
                warnings: [],
            },
        }),
    ]);
    run(["advance", "--project-root", projectRoot, "--skill", "ln-620", "--identifier", "global", "--to", "PHASE_3_AGGREGATE"]);
    run([
        "checkpoint",
        "--project-root", projectRoot,
        "--skill", "ln-620",
        "--identifier", "global",
        "--phase", "PHASE_3_AGGREGATE",
        "--payload",
        "{\"aggregation_summary\":{\"overall_score\":8.5,\"worker_count\":1}}",
    ]);
    run(["advance", "--project-root", projectRoot, "--skill", "ln-620", "--identifier", "global", "--to", "PHASE_4_REPORT"]);
    run([
        "checkpoint",
        "--project-root", projectRoot,
        "--skill", "ln-620",
        "--identifier", "global",
        "--phase", "PHASE_4_REPORT",
        "--payload",
        "{\"report_written\":true,\"report_path\":\"docs/project/codebase_audit.md\"}",
    ]);
    run(["advance", "--project-root", projectRoot, "--skill", "ln-620", "--identifier", "global", "--to", "PHASE_5_RESULTS_LOG"]);
    run([
        "checkpoint",
        "--project-root", projectRoot,
        "--skill", "ln-620",
        "--identifier", "global",
        "--phase", "PHASE_5_RESULTS_LOG",
        "--payload",
        "{\"results_log_appended\":true,\"log_row\":\"2026-03-27\"}",
    ]);
    run(["advance", "--project-root", projectRoot, "--skill", "ln-620", "--identifier", "global", "--to", "PHASE_6_CLEANUP"]);
    run([
        "checkpoint",
        "--project-root", projectRoot,
        "--skill", "ln-620",
        "--identifier", "global",
        "--phase", "PHASE_6_CLEANUP",
        "--payload",
        "{\"cleanup_completed\":true}",
    ]);
    run(["advance", "--project-root", projectRoot, "--skill", "ln-620", "--identifier", "global", "--to", "PHASE_7_SELF_CHECK"]);
    run([
        "checkpoint",
        "--project-root", projectRoot,
        "--skill", "ln-620",
        "--identifier", "global",
        "--phase", "PHASE_7_SELF_CHECK",
        "--payload",
        "{\"pass\":true,\"final_result\":\"AUDIT_COMPLETE\"}",
    ]);
    run([
        "record-summary",
        "--project-root", projectRoot,
        "--skill", "ln-620",
        "--identifier", "global",
        "--payload",
        JSON.stringify({
            schema_version: "1.0.0",
            summary_kind: "audit-coordinator",
            run_id: started.run_id,
            identifier: "global",
            producer_skill: "ln-620",
            produced_at: "2026-04-06T00:00:00Z",
            payload: {
                status: "completed",
                final_result: "AUDIT_COMPLETE",
                report_path: "docs/project/codebase_audit.md",
                results_log_path: "docs/project/.audit/results_log.md",
                overall_score: 8.5,
                worker_count: 1,
                issues_total: 1,
                severity_counts: { critical: 0, high: 1, medium: 0, low: 0 },
                warnings: [],
            },
        }),
    ]);

    const completed = run(["complete", "--project-root", projectRoot, "--skill", "ln-620", "--identifier", "global"]);
    if (!completed.ok || completed.state.phase !== "DONE") {
        throw new Error("Audit runtime did not complete successfully");
    }

    process.stdout.write("audit-runtime smoke passed\n");
} finally {
    rmSync(projectRoot, { recursive: true, force: true });
}
