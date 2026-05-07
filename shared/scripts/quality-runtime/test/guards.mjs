#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { PHASES } from "../lib/phases.mjs";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const cliPath = join(__dirname, "..", "cli.mjs");
const projectRoot = mkdtempSync(join(tmpdir(), "quality-guards-"));
const manifestPath = join(projectRoot, "manifest.json");

writeFileSync(manifestPath, JSON.stringify({ fast_track: false }, null, 2));

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
    const ok = result.ok === expectedOk;
    if (ok) {
        passed++;
        process.stdout.write(`  PASS: ${name}\n`);
    } else {
        failed++;
        process.stdout.write(`  FAIL: ${name} (expected ok=${expectedOk}, got ok=${result.ok}, error=${result.error})\n`);
    }
}

function summary(worker, verdict) {
    return JSON.stringify({
        schema_version: "1.0.0",
        summary_kind: "quality-worker",
        run_id: "quality-guards-test",
        identifier: "PROJ-G",
        producer_skill: worker,
        produced_at: "2026-03-30T00:00:00Z",
        payload: { worker, status: "completed", verdict, issues: [], warnings: [] },
    });
}

try {
    run(["start", "--story", "PROJ-G", "--manifest-file", manifestPath]);
    run(["checkpoint", "--story", "PROJ-G", "--phase", PHASES.CONFIG]);
    run(["advance", "--story", "PROJ-G", "--to", PHASES.DISCOVERY]);
    run(["checkpoint", "--story", "PROJ-G", "--phase", PHASES.DISCOVERY]);
    run(["advance", "--story", "PROJ-G", "--to", PHASES.CODE_QUALITY]);
    run(["checkpoint", "--story", "PROJ-G", "--phase", PHASES.CODE_QUALITY]);

    // TEST 1: CLEANUP blocked without ln-511
    const t1 = run(["advance", "--story", "PROJ-G", "--to", PHASES.CLEANUP], { allowFailure: true });
    expect("CLEANUP blocked without ln-511", t1, false);

    // Fix: record ln-511
    run(["record-worker", "--story", "PROJ-G", "--payload", summary("ln-511", "PASS")]);

    // TEST 2: CLEANUP allowed with ln-511
    const t2 = run(["advance", "--story", "PROJ-G", "--to", PHASES.CLEANUP]);
    expect("CLEANUP allowed with ln-511", t2, true);

    run(["checkpoint", "--story", "PROJ-G", "--phase", PHASES.CLEANUP]);

    // TEST 3: AGENT_REVIEW blocked without ln-512
    const t3 = run(["advance", "--story", "PROJ-G", "--to", PHASES.AGENT_REVIEW], { allowFailure: true });
    expect("AGENT_REVIEW blocked without ln-512", t3, false);

    // Fix: record ln-512
    run(["record-worker", "--story", "PROJ-G", "--payload", summary("ln-512", "PASS")]);

    // TEST 4: AGENT_REVIEW allowed with ln-512
    const t4 = run(["advance", "--story", "PROJ-G", "--to", PHASES.AGENT_REVIEW]);
    expect("AGENT_REVIEW allowed with ln-512", t4, true);

    // Fast-forward to REGRESSION
    run(["checkpoint", "--story", "PROJ-G", "--phase", PHASES.AGENT_REVIEW]);
    run(["advance", "--story", "PROJ-G", "--to", PHASES.CRITERIA]);
    run(["checkpoint", "--story", "PROJ-G", "--phase", PHASES.CRITERIA]);
    run(["advance", "--story", "PROJ-G", "--to", PHASES.LINTERS]);
    run(["checkpoint", "--story", "PROJ-G", "--phase", PHASES.LINTERS]);
    run(["advance", "--story", "PROJ-G", "--to", PHASES.REGRESSION]);
    run(["checkpoint", "--story", "PROJ-G", "--phase", PHASES.REGRESSION]);

    // TEST 5: LOG_ANALYSIS blocked without ln-513
    const t5 = run(["advance", "--story", "PROJ-G", "--to", PHASES.LOG_ANALYSIS], { allowFailure: true });
    expect("LOG_ANALYSIS blocked without ln-513", t5, false);

    // Fix and fast-forward
    run(["record-worker", "--story", "PROJ-G", "--payload", summary("ln-513", "PASS")]);
    run(["advance", "--story", "PROJ-G", "--to", PHASES.LOG_ANALYSIS]);
    run(["checkpoint", "--story", "PROJ-G", "--phase", PHASES.LOG_ANALYSIS]);

    // TEST 6: FINALIZE blocked without ln-514
    const t6 = run(["advance", "--story", "PROJ-G", "--to", PHASES.FINALIZE], { allowFailure: true });
    expect("FINALIZE blocked without ln-514", t6, false);

    // Fix
    run(["record-worker", "--story", "PROJ-G", "--payload", summary("ln-514", "PASS")]);

    // TEST 7: FINALIZE allowed with ln-514
    const t7 = run(["advance", "--story", "PROJ-G", "--to", PHASES.FINALIZE]);
    expect("FINALIZE allowed with ln-514", t7, true);

    // TEST 8: DONE blocked without final_result
    run(["checkpoint", "--story", "PROJ-G", "--phase", PHASES.FINALIZE, "--payload", "{\"quality_score\":90}"]);
    run(["advance", "--story", "PROJ-G", "--to", PHASES.SELF_CHECK]);
    run(["checkpoint", "--story", "PROJ-G", "--phase", PHASES.SELF_CHECK, "--payload", "{\"pass\":true}"]);
    const t8 = run(["complete", "--story", "PROJ-G"], { allowFailure: true });
    expect("DONE blocked without final_result", t8, false);

    process.stdout.write(`\nquality-runtime guards: ${passed} passed, ${failed} failed\n`);
    if (failed > 0) process.exit(1);
} finally {
    rmSync(projectRoot, { recursive: true, force: true });
}
