#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { TASK_BOARD_STATUSES } from "../../coordinator-runtime/lib/runtime-constants.mjs";
import { PHASES } from "../lib/phases.mjs";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const cliPath = join(__dirname, "..", "cli.mjs");
const projectRoot = mkdtempSync(join(tmpdir(), "story-exec-guards-"));
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
    run(["advance", P, projectRoot, "--to", PHASES.WORKTREE_SETUP]);

    // TEST 1: SELECT_WORK blocked without worktree_ready
    run(["checkpoint", P, projectRoot, "--phase", PHASES.WORKTREE_SETUP]);
    const t1 = run(["advance", P, projectRoot, "--to", PHASES.SELECT_WORK], { allowFailure: true });
    expect("SELECT_WORK blocked without worktree_ready", t1, false);

    // Fix
    run(["checkpoint", P, projectRoot, "--phase", PHASES.WORKTREE_SETUP, "--payload", JSON.stringify({ worktree_ready: true })]);

    // TEST 2: SELECT_WORK allowed with worktree_ready
    const t2 = run(["advance", P, projectRoot, "--to", PHASES.SELECT_WORK]);
    expect("SELECT_WORK allowed with worktree_ready", t2, true);

    // TEST 3: TASK_EXECUTION blocked without current_task_id
    run(["checkpoint", P, projectRoot, "--phase", PHASES.SELECT_WORK, "--payload", JSON.stringify({ processable_counts: { todo: 1, to_review: 0, to_rework: 0 } })]);
    const t3 = run(["advance", P, projectRoot, "--to", PHASES.TASK_EXECUTION], { allowFailure: true });
    expect("TASK_EXECUTION blocked without current_task_id", t3, false);

    // Fix: set current_task_id
    run(["checkpoint", P, projectRoot, "--phase", PHASES.SELECT_WORK, "--payload", JSON.stringify({ current_task_id: "T-1", processable_counts: { todo: 1, to_review: 0, to_rework: 0 } })]);

    // TEST 4: TASK_EXECUTION allowed with current_task_id
    const t4 = run(["advance", P, projectRoot, "--to", PHASES.TASK_EXECUTION]);
    expect("TASK_EXECUTION allowed with current_task_id", t4, true);

    // Fast-forward to VERIFY_STATUSES
    run(["record-task", P, projectRoot, "--task-id", "T-1", "--payload", JSON.stringify({ worker: "ln-401", result: "done", from_status: TASK_BOARD_STATUSES.TODO, to_status: TASK_BOARD_STATUSES.DONE })]);
    run(["checkpoint", P, projectRoot, "--phase", PHASES.TASK_EXECUTION]);
    run(["advance", P, projectRoot, "--to", PHASES.VERIFY_STATUSES]);

    // TEST 5: STORY_TO_REVIEW blocked from VERIFY_STATUSES (must go through SCENARIO_VALIDATION)
    run(["checkpoint", P, projectRoot, "--phase", PHASES.VERIFY_STATUSES, "--payload", JSON.stringify({ processable_counts: { todo: 0, to_review: 0, to_rework: 0 }, inflight_workers: {} })]);
    const t5 = run(["advance", P, projectRoot, "--to", PHASES.STORY_TO_REVIEW], { allowFailure: true });
    expect("STORY_TO_REVIEW blocked from VERIFY_STATUSES", t5, false);

    // TEST 6: SCENARIO_VALIDATION allowed with zero processable
    const t6 = run(["advance", P, projectRoot, "--to", PHASES.SCENARIO_VALIDATION]);
    expect("SCENARIO_VALIDATION allowed with zero processable", t6, true);

    // TEST 6b: STORY_TO_REVIEW blocked without scenario_pass
    run(["checkpoint", P, projectRoot, "--phase", PHASES.SCENARIO_VALIDATION, "--payload", JSON.stringify({ scenario_pass: false })]);
    const t6b = run(["advance", P, projectRoot, "--to", PHASES.STORY_TO_REVIEW], { allowFailure: true });
    expect("STORY_TO_REVIEW blocked without scenario_pass", t6b, false);

    // TEST 6c: STORY_TO_REVIEW allowed with scenario_pass=true
    run(["checkpoint", P, projectRoot, "--phase", PHASES.SCENARIO_VALIDATION, "--payload", JSON.stringify({ scenario_pass: true, validation_mode: "self_check_only" })]);
    const t6c = run(["advance", P, projectRoot, "--to", PHASES.STORY_TO_REVIEW]);
    expect("STORY_TO_REVIEW allowed with scenario_pass=true", t6c, true);

    // TEST 7: DONE blocked without story_transition_done
    run(["checkpoint", P, projectRoot, "--phase", PHASES.STORY_TO_REVIEW]);
    run(["advance", P, projectRoot, "--to", PHASES.SELF_CHECK]);
    run(["checkpoint", P, projectRoot, "--phase", PHASES.SELF_CHECK, "--payload", JSON.stringify({ pass: true, final_result: "READY_FOR_GATE" })]);
    const t7 = run(["complete", P, projectRoot], { allowFailure: true });
    expect("DONE blocked without story_transition_done", t7, false);

    process.stdout.write(`\nstory-execution-runtime guards: ${passed} passed, ${failed} failed\n`);
    if (failed > 0) process.exit(1);
} finally {
    rmSync(projectRoot, { recursive: true, force: true });
}
