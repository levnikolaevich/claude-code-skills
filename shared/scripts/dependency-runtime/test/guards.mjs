#!/usr/bin/env node
// SOURCE-OF-TRUTH: shared/scripts/dependency-runtime/test/guards.mjs. Edit ONLY here; run `node tools/marketplace/shared.mjs sync`

import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { PHASES } from "../lib/phases.mjs";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const cliPath = join(__dirname, "..", "cli.mjs");
const projectRoot = mkdtempSync(join(tmpdir(), "dependency-guards-"));

let passed = 0;
let failed = 0;

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

function expect(name, result, expectedOk) {
    if (result.ok === expectedOk) {
        passed += 1;
        process.stdout.write(`  PASS: ${name}\n`);
        return;
    }
    failed += 1;
    process.stdout.write(`  FAIL: ${name} (expected ok=${expectedOk}, got ok=${result.ok}, error=${result.error})\n`);
}

function workerSummary(runId, skill) {
    return {
        schema_version: "1.0.0",
        summary_kind: "dependency-worker",
        run_id: runId,
        identifier: "guard-test",
        producer_skill: skill,
        produced_at: new Date().toISOString(),
        payload: {
            status: "completed",
            worker: skill,
            package_manager: skill === "ln-821" ? "npm" : "pip",
            upgrades: [],
            warnings: [],
            errors: [],
            tests_passed: true,
            build_passed: true,
        },
    };
}

function coordinatorSummary(runId) {
    return {
        schema_version: "1.0.0",
        summary_kind: "dependency-coordinator",
        run_id: runId,
        identifier: "guard-test",
        producer_skill: "ln-820",
        produced_at: new Date().toISOString(),
        payload: {
            status: "completed",
            final_result: "UPGRADES_APPLIED",
            worker_count: 2,
            upgraded_packages: 0,
            failed_workers: 0,
            verification_passed: true,
            report_ready: true,
        },
    };
}

try {
    const manifestPath = join(projectRoot, "manifest.json");
    writeFileSync(manifestPath, JSON.stringify({
        skill: "ln-820",
        identifier: "guard-test",
        project_root: projectRoot,
        created_at: new Date().toISOString(),
    }, null, 2));

    const started = run([
        "start",
        "--project-root", projectRoot,
        "--identifier", "guard-test",
        "--manifest-file", manifestPath,
    ]);

    run(["checkpoint", "--project-root", projectRoot, "--identifier", "guard-test", "--phase", PHASES.PREFLIGHT]);
    run(["advance", "--project-root", projectRoot, "--identifier", "guard-test", "--to", PHASES.DETECT_PACKAGE_MANAGERS]);
    run(["checkpoint", "--project-root", projectRoot, "--identifier", "guard-test", "--phase", PHASES.DETECT_PACKAGE_MANAGERS, "--payload", JSON.stringify({
        worker_plan: ["ln-821", "ln-823"],
    })]);
    run(["advance", "--project-root", projectRoot, "--identifier", "guard-test", "--to", PHASES.SECURITY_AUDIT]);
    run(["checkpoint", "--project-root", projectRoot, "--identifier", "guard-test", "--phase", PHASES.SECURITY_AUDIT]);
    run(["advance", "--project-root", projectRoot, "--identifier", "guard-test", "--to", PHASES.DELEGATE_UPGRADES]);
    run(["checkpoint", "--project-root", projectRoot, "--identifier", "guard-test", "--phase", PHASES.DELEGATE_UPGRADES, "--payload", JSON.stringify({
        child_run: { worker: "ln-821", run_id: "child-npm", identifier: "guard-test" },
    })]);

    // COLLECT_RESULTS must be blocked while any worker_plan entry lacks a result.
    const blockedCollect = run(
        ["advance", "--project-root", projectRoot, "--identifier", "guard-test", "--to", PHASES.COLLECT_RESULTS],
        { allowFailure: true },
    );
    expect("COLLECT_RESULTS blocked with incomplete worker plan", blockedCollect, false);

    run(["record-worker-result", "--project-root", projectRoot, "--identifier", "guard-test", "--payload",
        JSON.stringify(workerSummary(started.run_id, "ln-821"))]);
    run(["record-worker-result", "--project-root", projectRoot, "--identifier", "guard-test", "--payload",
        JSON.stringify(workerSummary(started.run_id, "ln-823"))]);

    run(["advance", "--project-root", projectRoot, "--identifier", "guard-test", "--to", PHASES.COLLECT_RESULTS]);
    run(["checkpoint", "--project-root", projectRoot, "--identifier", "guard-test", "--phase", PHASES.COLLECT_RESULTS]);
    run(["advance", "--project-root", projectRoot, "--identifier", "guard-test", "--to", PHASES.VERIFY_SUMMARY]);
    run(["checkpoint", "--project-root", projectRoot, "--identifier", "guard-test", "--phase", PHASES.VERIFY_SUMMARY]);

    // REPORT must be blocked until verification_passed=true.
    const blockedReport = run(
        ["advance", "--project-root", projectRoot, "--identifier", "guard-test", "--to", PHASES.REPORT],
        { allowFailure: true },
    );
    expect("REPORT blocked without verification_passed", blockedReport, false);

    run(["checkpoint", "--project-root", projectRoot, "--identifier", "guard-test", "--phase", PHASES.VERIFY_SUMMARY, "--payload", JSON.stringify({
        verification_passed: true,
    })]);
    run(["advance", "--project-root", projectRoot, "--identifier", "guard-test", "--to", PHASES.REPORT]);
    run(["checkpoint", "--project-root", projectRoot, "--identifier", "guard-test", "--phase", PHASES.REPORT]);

    // DONE must be blocked until report_ready, final_result, and summary_recorded are all set.
    const blockedDoneReport = run(
        ["complete", "--project-root", projectRoot, "--identifier", "guard-test"],
        { allowFailure: true },
    );
    expect("DONE blocked without report_ready", blockedDoneReport, false);

    run(["checkpoint", "--project-root", projectRoot, "--identifier", "guard-test", "--phase", PHASES.REPORT, "--payload", JSON.stringify({
        report_ready: true,
        final_result: "UPGRADES_APPLIED",
    })]);

    const blockedDoneSummary = run(
        ["complete", "--project-root", projectRoot, "--identifier", "guard-test"],
        { allowFailure: true },
    );
    expect("DONE blocked without coordinator summary", blockedDoneSummary, false);

    run(["record-summary", "--project-root", projectRoot, "--identifier", "guard-test", "--payload",
        JSON.stringify(coordinatorSummary(started.run_id))]);

    const allowed = run(["complete", "--project-root", projectRoot, "--identifier", "guard-test"]);
    expect("DONE allowed after report_ready + final_result + summary", allowed, true);

    process.stdout.write(`\ndependency-runtime guards: ${passed} passed, ${failed} failed\n`);
    if (failed > 0) {
        process.exit(1);
    }
} finally {
    rmSync(projectRoot, { recursive: true, force: true });
}
