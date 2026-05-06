import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
    createJsonCliRunner,
    createProjectRoot,
    writeJson,
} from "../../coordinator-runtime/test/cli-test-helpers.mjs";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../../..");
const cliPath = join(repoRoot, "references/scripts/evaluation-runtime/cli.mjs");

function assert(condition, message) {
    if (!condition) {
        throw new Error(message);
    }
}

const projectRoot = createProjectRoot("evaluation-runtime-smoke-");
const run = createJsonCliRunner(cliPath, projectRoot);
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

const started = run(["start", "--skill", "ln-310", "--identifier", "smoke", "--manifest-file", manifestPath]);
assert(started.ok === true, "evaluation runtime should start");

run(["checkpoint", "--skill", "ln-310", "--identifier", "smoke", "--phase", "PHASE_0_CONFIG", "--payload", JSON.stringify({ initialized: true })]);
run(["advance", "--skill", "ln-310", "--identifier", "smoke", "--to", "PHASE_1_EVIDENCE"]);
run(["checkpoint", "--skill", "ln-310", "--identifier", "smoke", "--phase", "PHASE_1_EVIDENCE", "--payload", JSON.stringify({ research_completed: true })]);
run(["advance", "--skill", "ln-310", "--identifier", "smoke", "--to", "PHASE_2_REPORT"]);
run(["checkpoint", "--skill", "ln-310", "--identifier", "smoke", "--phase", "PHASE_2_REPORT", "--payload", JSON.stringify({ report_written: true, final_result: "GO" })]);
run(["advance", "--skill", "ln-310", "--identifier", "smoke", "--to", "PHASE_3_SELF_CHECK"]);
run(["checkpoint", "--skill", "ln-310", "--identifier", "smoke", "--phase", "PHASE_3_SELF_CHECK", "--payload", JSON.stringify({ pass: true, cleanup_verified: true, final_result: "GO" })]);

const summary = {
    schema_version: "1.0.0",
    summary_kind: "evaluation-coordinator",
    run_id: started.run_id,
    identifier: "smoke",
    producer_skill: "ln-310",
    produced_at: new Date().toISOString(),
    payload: {
        status: "completed",
        final_result: "GO",
        report_path: "docs/project/evaluation_report.md",
        worker_count: 0,
        agent_count: 0,
        issues_total: 0,
        severity_counts: { critical: 0, high: 0, medium: 0, low: 0 },
        warnings: [],
        cleanup_verified: true,
        research_completed: true,
        metadata: {},
    },
};

run(["record-summary", "--skill", "ln-310", "--identifier", "smoke", "--payload", JSON.stringify(summary)]);
const completed = run(["complete", "--skill", "ln-310", "--identifier", "smoke"]);
assert(completed.ok === true, "evaluation runtime should complete");

process.stdout.write("evaluation runtime smoke passed\n");
