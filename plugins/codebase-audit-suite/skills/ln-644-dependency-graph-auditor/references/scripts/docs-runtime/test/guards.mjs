#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { PHASES } from "../lib/phases.mjs";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const cliPath = join(__dirname, "..", "cli.mjs");
const projectRoot = mkdtempSync(join(tmpdir(), "docs-guards-"));
const manifestPath = join(projectRoot, "manifest.json");

writeFileSync(manifestPath, JSON.stringify({ expected_workers: ["ln-111", "ln-112"] }, null, 2));

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

function summary(worker) {
    return JSON.stringify({
        schema_version: "1.0.0", summary_kind: "docs-generation",
        run_id: "docs-guards-test", identifier: "project-docs",
        producer_skill: worker, produced_at: "2026-03-30T00:00:00Z",
        payload: { worker, status: "completed", created_files: ["docs/f.md"], skipped_files: [], quality_inputs: { doc_paths: ["docs/f.md"] }, validation_status: "passed", warnings: [] },
    });
}

try {
    run(["start", "--identifier", "project-docs", "--manifest-file", manifestPath]);
    run(["checkpoint", "--identifier", "project-docs", "--phase", PHASES.CONFIG]);
    run(["advance", "--identifier", "project-docs", "--to", PHASES.CONTEXT_ASSEMBLY]);
    run(["checkpoint", "--identifier", "project-docs", "--phase", PHASES.CONTEXT_ASSEMBLY, "--payload", "{\"context_ready\":true}"]);
    run(["advance", "--identifier", "project-docs", "--to", PHASES.DETECTION]);

    // TEST 1: DELEGATE blocked without detected_flags
    run(["checkpoint", "--identifier", "project-docs", "--phase", PHASES.DETECTION]);
    const t1 = run(["advance", "--identifier", "project-docs", "--to", PHASES.DELEGATE], { allowFailure: true });
    expect("DELEGATE blocked without detected_flags", t1, false);

    // Fix
    run(["checkpoint", "--identifier", "project-docs", "--phase", PHASES.DETECTION, "--payload", "{\"detected_flags\":{\"hasBackend\":true}}"]);

    // TEST 2: DELEGATE allowed with detected_flags
    const t2 = run(["advance", "--identifier", "project-docs", "--to", PHASES.DELEGATE]);
    expect("DELEGATE allowed with detected_flags", t2, true);

    // TEST 3: AGGREGATE blocked with incomplete workers
    run(["record-worker", "--identifier", "project-docs", "--payload", summary("ln-111")]);
    run(["checkpoint", "--identifier", "project-docs", "--phase", PHASES.DELEGATE]);
    const t3 = run(["advance", "--identifier", "project-docs", "--to", PHASES.AGGREGATE], { allowFailure: true });
    expect("AGGREGATE blocked with 1/2 workers", t3, false);

    // Fix: record second worker
    run(["record-worker", "--identifier", "project-docs", "--payload", summary("ln-112")]);

    // TEST 4: AGGREGATE allowed with all workers
    const t4 = run(["advance", "--identifier", "project-docs", "--to", PHASES.AGGREGATE]);
    expect("AGGREGATE allowed with 2/2 workers", t4, true);

    // TEST 5: DONE blocked without final_result
    run(["checkpoint", "--identifier", "project-docs", "--phase", PHASES.AGGREGATE]);
    run(["advance", "--identifier", "project-docs", "--to", PHASES.SELF_CHECK]);
    run(["checkpoint", "--identifier", "project-docs", "--phase", PHASES.SELF_CHECK, "--payload", "{\"pass\":true}"]);
    const t5 = run(["complete", "--identifier", "project-docs"], { allowFailure: true });
    expect("DONE blocked without final_result", t5, false);

    process.stdout.write(`\ndocs-runtime guards: ${passed} passed, ${failed} failed\n`);
    if (failed > 0) process.exit(1);
} finally {
    rmSync(projectRoot, { recursive: true, force: true });
}
