#!/usr/bin/env node
// SOURCE-OF-TRUTH: shared/scripts/story-execution-runtime/test/loop-health.mjs. Edit ONLY here; run `node tools/marketplace/shared.mjs sync`

import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { createJsonCliRunner } from "../../coordinator-runtime/test/cli-test-helpers.mjs";
import { PHASES } from "../lib/phases.mjs";

const cliPath = join(fileURLToPath(new URL("..", import.meta.url)), "cli.mjs");
const projectRoot = mkdtempSync(join(tmpdir(), "story-loop-health-"));
const run = createJsonCliRunner(cliPath, projectRoot);

function assert(condition, message) {
    if (!condition) {
        throw new Error(message);
    }
}

try {
    const manifestPath = join(projectRoot, "manifest.json");
    writeFileSync(manifestPath, JSON.stringify({
        task_provider: "file",
        worktree_dir: ".hex-skills/worktrees/story-PROJ-LOOP",
        branch: "feature/proj-loop-story",
    }, null, 2));
    const started = run(["start", "--project-root", projectRoot, "--story", "PROJ-LOOP", "--manifest-file", manifestPath]);
    assert(started.ok === true, "runtime should start");

    let third = null;
    for (let i = 0; i < 3; i += 1) {
        third = run([
            "record-loop-health",
            "--project-root", projectRoot,
            "--story", "PROJ-LOOP",
            "--scope", "task",
            "--scope-id", "TASK-1",
            "--payload", JSON.stringify({ error: "ASSERT same task failed", progress_detected: false }),
        ]);
    }
    assert(third.pause.pause === true, "repeated same task failure should pause");
    assert(third.state.phase === PHASES.PAUSED, "runtime phase should be PAUSED");

    const resumed = run(["advance", "--project-root", projectRoot, "--story", "PROJ-LOOP", "--to", PHASES.DISCOVERY, "--resolve"]);
    assert(resumed.ok === true, "runtime should resume after explicit resolve");
    const progressed = run([
        "record-loop-health",
        "--project-root", projectRoot,
        "--story", "PROJ-LOOP",
        "--scope", "task",
        "--scope-id", "TASK-1",
        "--payload", JSON.stringify({ error: "ASSERT same task failed", progress_detected: true }),
    ]);
    assert(progressed.loop_health.no_progress_count === 0, "progress should reset no-progress counter");
    assert(progressed.loop_health.same_error_count === 0, "progress should reset same-error counter");

    process.stdout.write("story execution loop-health tests passed\n");
} finally {
    rmSync(projectRoot, { recursive: true, force: true });
}
