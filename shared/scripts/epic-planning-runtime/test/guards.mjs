#!/usr/bin/env node
// SOURCE-OF-TRUTH: shared/scripts/epic-planning-runtime/test/guards.mjs. Edit ONLY here; run `node tools/marketplace/shared.mjs sync`

import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { PHASES } from "../lib/phases.mjs";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const cliPath = join(__dirname, "..", "cli.mjs");
const projectRoot = mkdtempSync(join(tmpdir(), "epic-guards-"));
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

try {
    const started = run(["start", "--identifier", "scope", "--manifest-file", manifestPath]);
    const parentRunId = started.run_id;

    // Fast-forward to PREVIEW (all checkpoints valid)
    run(["checkpoint", "--identifier", "scope", "--phase", PHASES.CONFIG]);
    run(["advance", "--identifier", "scope", "--to", PHASES.DISCOVERY]);
    run(["checkpoint", "--identifier", "scope", "--phase", PHASES.DISCOVERY, "--payload", "{\"discovery_summary\":{\"ok\":true}}"]);
    run(["advance", "--identifier", "scope", "--to", PHASES.RESEARCH]);
    run(["checkpoint", "--identifier", "scope", "--phase", PHASES.RESEARCH, "--payload", "{\"research_summary\":{\"ok\":true}}"]);
    run(["advance", "--identifier", "scope", "--to", PHASES.PLAN]);
    run(["checkpoint", "--identifier", "scope", "--phase", PHASES.PLAN, "--payload", "{\"ideal_plan_summary\":{\"epics\":3}}"]);
    run(["advance", "--identifier", "scope", "--to", PHASES.MODE_DETECTION]);
    run(["checkpoint", "--identifier", "scope", "--phase", PHASES.MODE_DETECTION, "--payload", "{\"mode_detection\":{\"mode\":\"CREATE\"}}"]);
    run(["advance", "--identifier", "scope", "--to", PHASES.PREVIEW]);
    run(["checkpoint", "--identifier", "scope", "--phase", PHASES.PREVIEW]);

    // TEST 1: DELEGATE blocked without confirm_epic_preview (auto_approve=false)
    const t1 = run(["advance", "--identifier", "scope", "--to", PHASES.DELEGATE], { allowFailure: true });
    expect("DELEGATE blocked without confirm_epic_preview", t1, false);

    // Fix: pause + decision
    run([
        "pause", "--identifier", "scope", "--reason", "Preview",
        "--payload", JSON.stringify({
            kind: "confirm_epic_preview", question: "Confirm?",
            choices: ["confirm_epic_preview", "cancel"],
            default_choice: "confirm_epic_preview",
            context: {}, resume_to_phase: PHASES.DELEGATE, blocking: true,
        }),
    ]);
    run(["set-decision", "--identifier", "scope", "--payload", JSON.stringify({ selected_choice: "confirm_epic_preview" })]);

    // TEST 2: DELEGATE allowed after decision (resume puts us at DELEGATE)
    // After set-decision, phase is already DELEGATE. Verify state.
    const status = run(["status", "--identifier", "scope"]);
    const delegateOk = status.state.phase === PHASES.DELEGATE;
    if (delegateOk) { passed++; process.stdout.write("  PASS: DELEGATE reached after confirm_epic_preview\n"); }
    else { failed++; process.stdout.write(`  FAIL: DELEGATE after decision (phase=${status.state.phase})\n`); }

    // Fast-forward to DONE
    run(["checkpoint", "--identifier", "scope", "--phase", PHASES.DELEGATE]);
    run(["advance", "--identifier", "scope", "--to", PHASES.FINALIZE]);
    run(["checkpoint", "--identifier", "scope", "--phase", PHASES.FINALIZE]);
    const missingCoordinatorSummary = run(["advance", "--identifier", "scope", "--to", PHASES.SELF_CHECK], { allowFailure: true });
    expect("SELF_CHECK blocked without epic-plan summary", missingCoordinatorSummary, false);
    run(["record-plan-summary", "--identifier", "scope", "--payload", JSON.stringify({
        schema_version: "1.0.0",
        summary_kind: "epic-plan",
        run_id: parentRunId,
        identifier: "scope",
        producer_skill: "ln-210",
        produced_at: "2026-04-09T00:00:00Z",
        payload: {
            mode: "CREATE",
            scope_identifier: "scope",
            epics_created: 3,
            epics_updated: 0,
            epics_canceled: 0,
            epic_urls: ["EPIC-1", "EPIC-2", "EPIC-3"],
            warnings: [],
            kanban_updated: true,
            infrastructure_epic_included: false,
            artifact_path: null,
        },
    })]);
    run(["advance", "--identifier", "scope", "--to", PHASES.SELF_CHECK]);

    // TEST 4: DONE blocked without final_result
    run(["checkpoint", "--identifier", "scope", "--phase", PHASES.SELF_CHECK, "--payload", "{\"pass\":true}"]);
    const t3 = run(["complete", "--identifier", "scope"], { allowFailure: true });
    expect("DONE blocked without final_result", t3, false);

    // TEST 5: DONE allowed with final_result
    run(["checkpoint", "--identifier", "scope", "--phase", PHASES.SELF_CHECK, "--payload", "{\"pass\":true,\"final_result\":\"READY\"}"]);
    const t4 = run(["complete", "--identifier", "scope"]);
    expect("DONE allowed with final_result", t4, true);

    process.stdout.write(`\nepic-planning-runtime guards: ${passed} passed, ${failed} failed\n`);
    if (failed > 0) process.exit(1);
} finally {
    rmSync(projectRoot, { recursive: true, force: true });
}
