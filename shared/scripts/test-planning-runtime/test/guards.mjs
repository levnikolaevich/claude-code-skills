#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { PHASES } from "../lib/phases.mjs";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const cliPath = join(__dirname, "..", "cli.mjs");
const projectRoot = mkdtempSync(join(tmpdir(), "test-planning-guards-"));
const manifestPath = join(projectRoot, "manifest.json");

writeFileSync(manifestPath, JSON.stringify({ simplified: false }, null, 2));

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

function summary(worker) {
    return JSON.stringify({
        schema_version: "1.0.0", summary_kind: "test-planning-worker",
        run_id: "guards-test", identifier: "PROJ-G",
        producer_skill: worker, produced_at: "2026-03-30T00:00:00Z",
        payload: { worker, status: "completed", warnings: [], planned_scenarios: [] },
    });
}

try {
    run(["start", "--story", "PROJ-G", "--manifest-file", manifestPath]);
    run(["checkpoint", "--story", "PROJ-G", "--phase", PHASES.CONFIG]);
    run(["advance", "--story", "PROJ-G", "--to", PHASES.DISCOVERY]);
    run(["checkpoint", "--story", "PROJ-G", "--phase", PHASES.DISCOVERY]);
    run(["advance", "--story", "PROJ-G", "--to", PHASES.RESEARCH]);
    run(["checkpoint", "--story", "PROJ-G", "--phase", PHASES.RESEARCH]);

    // TEST 1: MANUAL_TESTING blocked without ln-521 (simplified=false)
    const t1 = run(["advance", "--story", "PROJ-G", "--to", PHASES.MANUAL_TESTING], { allowFailure: true });
    expect("MANUAL_TESTING blocked without ln-521", t1, false);

    // Fix
    run(["record-worker", "--story", "PROJ-G", "--payload", summary("ln-521")]);

    // TEST 2: MANUAL_TESTING allowed with ln-521
    const t2 = run(["advance", "--story", "PROJ-G", "--to", PHASES.MANUAL_TESTING]);
    expect("MANUAL_TESTING allowed with ln-521", t2, true);

    // TEST 3: AUTO_TEST_PLANNING blocked without ln-522
    run(["checkpoint", "--story", "PROJ-G", "--phase", PHASES.MANUAL_TESTING]);
    const t3 = run(["advance", "--story", "PROJ-G", "--to", PHASES.AUTO_TEST_PLANNING], { allowFailure: true });
    expect("AUTO_TEST_PLANNING blocked without ln-522", t3, false);

    // Fix
    run(["record-worker", "--story", "PROJ-G", "--payload", summary("ln-522")]);

    // TEST 4: AUTO_TEST_PLANNING allowed with ln-522
    const t4 = run(["advance", "--story", "PROJ-G", "--to", PHASES.AUTO_TEST_PLANNING]);
    expect("AUTO_TEST_PLANNING allowed with ln-522", t4, true);

    // TEST 5: FINALIZE blocked without ln-523
    run(["checkpoint", "--story", "PROJ-G", "--phase", PHASES.AUTO_TEST_PLANNING]);
    const t5 = run(["advance", "--story", "PROJ-G", "--to", PHASES.FINALIZE], { allowFailure: true });
    expect("FINALIZE blocked without ln-523", t5, false);

    // Fix
    run(["record-worker", "--story", "PROJ-G", "--payload", summary("ln-523")]);

    // TEST 6: FINALIZE allowed with ln-523
    const t6 = run(["advance", "--story", "PROJ-G", "--to", PHASES.FINALIZE]);
    expect("FINALIZE allowed with ln-523", t6, true);

    process.stdout.write(`\ntest-planning-runtime guards: ${passed} passed, ${failed} failed\n`);
    if (failed > 0) process.exit(1);
} finally {
    rmSync(projectRoot, { recursive: true, force: true });
}
