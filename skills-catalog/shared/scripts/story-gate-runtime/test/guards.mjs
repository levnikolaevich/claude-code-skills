#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
    STORY_GATE_VERDICTS,
    TASK_BOARD_STATUSES,
} from "../../coordinator-runtime/lib/runtime-constants.mjs";
import { PHASES } from "../lib/phases.mjs";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const cliPath = join(__dirname, "..", "cli.mjs");
const projectRoot = mkdtempSync(join(tmpdir(), "story-gate-guards-"));
const manifestPath = join(projectRoot, "manifest.json");

writeFileSync(manifestPath, JSON.stringify({
    task_provider: "file",
    worktree_dir: ".hex-skills/worktrees/story-G",
    branch: "feature/guard-test",
}, null, 2));

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

const P = "--project-root";

try {
    run(["start", P, projectRoot, "--story", "G-1", "--manifest-file", manifestPath]);
    run(["checkpoint", P, projectRoot, "--phase", PHASES.CONFIG]);
    run(["advance", P, projectRoot, "--to", PHASES.DISCOVERY]);
    run(["checkpoint", P, projectRoot, "--phase", PHASES.DISCOVERY]);
    run(["advance", P, projectRoot, "--to", PHASES.FAST_TRACK]);
    run(["checkpoint", P, projectRoot, "--phase", PHASES.FAST_TRACK, "--payload", "{\"fast_track\":false}"]);
    run(["advance", P, projectRoot, "--to", PHASES.QUALITY_CHECKS]);
    run(["checkpoint", P, projectRoot, "--phase", PHASES.QUALITY_CHECKS]);

    // TEST 1: TEST_PLANNING blocked with child_run metadata only
    run(["checkpoint", P, projectRoot, "--phase", PHASES.QUALITY_CHECKS, "--payload", JSON.stringify({
        child_run: {
            worker: "ln-510",
            run_id: "gate-run--ln-510--G-1",
            summary_artifact_path: ".hex-skills/runtime-artifacts/runs/gate-run/story-quality/G-1.json",
            phase_context: "quality_checks",
        },
    })]);
    const t1 = run([ "advance", P, projectRoot, "--to", PHASES.TEST_PLANNING], { allowFailure: true });
    expect("TEST_PLANNING blocked without recorded ln-510 summary", t1, false);

    // TEST 2: VERDICT blocked without quality_summary
    const t2 = run(["advance", P, projectRoot, "--to", PHASES.VERDICT], { allowFailure: true });
    expect("VERDICT blocked without quality_summary", t2, false);

    // Fix: checkpoint with quality_summary
    run(["checkpoint", P, projectRoot, "--phase", PHASES.QUALITY_CHECKS, "--payload", JSON.stringify({ quality_summary: { verdict: STORY_GATE_VERDICTS.PASS } })]);

    // TEST 3: TEST_PLANNING allowed with quality_summary
    const t3 = run(["advance", P, projectRoot, "--to", PHASES.TEST_PLANNING]);
    expect("TEST_PLANNING allowed with quality_summary", t3, true);

    // TEST 4: TEST_VERIFICATION blocked with child_run metadata only
    run(["checkpoint", P, projectRoot, "--phase", PHASES.TEST_PLANNING, "--payload", JSON.stringify({
        child_run: {
            worker: "ln-520",
            run_id: "gate-run--ln-520--G-1",
            summary_artifact_path: ".hex-skills/runtime-artifacts/runs/gate-run/story-tests/G-1.json",
            phase_context: "test_planning",
        },
    })]);
    const t4 = run(["advance", P, projectRoot, "--to", PHASES.TEST_VERIFICATION], { allowFailure: true });
    expect("TEST_VERIFICATION blocked without recorded ln-520 summary", t4, false);

    // Fast-forward to TEST_VERIFICATION
    run(["record-test-status", P, projectRoot, "--payload", JSON.stringify({ story_id: "G-1", planner_invoked: true, status: TASK_BOARD_STATUSES.SKIPPED })]);
    run(["checkpoint", P, projectRoot, "--phase", PHASES.TEST_PLANNING, "--payload", JSON.stringify({ test_planner_invoked: true, test_task_status: TASK_BOARD_STATUSES.SKIPPED })]);
    run(["advance", P, projectRoot, "--to", PHASES.TEST_VERIFICATION]);
    run(["checkpoint", P, projectRoot, "--phase", PHASES.TEST_VERIFICATION, "--payload", JSON.stringify({ test_task_status: TASK_BOARD_STATUSES.SKIPPED })]);
    run(["advance", P, projectRoot, "--to", PHASES.VERDICT]);
    run(["checkpoint", P, projectRoot, "--phase", PHASES.VERDICT]);

    // TEST 5: FINALIZATION blocked without final_verdict
    const t5 = run(["advance", P, projectRoot, "--to", PHASES.FINALIZATION], { allowFailure: true });
    expect("FINALIZATION blocked without final_verdict", t5, false);

    // Fix: checkpoint with final_result (a valid verdict)
    run(["checkpoint", P, projectRoot, "--phase", PHASES.VERDICT, "--payload", JSON.stringify({ final_result: STORY_GATE_VERDICTS.PASS, quality_score: 92 })]);

    // TEST 6: FINALIZATION allowed with verdict
    const t6 = run(["advance", P, projectRoot, "--to", PHASES.FINALIZATION]);
    expect("FINALIZATION allowed with verdict", t6, true);

    // TEST 7: DONE blocked without story_final_status
    run(["checkpoint", P, projectRoot, "--phase", PHASES.FINALIZATION]);
    run(["advance", P, projectRoot, "--to", PHASES.SELF_CHECK]);
    run(["checkpoint", P, projectRoot, "--phase", PHASES.SELF_CHECK, "--payload", JSON.stringify({ pass: true, final_result: STORY_GATE_VERDICTS.PASS })]);
    const t7 = run(["complete", P, projectRoot], { allowFailure: true });
    expect("DONE blocked without story_final_status", t7, false);

    process.stdout.write(`\nstory-gate-runtime guards: ${passed} passed, ${failed} failed\n`);
    if (failed > 0) process.exit(1);
} finally {
    rmSync(projectRoot, { recursive: true, force: true });
}
