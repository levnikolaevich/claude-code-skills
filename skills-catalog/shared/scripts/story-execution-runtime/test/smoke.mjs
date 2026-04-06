#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
    STORY_EXECUTION_FINAL_RESULTS,
    TASK_BOARD_STATUSES,
} from "../../coordinator-runtime/lib/runtime-constants.mjs";
import { PHASES } from "../lib/phases.mjs";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const cliPath = join(__dirname, "..", "cli.mjs");
const projectRoot = mkdtempSync(join(tmpdir(), "story-execution-runtime-"));

function run(args) {
    return JSON.parse(execFileSync("node", [cliPath, ...args], {
        cwd: projectRoot,
        encoding: "utf8",
    }));
}

try {
    const manifestPath = join(projectRoot, "manifest.json");
    writeFileSync(manifestPath, JSON.stringify({
        task_provider: "file",
        worktree_dir: ".hex-skills/worktrees/story-PROJ-123",
        branch: "feature/proj-123-story",
    }, null, 2));

    const started = run(["start", "--project-root", projectRoot, "--story", "PROJ-123", "--manifest-file", manifestPath]);
    if (!started.ok) {
        throw new Error("Failed to start story execution runtime");
    }

    run(["checkpoint", "--project-root", projectRoot, "--phase", PHASES.CONFIG]);
    run(["advance", "--project-root", projectRoot, "--to", PHASES.DISCOVERY]);
    run(["checkpoint", "--project-root", projectRoot, "--phase", PHASES.DISCOVERY]);
    run(["advance", "--project-root", projectRoot, "--to", PHASES.WORKTREE_SETUP]);
    run([
        "checkpoint",
        "--project-root", projectRoot,
        "--phase", PHASES.WORKTREE_SETUP,
        "--payload",
        JSON.stringify({
            worktree_ready: true,
            worktree_dir: ".hex-skills/worktrees/story-PROJ-123",
            branch: "feature/proj-123-story",
        }),
    ]);
    run(["advance", "--project-root", projectRoot, "--to", PHASES.SELECT_WORK]);
    run([
        "checkpoint",
        "--project-root", projectRoot,
        "--phase", PHASES.SELECT_WORK,
        "--payload",
        JSON.stringify({
            current_task_id: "T-100",
            processable_counts: { todo: 1, to_review: 0, to_rework: 0 },
        }),
    ]);
    run(["advance", "--project-root", projectRoot, "--to", PHASES.TASK_EXECUTION]);
    run([
        "record-task",
        "--project-root", projectRoot,
        "--task-id", "T-100",
        "--payload",
        JSON.stringify({
            worker: "ln-401",
            result: "review_handoff",
            from_status: TASK_BOARD_STATUSES.TODO,
            to_status: TASK_BOARD_STATUSES.DONE,
        }),
    ]);
    run(["checkpoint", "--project-root", projectRoot, "--phase", PHASES.TASK_EXECUTION]);
    run(["advance", "--project-root", projectRoot, "--to", PHASES.VERIFY_STATUSES]);
    run([
        "checkpoint",
        "--project-root", projectRoot,
        "--phase", PHASES.VERIFY_STATUSES,
        "--payload",
        JSON.stringify({
            processable_counts: { todo: 0, to_review: 0, to_rework: 0 },
            inflight_workers: {},
        }),
    ]);
    run(["advance", "--project-root", projectRoot, "--to", PHASES.SCENARIO_VALIDATION]);
    run([
        "checkpoint",
        "--project-root", projectRoot,
        "--phase", PHASES.SCENARIO_VALIDATION,
        "--payload",
        JSON.stringify({
            scenario_pass: true,
            validation_mode: "self_check_only",
        }),
    ]);
    run(["advance", "--project-root", projectRoot, "--to", PHASES.STORY_TO_REVIEW]);
    run([
        "checkpoint",
        "--project-root", projectRoot,
        "--phase", PHASES.STORY_TO_REVIEW,
        "--payload",
        JSON.stringify({
            story_transition_done: true,
            story_final_status: TASK_BOARD_STATUSES.TO_REVIEW,
            final_result: STORY_EXECUTION_FINAL_RESULTS.READY_FOR_GATE,
        }),
    ]);
    run(["advance", "--project-root", projectRoot, "--to", PHASES.SELF_CHECK]);
    run([
        "checkpoint",
        "--project-root", projectRoot,
        "--phase", PHASES.SELF_CHECK,
        "--payload",
        JSON.stringify({ pass: true, final_result: STORY_EXECUTION_FINAL_RESULTS.READY_FOR_GATE }),
    ]);
    const completed = run(["complete", "--project-root", projectRoot]);

    if (!completed.ok || completed.state.phase !== PHASES.DONE) {
        throw new Error("Story execution runtime did not complete");
    }

    process.stdout.write("story-execution-runtime smoke passed\n");
} finally {
    rmSync(projectRoot, { recursive: true, force: true });
}
