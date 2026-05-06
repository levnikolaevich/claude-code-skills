#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { PHASES } from "../lib/phases.mjs";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const cliPath = join(__dirname, "..", "cli.mjs");
const projectRoot = mkdtempSync(join(tmpdir(), "dependency-runtime-"));

function run(args) {
    return JSON.parse(execFileSync("node", [cliPath, ...args], {
        cwd: projectRoot,
        encoding: "utf8",
    }));
}

function childRun(worker, runId) {
    return { worker, run_id: runId, identifier: worker };
}

function workerSummary(runId, worker, packageManager, payload = {}) {
    return {
        schema_version: "1.0.0",
        summary_kind: "dependency-worker",
        run_id: runId,
        identifier: worker,
        producer_skill: worker,
        produced_at: new Date().toISOString(),
        payload: {
            status: "completed",
            worker,
            package_manager: packageManager,
            ...payload,
        },
    };
}

function coordinatorSummary(runId, identifier) {
    return {
        schema_version: "1.0.0",
        summary_kind: "dependency-coordinator",
        run_id: runId,
        identifier,
        producer_skill: "ln-820",
        produced_at: new Date().toISOString(),
        payload: {
            status: "completed",
            final_result: "success",
            worker_count: 2,
            upgraded_packages: 5,
            failed_workers: 0,
            verification_passed: true,
            report_ready: true,
        },
    };
}

try {
    const manifestPath = join(projectRoot, "manifest.json");
    writeFileSync(manifestPath, JSON.stringify({ identifier: "repo-deps" }, null, 2));

    const started = run(["start", "--project-root", projectRoot, "--identifier", "repo-deps", "--manifest-file", manifestPath]);
    const runtimeRunId = started.run_id;

    run(["checkpoint", "--project-root", projectRoot, "--identifier", "repo-deps", "--phase", PHASES.PREFLIGHT]);
    run(["advance", "--project-root", projectRoot, "--identifier", "repo-deps", "--to", PHASES.DETECT_PACKAGE_MANAGERS]);
    run(["checkpoint", "--project-root", projectRoot, "--identifier", "repo-deps", "--phase", PHASES.DETECT_PACKAGE_MANAGERS, "--payload", "{\"worker_plan\":[\"ln-821\",\"ln-823\"]}"]);
    run(["advance", "--project-root", projectRoot, "--identifier", "repo-deps", "--to", PHASES.SECURITY_AUDIT]);
    run(["checkpoint", "--project-root", projectRoot, "--identifier", "repo-deps", "--phase", PHASES.SECURITY_AUDIT]);
    run(["advance", "--project-root", projectRoot, "--identifier", "repo-deps", "--to", PHASES.DELEGATE_UPGRADES]);
    run(["checkpoint", "--project-root", projectRoot, "--identifier", "repo-deps", "--phase", PHASES.DELEGATE_UPGRADES, "--payload", JSON.stringify({
        worker_plan: ["ln-821", "ln-823"],
        child_run: childRun("ln-821", "child-ln-821"),
    })]);
    run(["checkpoint", "--project-root", projectRoot, "--identifier", "repo-deps", "--phase", PHASES.DELEGATE_UPGRADES, "--payload", JSON.stringify({
        child_run: childRun("ln-823", "child-ln-823"),
    })]);
    run(["record-worker-result", "--project-root", projectRoot, "--identifier", "repo-deps", "--payload", JSON.stringify(
        workerSummary("child-ln-821", "ln-821", "npm", { upgrades: [{ package: "vite", from: "5.0.0", to: "5.4.0" }] }),
    )]);
    run(["record-worker-result", "--project-root", projectRoot, "--identifier", "repo-deps", "--payload", JSON.stringify(
        workerSummary("child-ln-823", "ln-823", "pip", { upgrades: [{ package: "fastapi", from: "0.110.0", to: "0.115.0" }] }),
    )]);
    run(["advance", "--project-root", projectRoot, "--identifier", "repo-deps", "--to", PHASES.COLLECT_RESULTS]);
    run(["checkpoint", "--project-root", projectRoot, "--identifier", "repo-deps", "--phase", PHASES.COLLECT_RESULTS]);
    run(["advance", "--project-root", projectRoot, "--identifier", "repo-deps", "--to", PHASES.VERIFY_SUMMARY]);
    run(["checkpoint", "--project-root", projectRoot, "--identifier", "repo-deps", "--phase", PHASES.VERIFY_SUMMARY, "--payload", "{\"verification_passed\":true}"]);
    run(["advance", "--project-root", projectRoot, "--identifier", "repo-deps", "--to", PHASES.REPORT]);
    run(["checkpoint", "--project-root", projectRoot, "--identifier", "repo-deps", "--phase", PHASES.REPORT, "--payload", "{\"report_ready\":true,\"final_result\":\"success\"}"]);
    run(["record-summary", "--project-root", projectRoot, "--identifier", "repo-deps", "--payload", JSON.stringify(
        coordinatorSummary(runtimeRunId, "repo-deps"),
    )]);
    const completed = run(["complete", "--project-root", projectRoot, "--identifier", "repo-deps"]);

    if (!completed.ok || completed.state.phase !== PHASES.DONE) {
        throw new Error("Dependency runtime did not complete");
    }

    process.stdout.write("dependency-runtime smoke passed\n");
} finally {
    rmSync(projectRoot, { recursive: true, force: true });
}
