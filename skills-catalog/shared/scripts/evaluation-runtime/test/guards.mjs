#!/usr/bin/env node

import { rmSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
    createJsonCliRunner,
    createProjectRoot,
    writeJson,
} from "../../coordinator-runtime/test/cli-test-helpers.mjs";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../../..");
const cliPath = join(repoRoot, "shared/scripts/evaluation-runtime/cli.mjs");
const projectRoot = createProjectRoot("evaluation-runtime-guards-");
const run = createJsonCliRunner(cliPath, projectRoot);

function assert(condition, message) {
    if (!condition) {
        throw new Error(message);
    }
}

function summary(runId) {
    return {
        schema_version: "1.0.0",
        summary_kind: "evaluation-coordinator",
        run_id: runId,
        identifier: "guards",
        producer_skill: "ln-310",
        produced_at: "2026-04-10T00:00:00Z",
        payload: {
            status: "completed",
            final_result: "GO",
            report_path: "docs/project/evaluation_report.md",
            worker_count: 1,
            agent_count: 0,
            issues_total: 0,
            severity_counts: { critical: 0, high: 0, medium: 0, low: 0 },
            warnings: [],
            cleanup_verified: true,
            research_completed: true,
            metadata: {},
        },
    };
}

try {
    const manifestPath = join(projectRoot, "evaluation-manifest.json");
    writeJson(manifestPath, {
        phase_order: ["PHASE_0_CONFIG", "PHASE_1_EVIDENCE", "PHASE_2_REPORT", "PHASE_3_SELF_CHECK"],
        phase_policy: {
            delegate_phases: ["PHASE_1_EVIDENCE"],
            report_phase: "PHASE_2_REPORT",
            cleanup_phase: "PHASE_3_SELF_CHECK",
            self_check_phase: "PHASE_3_SELF_CHECK",
        },
        report_path: "docs/project/evaluation_report.md",
    });

    const started = run(["start", "--skill", "ln-310", "--identifier", "guards", "--manifest-file", manifestPath]);

    const missingCheckpoint = run(["advance", "--skill", "ln-310", "--identifier", "guards", "--to", "PHASE_1_EVIDENCE"], { allowFailure: true });
    assert(String(missingCheckpoint.error || "").includes("Checkpoint missing for PHASE_0_CONFIG"), `Expected missing checkpoint guard, got: ${JSON.stringify(missingCheckpoint)}`);

    run(["checkpoint", "--skill", "ln-310", "--identifier", "guards", "--phase", "PHASE_0_CONFIG", "--payload", JSON.stringify({ initialized: true })]);
    run(["advance", "--skill", "ln-310", "--identifier", "guards", "--to", "PHASE_1_EVIDENCE"]);

    run(["checkpoint", "--skill", "ln-310", "--identifier", "guards", "--phase", "PHASE_1_EVIDENCE", "--payload", JSON.stringify({
        research_completed: true,
        worker_plan: [{ worker: "ln-311", identifier: "research" }],
    })]);

    const missingWorkerSummary = run(["advance", "--skill", "ln-310", "--identifier", "guards", "--to", "PHASE_2_REPORT"], { allowFailure: true });
    assert(String(missingWorkerSummary.error || "").includes("Worker summaries missing"), `Expected worker summary guard, got: ${JSON.stringify(missingWorkerSummary)}`);

    run(["record-worker-result", "--skill", "ln-310", "--identifier", "guards", "--payload", JSON.stringify({
        schema_version: "1.0.0",
        summary_kind: "review-research",
        run_id: started.run_id,
        identifier: "research",
        producer_skill: "ln-311",
        produced_at: "2026-04-10T00:00:00Z",
        payload: {
            status: "completed",
            worker: "ln-311-review-research-worker",
            operation: "research",
            warnings: [],
        },
    })]);

    run(["advance", "--skill", "ln-310", "--identifier", "guards", "--to", "PHASE_2_REPORT"]);
    run(["checkpoint", "--skill", "ln-310", "--identifier", "guards", "--phase", "PHASE_2_REPORT", "--payload", JSON.stringify({
        report_written: true,
        aggregation_summary: { merged: true },
        final_result: "GO",
    })]);
    run(["advance", "--skill", "ln-310", "--identifier", "guards", "--to", "PHASE_3_SELF_CHECK"]);
    run(["checkpoint", "--skill", "ln-310", "--identifier", "guards", "--phase", "PHASE_3_SELF_CHECK", "--payload", JSON.stringify({
        pass: true,
        cleanup_verified: true,
        final_result: "GO",
    })]);

    const noSummaryDone = run(["complete", "--skill", "ln-310", "--identifier", "guards"], { allowFailure: true });
    assert(String(noSummaryDone.error || "").includes("summary"), `Expected summary-before-complete guard, got: ${JSON.stringify(noSummaryDone)}`);

    run(["record-summary", "--skill", "ln-310", "--identifier", "guards", "--payload", JSON.stringify(summary(started.run_id))]);
    const completed = run(["complete", "--skill", "ln-310", "--identifier", "guards"]);
    assert(completed.ok === true, "evaluation runtime should complete after summary + self-check");

    process.stdout.write("evaluation runtime guards passed\n");
} finally {
    rmSync(projectRoot, { recursive: true, force: true });
}
