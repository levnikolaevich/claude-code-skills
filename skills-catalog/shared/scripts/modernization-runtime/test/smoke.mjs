#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { PHASES } from "../lib/phases.mjs";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const cliPath = join(__dirname, "..", "cli.mjs");
const projectRoot = mkdtempSync(join(tmpdir(), "modernization-runtime-"));

function run(args) {
    return JSON.parse(execFileSync("node", [cliPath, ...args], {
        cwd: projectRoot,
        encoding: "utf8",
    }));
}

function childRun(worker, runId) {
    return { worker, run_id: runId, identifier: worker };
}

function workerSummary(runId, worker, payload = {}) {
    return {
        schema_version: "1.0.0",
        summary_kind: "modernization-worker",
        run_id: runId,
        identifier: worker,
        producer_skill: worker,
        produced_at: new Date().toISOString(),
        payload: {
            status: "completed",
            worker,
            changes_applied: 1,
            changes_discarded: 0,
            tests_passed: true,
            build_passed: true,
            modules_replaced: 0,
            loc_removed: 0,
            bundle_reduction_bytes: 0,
            ...payload,
        },
    };
}

function coordinatorSummary(runId, identifier) {
    return {
        schema_version: "1.0.0",
        summary_kind: "modernization-coordinator",
        run_id: runId,
        identifier,
        producer_skill: "ln-830",
        produced_at: new Date().toISOString(),
        payload: {
            status: "completed",
            final_result: "success",
            worker_count: 2,
            verification_passed: true,
            report_ready: true,
            modules_replaced: 1,
            loc_removed: 120,
            bundle_reduction_bytes: 42000,
        },
    };
}

try {
    const manifestPath = join(projectRoot, "manifest.json");
    writeFileSync(manifestPath, JSON.stringify({ identifier: "repo-modernization" }, null, 2));

    const started = run(["start", "--project-root", projectRoot, "--identifier", "repo-modernization", "--manifest-file", manifestPath]);
    const runtimeRunId = started.run_id;

    run(["checkpoint", "--project-root", projectRoot, "--identifier", "repo-modernization", "--phase", PHASES.PREFLIGHT]);
    run(["advance", "--project-root", projectRoot, "--identifier", "repo-modernization", "--to", PHASES.ANALYZE_INPUT]);
    run(["checkpoint", "--project-root", projectRoot, "--identifier", "repo-modernization", "--phase", PHASES.ANALYZE_INPUT, "--payload", "{\"worker_plan\":[\"ln-831\",\"ln-832\"]}"]);
    run(["advance", "--project-root", projectRoot, "--identifier", "repo-modernization", "--to", PHASES.DELEGATE_WORKERS]);
    run(["checkpoint", "--project-root", projectRoot, "--identifier", "repo-modernization", "--phase", PHASES.DELEGATE_WORKERS, "--payload", JSON.stringify({
        worker_plan: ["ln-831", "ln-832"],
        child_run: childRun("ln-831", "child-ln-831"),
    })]);
    run(["checkpoint", "--project-root", projectRoot, "--identifier", "repo-modernization", "--phase", PHASES.DELEGATE_WORKERS, "--payload", JSON.stringify({
        child_run: childRun("ln-832", "child-ln-832"),
    })]);
    run(["record-worker-result", "--project-root", projectRoot, "--identifier", "repo-modernization", "--payload", JSON.stringify(
        workerSummary("child-ln-831", "ln-831", { modules_replaced: 1, loc_removed: 120 }),
    )]);
    run(["record-worker-result", "--project-root", projectRoot, "--identifier", "repo-modernization", "--payload", JSON.stringify(
        workerSummary("child-ln-832", "ln-832", { bundle_reduction_bytes: 42000 }),
    )]);
    run(["advance", "--project-root", projectRoot, "--identifier", "repo-modernization", "--to", PHASES.COLLECT_RESULTS]);
    run(["checkpoint", "--project-root", projectRoot, "--identifier", "repo-modernization", "--phase", PHASES.COLLECT_RESULTS]);
    run(["advance", "--project-root", projectRoot, "--identifier", "repo-modernization", "--to", PHASES.VERIFY_SUMMARY]);
    run(["checkpoint", "--project-root", projectRoot, "--identifier", "repo-modernization", "--phase", PHASES.VERIFY_SUMMARY, "--payload", "{\"verification_passed\":true}"]);
    run(["advance", "--project-root", projectRoot, "--identifier", "repo-modernization", "--to", PHASES.REPORT]);
    run(["checkpoint", "--project-root", projectRoot, "--identifier", "repo-modernization", "--phase", PHASES.REPORT, "--payload", "{\"report_ready\":true,\"final_result\":\"success\"}"]);
    run(["record-summary", "--project-root", projectRoot, "--identifier", "repo-modernization", "--payload", JSON.stringify(
        coordinatorSummary(runtimeRunId, "repo-modernization"),
    )]);
    const completed = run(["complete", "--project-root", projectRoot, "--identifier", "repo-modernization"]);

    if (!completed.ok || completed.state.phase !== PHASES.DONE) {
        throw new Error("Modernization runtime did not complete");
    }

    process.stdout.write("modernization-runtime smoke passed\n");
} finally {
    rmSync(projectRoot, { recursive: true, force: true });
}
