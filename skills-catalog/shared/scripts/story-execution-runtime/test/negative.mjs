#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { PHASES } from "../lib/phases.mjs";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const cliPath = join(__dirname, "..", "cli.mjs");
const projectRoot = mkdtempSync(join(tmpdir(), "story-execution-negative-"));

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

try {
    const manifestPath = join(projectRoot, "manifest.json");
    writeFileSync(manifestPath, JSON.stringify({
        task_provider: "file",
        worktree_dir: ".hex-skills/worktrees/story-NEG",
        branch: "feature/neg-test",
    }, null, 2));

    run(["start", "--project-root", projectRoot, "--story", "NEG-1", "--manifest-file", manifestPath]);

    // Fast-forward to SELECT_WORK
    run(["checkpoint", "--project-root", projectRoot, "--phase", PHASES.CONFIG]);
    run(["advance", "--project-root", projectRoot, "--to", PHASES.DISCOVERY]);
    run(["checkpoint", "--project-root", projectRoot, "--phase", PHASES.DISCOVERY]);
    run(["advance", "--project-root", projectRoot, "--to", PHASES.WORKTREE_SETUP]);
    run([
        "checkpoint", "--project-root", projectRoot,
        "--phase", PHASES.WORKTREE_SETUP,
        "--payload", JSON.stringify({ worktree_ready: true }),
    ]);
    run(["advance", "--project-root", projectRoot, "--to", PHASES.SELECT_WORK]);
    run([
        "checkpoint", "--project-root", projectRoot,
        "--phase", PHASES.SELECT_WORK,
        "--payload", JSON.stringify({
            current_task_id: "T-NEG",
            processable_counts: { todo: 2, to_review: 0, to_rework: 0 },
        }),
    ]);
    run(["advance", "--project-root", projectRoot, "--to", PHASES.TASK_EXECUTION]);
    run(["checkpoint", "--project-root", projectRoot, "--phase", PHASES.TASK_EXECUTION]);
    run(["advance", "--project-root", projectRoot, "--to", PHASES.VERIFY_STATUSES]);

    // TEST 1: SCENARIO_VALIDATION blocked with processable_counts > 0
    run([
        "checkpoint", "--project-root", projectRoot,
        "--phase", PHASES.VERIFY_STATUSES,
        "--payload", JSON.stringify({
            processable_counts: { todo: 1, to_review: 0, to_rework: 0 },
            inflight_workers: {},
        }),
    ]);
    const blocked1 = run([
        "advance", "--project-root", projectRoot,
        "--to", PHASES.SCENARIO_VALIDATION,
    ], { allowFailure: true });
    if (blocked1.ok !== false || !String(blocked1.error || "").includes("Processable")) {
        throw new Error("Expected SCENARIO_VALIDATION blocked with pending tasks");
    }

    // TEST 2: DONE blocked without story_transition_done
    // Fix counts and fast-forward
    run([
        "checkpoint", "--project-root", projectRoot,
        "--phase", PHASES.VERIFY_STATUSES,
        "--payload", JSON.stringify({
            processable_counts: { todo: 0, to_review: 0, to_rework: 0 },
            inflight_workers: {},
        }),
    ]);
    run(["advance", "--project-root", projectRoot, "--to", PHASES.SCENARIO_VALIDATION]);
    run([
        "checkpoint", "--project-root", projectRoot,
        "--phase", PHASES.SCENARIO_VALIDATION,
        "--payload", JSON.stringify({ scenario_pass: true, validation_mode: "self_check_only" }),
    ]);
    run(["advance", "--project-root", projectRoot, "--to", PHASES.STORY_TO_REVIEW]);
    run(["checkpoint", "--project-root", projectRoot, "--phase", PHASES.STORY_TO_REVIEW]);
    run(["advance", "--project-root", projectRoot, "--to", PHASES.SELF_CHECK]);
    run([
        "checkpoint", "--project-root", projectRoot,
        "--phase", PHASES.SELF_CHECK,
        "--payload", JSON.stringify({ pass: true, final_result: "READY_FOR_GATE" }),
    ]);
    const blocked2 = run([
        "complete", "--project-root", projectRoot,
    ], { allowFailure: true });
    if (blocked2.ok !== false || !String(blocked2.error || "").includes("Story transition")) {
        throw new Error("Expected DONE blocked without story_transition_done");
    }

    process.stdout.write("story-execution-runtime negative passed\n");
} finally {
    rmSync(projectRoot, { recursive: true, force: true });
}
