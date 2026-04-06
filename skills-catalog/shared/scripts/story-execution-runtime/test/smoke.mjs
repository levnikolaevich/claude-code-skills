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

function taskSummary(runId, taskId, producerSkill, fromStatus, toStatus, overrides = {}) {
    return {
        schema_version: "1.0.0",
        summary_kind: "task-status",
        run_id: runId,
        identifier: taskId,
        producer_skill: producerSkill,
        produced_at: "2026-04-06T00:00:00Z",
        payload: {
            worker: producerSkill,
            status: "completed",
            from_status: fromStatus,
            to_status: toStatus,
            warnings: [],
            ...overrides,
        },
    };
}

function stageSummary(runId, storyId) {
    return {
        schema_version: "1.0.0",
        summary_kind: "pipeline-stage",
        run_id: runId,
        identifier: storyId,
        producer_skill: "ln-400",
        produced_at: "2026-04-06T00:00:00Z",
        payload: {
            stage: 2,
            story_id: storyId,
            status: "completed",
            final_result: STORY_EXECUTION_FINAL_RESULTS.READY_FOR_GATE,
            story_status: TASK_BOARD_STATUSES.TO_REVIEW,
            warnings: [],
        },
    };
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
        "record-worker",
        "--project-root", projectRoot,
        "--task-id", "T-100",
        "--payload",
        JSON.stringify(taskSummary(started.run_id, "T-100", "ln-401", TASK_BOARD_STATUSES.TODO, TASK_BOARD_STATUSES.TO_REVIEW, {
            result: "review_handoff",
            files_changed: ["src/example.ts"],
        })),
    ]);
    run([
        "record-worker",
        "--project-root", projectRoot,
        "--task-id", "T-100",
        "--payload",
        JSON.stringify(taskSummary(started.run_id, "T-100", "ln-402", TASK_BOARD_STATUSES.TO_REVIEW, TASK_BOARD_STATUSES.DONE, {
            result: "accepted",
            score: 98,
        })),
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
        "record-stage-summary",
        "--project-root", projectRoot,
        "--story", "PROJ-123",
        "--payload",
        JSON.stringify(stageSummary(started.run_id, "PROJ-123")),
    ]);
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
