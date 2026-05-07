#!/usr/bin/env node
// SOURCE-OF-TRUTH: shared/scripts/environment-setup-runtime/test/guards.mjs. Edit ONLY here; run `node tools/marketplace/shared.mjs sync`

import { rmSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
    createJsonCliRunner,
    createProjectRoot,
    writeJson,
} from "../../coordinator-runtime/test/cli-test-helpers.mjs";
import { WORKER_SUMMARY_STATUSES } from "../../coordinator-runtime/lib/runtime-constants.mjs";
import { PHASES } from "../lib/phases.mjs";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const cliPath = join(__dirname, "..", "cli.mjs");
const projectRoot = createProjectRoot("env-setup-guards-");
const run = createJsonCliRunner(cliPath, projectRoot);

let passed = 0;
let failed = 0;
const P = "--project-root";
const I = "--identifier";
const ID = "env-g";

function expect(name, result, expectedOk) {
    if (result.ok === expectedOk) { passed++; process.stdout.write(`  PASS: ${name}\n`); }
    else { failed++; process.stdout.write(`  FAIL: ${name} (expected ok=${expectedOk}, got ok=${result.ok}, error=${result.error})\n`); }
}

function workerSummary(skill, runId) {
    return JSON.stringify({
        schema_version: "1.0", summary_kind: "env-agent-install",
        run_id: runId, identifier: ID, producer_skill: skill,
        produced_at: "2026-03-30T00:00:00Z",
        payload: { status: WORKER_SUMMARY_STATUSES.COMPLETED, targets: ["codex"] },
    });
}

try {
    const manifestPath = join(projectRoot, "manifest.json");
    writeJson(manifestPath, { targets: ["both"], dry_run: false });

    const started = run(["start", P, projectRoot, I, ID, "--manifest-file", manifestPath]);
    if (started.manifest.plugins.join(",") !== "agile-workflow") {
        throw new Error("Default plugin selection must be agile-workflow");
    }
    if (started.manifest.worker_registry.includes("ln-015")) {
        throw new Error("ln-015 must remain standalone and outside default environment setup dispatch");
    }
    run(["checkpoint", P, projectRoot, I, ID, "--phase", PHASES.CONFIG]);
    run(["advance", P, projectRoot, I, ID, "--to", PHASES.ASSESS]);

    // Fast-forward to PROVIDER_SELECTION (assess_summary required)
    run(["checkpoint", P, projectRoot, I, ID, "--phase", PHASES.ASSESS, "--payload", "{\"assess_summary\":{\"node\":true}}"]);
    run(["advance", P, projectRoot, I, ID, "--to", PHASES.PROVIDER_SELECTION]);

    // TEST 1: DISPATCH_PLAN blocked without provider_selection.chosen
    run(["checkpoint", P, projectRoot, I, ID, "--phase", PHASES.PROVIDER_SELECTION]);
    const t1 = run(["advance", P, projectRoot, I, ID, "--to", PHASES.DISPATCH_PLAN], { allowFailure: true });
    expect("DISPATCH_PLAN blocked without provider_selection", t1, false);

    // Fix: record provider_selection
    run(["checkpoint", P, projectRoot, I, ID, "--phase", PHASES.PROVIDER_SELECTION, "--payload", "{\"provider_selection\":{\"chosen\":\"file\",\"available\":[\"file\"],\"reason\":\"only file mode available\",\"selected_by\":\"single_option\"}}"]);

    // TEST 2: DISPATCH_PLAN allowed with provider_selection
    const t2 = run(["advance", P, projectRoot, I, ID, "--to", PHASES.DISPATCH_PLAN]);
    expect("DISPATCH_PLAN allowed with provider_selection", t2, true);

    // TEST 3: WORKER_EXECUTION blocked without dispatch_plan
    run(["checkpoint", P, projectRoot, I, ID, "--phase", PHASES.DISPATCH_PLAN]);
    const t3 = run(["advance", P, projectRoot, I, ID, "--to", PHASES.WORKER_EXECUTION], { allowFailure: true });
    expect("WORKER_EXECUTION blocked without dispatch_plan", t3, false);

    // Fix
    run(["checkpoint", P, projectRoot, I, ID, "--phase", PHASES.DISPATCH_PLAN, "--payload", "{\"dispatch_plan\":{\"workers_to_run\":[\"ln-011\",\"ln-013\"]}}"]);

    // TEST 4: WORKER_EXECUTION allowed
    const t4 = run(["advance", P, projectRoot, I, ID, "--to", PHASES.WORKER_EXECUTION]);
    expect("WORKER_EXECUTION allowed with dispatch_plan", t4, true);

    // TEST 5: VERIFY blocked with incomplete workers (1/2)
    run(["record-worker", P, projectRoot, I, ID, "--payload", workerSummary("ln-011", started.run_id)]);
    run(["checkpoint", P, projectRoot, I, ID, "--phase", PHASES.WORKER_EXECUTION]);
    const t5 = run(["advance", P, projectRoot, I, ID, "--to", PHASES.VERIFY], { allowFailure: true });
    expect("VERIFY blocked with 1/2 workers", t5, false);

    // Fix: record second worker
    run(["record-worker", P, projectRoot, I, ID, "--payload", workerSummary("ln-013", started.run_id)]);

    // TEST 6: VERIFY allowed with all workers
    const t6 = run(["advance", P, projectRoot, I, ID, "--to", PHASES.VERIFY]);
    expect("VERIFY allowed with 2/2 workers", t6, true);

    // Fast-forward to WRITE_ENV_STATE (verification_summary required)
    run(["checkpoint", P, projectRoot, I, ID, "--phase", PHASES.VERIFY, "--payload", "{\"verification_summary\":{\"all_passed\":true}}"]);
    run(["advance", P, projectRoot, I, ID, "--to", PHASES.WRITE_ENV_STATE]);

    process.stdout.write(`\nenvironment-setup-runtime guards: ${passed} passed, ${failed} failed\n`);
    if (failed > 0) process.exit(1);
} finally {
    rmSync(projectRoot, { recursive: true, force: true });
}
