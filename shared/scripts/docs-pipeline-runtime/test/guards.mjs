#!/usr/bin/env node
// SOURCE-OF-TRUTH: shared/scripts/docs-pipeline-runtime/test/guards.mjs. Edit ONLY here; run `node tools/marketplace/shared.mjs sync`

import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { PHASES } from "../lib/phases.mjs";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const cliPath = join(__dirname, "..", "cli.mjs");
const projectRoot = mkdtempSync(join(tmpdir(), "docs-pipeline-guards-"));
const manifestPath = join(projectRoot, "manifest.json");

writeFileSync(manifestPath, JSON.stringify({ auto_approve: false }, null, 2));

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

function component(worker) {
    return JSON.stringify({
        schema_version: "1.0.0", summary_kind: "docs-generation",
        run_id: "guards-test", identifier: "docs-pipeline",
        producer_skill: worker, produced_at: "2026-03-30T00:00:00Z",
        payload: { worker, status: "completed", created_files: ["docs/README.md"], skipped_files: [], quality_inputs: { doc_paths: ["docs/README.md"] }, validation_status: "passed", warnings: [] },
    });
}

try {
    run(["start", "--identifier", "docs-pipeline", "--manifest-file", manifestPath]);
    run(["checkpoint", "--identifier", "docs-pipeline", "--phase", PHASES.CONFIG]);
    run(["advance", "--identifier", "docs-pipeline", "--to", PHASES.SOURCE_SCAN]);
    run(["checkpoint", "--identifier", "docs-pipeline", "--phase", PHASES.SOURCE_SCAN]);
    run(["advance", "--identifier", "docs-pipeline", "--to", PHASES.CONFIRMATION]);
    run(["checkpoint", "--identifier", "docs-pipeline", "--phase", PHASES.CONFIRMATION]);

    // TEST 1: DELEGATE blocked without confirm_docs_pipeline decision (auto_approve=false)
    const t1 = run(["advance", "--identifier", "docs-pipeline", "--to", PHASES.DELEGATE], { allowFailure: true });
    expect("DELEGATE blocked without confirmation decision", t1, false);

    // Fix: pause + decision → resumes to DELEGATE automatically
    run([
        "pause", "--identifier", "docs-pipeline", "--reason", "Confirm",
        "--payload", JSON.stringify({
            kind: "confirm_docs_pipeline", question: "Continue?",
            choices: ["confirm_docs_pipeline", "cancel"],
            default_choice: "confirm_docs_pipeline",
            context: {}, resume_to_phase: PHASES.DELEGATE, blocking: true,
        }),
    ]);
    run(["set-decision", "--identifier", "docs-pipeline", "--payload", JSON.stringify({ selected_choice: "confirm_docs_pipeline" })]);

    // TEST 2: After decision, phase is DELEGATE (resume_to_phase)
    const status = run(["status", "--identifier", "docs-pipeline"]);
    const delegateOk = status.state.phase === PHASES.DELEGATE;
    if (delegateOk) { passed++; process.stdout.write("  PASS: DELEGATE reached after confirmation\n"); }
    else { failed++; process.stdout.write(`  FAIL: DELEGATE after decision (phase=${status.state.phase})\n`); }

    // TEST 3: QUALITY_GATE blocked without component_results
    run(["checkpoint", "--identifier", "docs-pipeline", "--phase", PHASES.DELEGATE]);
    const t3 = run(["advance", "--identifier", "docs-pipeline", "--to", PHASES.QUALITY_GATE], { allowFailure: true });
    expect("QUALITY_GATE blocked without component_results", t3, false);

    // Fix: record component
    run(["record-component", "--identifier", "docs-pipeline", "--payload", component("ln-110")]);

    // TEST 4: QUALITY_GATE allowed with component
    const t4 = run(["advance", "--identifier", "docs-pipeline", "--to", PHASES.QUALITY_GATE]);
    expect("QUALITY_GATE allowed with component", t4, true);

    // TEST 5: SELF_CHECK blocked without quality_gate_passed
    run(["checkpoint", "--identifier", "docs-pipeline", "--phase", PHASES.QUALITY_GATE, "--payload", JSON.stringify({ quality_summary: { status: "failed" } })]);
    run(["advance", "--identifier", "docs-pipeline", "--to", PHASES.CLEANUP]);
    run(["checkpoint", "--identifier", "docs-pipeline", "--phase", PHASES.CLEANUP, "--payload", "{\"final_result\":\"READY\"}"]);
    const t5 = run(["advance", "--identifier", "docs-pipeline", "--to", PHASES.SELF_CHECK], { allowFailure: true });
    expect("SELF_CHECK blocked without quality_gate_passed", t5, false);

    process.stdout.write(`\ndocs-pipeline-runtime guards: ${passed} passed, ${failed} failed\n`);
    if (failed > 0) process.exit(1);
} finally {
    rmSync(projectRoot, { recursive: true, force: true });
}
