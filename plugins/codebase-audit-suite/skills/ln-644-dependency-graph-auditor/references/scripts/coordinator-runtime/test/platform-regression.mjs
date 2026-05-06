import { writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
    createJsonCliRunner,
    createProjectRoot,
    writeJson,
} from "./cli-test-helpers.mjs";
import { WORKER_SUMMARY_STATUSES } from "../lib/runtime-constants.mjs";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../../..");

const envCli = join(repoRoot, "references/scripts/environment-setup-runtime/cli.mjs");
const storyCli = join(repoRoot, "references/scripts/story-planning-runtime/cli.mjs");
const taskCli = join(repoRoot, "references/scripts/task-planning-runtime/cli.mjs");
const evaluationCli = join(repoRoot, "references/scripts/evaluation-runtime/cli.mjs");
const executionCli = join(repoRoot, "references/scripts/story-execution-runtime/cli.mjs");
const gateCli = join(repoRoot, "references/scripts/story-gate-runtime/cli.mjs");
const optimizationCli = join(repoRoot, "references/scripts/optimization-runtime/cli.mjs");

function assert(condition, message) {
    if (!condition) {
        throw new Error(message);
    }
}

function assertInactiveStatus(cliPath, args = []) {
    const projectRoot = createProjectRoot("runtime-platform-inactive-");
    const run = createJsonCliRunner(cliPath, projectRoot);
    const status = run(["status", ...args]);
    assert(status.ok === true, `Inactive status failed for ${cliPath}`);
    assert(status.active === false, `Inactive status should be false for ${cliPath}`);
    assert(status.runtime === null, `Inactive runtime should be null for ${cliPath}`);
}

function writeManifest(projectRoot, name, payload) {
    const filePath = join(projectRoot, `${name}.json`);
    writeJson(filePath, payload);
    return filePath;
}

function testInactiveShape() {
    assertInactiveStatus(envCli);
    assertInactiveStatus(storyCli);
    assertInactiveStatus(taskCli);
    assertInactiveStatus(evaluationCli, ["--skill", "ln-310"]);
    assertInactiveStatus(executionCli);
    assertInactiveStatus(gateCli);
    assertInactiveStatus(optimizationCli);
}

function testEnvironmentReplayFromHistory() {
    const projectRoot = createProjectRoot("runtime-platform-replay-");
    const run = createJsonCliRunner(envCli, projectRoot);
    const manifestFile = writeManifest(projectRoot, "env-manifest", {
        targets: ["both"],
        dry_run: true,
    });

    const started = run(["start", "--identifier", "targets-both", "--manifest-file", manifestFile]);
    assert(started.ok === true, "Environment run should start");

    run([
        "checkpoint",
        "--identifier",
        "targets-both",
        "--phase",
        "PHASE_0_CONFIG",
        "--payload",
        JSON.stringify({ initialized: true }),
    ]);
    run(["advance", "--identifier", "targets-both", "--to", "PHASE_1_ASSESS"]);
    run([
        "checkpoint",
        "--identifier",
        "targets-both",
        "--phase",
        "PHASE_1_ASSESS",
        "--payload",
        JSON.stringify({ assess_summary: { status: WORKER_SUMMARY_STATUSES.COMPLETED } }),
    ]);
    run(["advance", "--identifier", "targets-both", "--to", "PHASE_2_DISPATCH_PLAN"]);

    const runDir = join(projectRoot, ".hex-skills", "environment-setup", "runtime", "runs", started.run_id);
    writeFileSync(join(runDir, "manifest.json"), "{broken", "utf8");
    writeFileSync(join(runDir, "state.json"), "{broken", "utf8");
    writeFileSync(join(runDir, "checkpoints.json"), "{broken", "utf8");

    const status = run(["status", "--identifier", "targets-both"]);
    assert(status.ok === true, "Replay status should succeed");
    assert(status.state.phase === "PHASE_2_DISPATCH_PLAN", "Replay should restore latest phase from history");
    assert(status.runtime.run_id === started.run_id, "Replay should preserve run id");
}

function testPauseResumeAcrossPlanningFamilies() {
    const storyRoot = createProjectRoot("runtime-platform-story-");
    const runStory = createJsonCliRunner(storyCli, storyRoot);
    const storyManifest = writeManifest(storyRoot, "story-manifest", {
        epic_id: "42",
        auto_approve: false,
    });

    runStory(["start", "--epic", "42", "--manifest-file", storyManifest]);
    runStory([
        "pause",
        "--epic",
        "42",
        "--reason",
        "Preview required",
        "--payload",
        JSON.stringify({
            kind: "preview_confirmation",
            question: "Confirm preview?",
            choices: ["confirm_preview", "cancel"],
            default_choice: "confirm_preview",
            context: { epic_id: "42" },
            resume_to_phase: "PHASE_6_DELEGATE",
            blocking: true,
        }),
    ]);
    const pausedStory = runStory(["status", "--epic", "42"]);
    assert(pausedStory.resume_action === "Resolve pending decision: preview_confirmation", "Story planning resume action mismatch");
    const resumedStory = runStory([
        "set-decision",
        "--epic",
        "42",
        "--payload",
        JSON.stringify({ selected_choice: "confirm_preview" }),
    ]);
    assert(resumedStory.state.phase === "PHASE_6_DELEGATE", "Story planning should resume to delegate phase");

    const taskRoot = createProjectRoot("runtime-platform-task-");
    const runTask = createJsonCliRunner(taskCli, taskRoot);
    const taskManifest = writeManifest(taskRoot, "task-manifest", {
        story_id: "99",
        auto_approve: false,
    });

    runTask(["start", "--story", "99", "--manifest-file", taskManifest]);
    runTask([
        "pause",
        "--story",
        "99",
        "--reason",
        "Readiness approval required",
        "--payload",
        JSON.stringify({
            kind: "readiness_approval",
            question: "Proceed with readiness score 5?",
            choices: ["continue", "cancel"],
            default_choice: "continue",
            context: { story_id: "99" },
            resume_to_phase: "PHASE_4_MODE_DETECTION",
            blocking: true,
        }),
    ]);
    const pausedTask = runTask(["status", "--story", "99"]);
    assert(pausedTask.resume_action === "Resolve pending decision: readiness_approval", "Task planning resume action mismatch");
    const resumedTask = runTask([
        "set-decision",
        "--story",
        "99",
        "--payload",
        JSON.stringify({ selected_choice: "continue" }),
    ]);
    assert(resumedTask.state.phase === "PHASE_4_MODE_DETECTION", "Task planning should resume to mode detection phase");
}

function testIsolationAcrossIdentifiers() {
    const envRoot = createProjectRoot("runtime-platform-isolation-env-");
    const runEnv = createJsonCliRunner(envCli, envRoot);
    const envManifest = writeManifest(envRoot, "env-manifest", {
        targets: ["both"],
        dry_run: true,
    });

    runEnv(["start", "--identifier", "targets-both", "--manifest-file", envManifest]);
    runEnv(["start", "--identifier", "targets-codex", "--manifest-file", envManifest]);

    const ambiguousEnv = runEnv(["status"], { allowFailure: true });
    assert(ambiguousEnv.ok === false, "Environment status without identifier should fail when multiple runs exist");

    const taskRoot = createProjectRoot("runtime-platform-isolation-task-");
    const runTask = createJsonCliRunner(taskCli, taskRoot);
    const taskManifest = writeManifest(taskRoot, "task-manifest", {
        auto_approve: true,
    });

    runTask(["start", "--story", "1", "--manifest-file", taskManifest]);
    runTask(["start", "--story", "2", "--manifest-file", taskManifest]);

    const ambiguousTask = runTask(["status"], { allowFailure: true });
    assert(ambiguousTask.ok === false, "Task planning status without story should fail when multiple runs exist");
}

function testInvalidResumeToPhase() {
    const storyRoot = createProjectRoot("runtime-platform-bad-resume-");
    const runStory = createJsonCliRunner(storyCli, storyRoot);
    const manifest = writeManifest(storyRoot, "story-manifest", {
        epic_id: "bad-1",
        auto_approve: false,
    });

    runStory(["start", "--epic", "bad-1", "--manifest-file", manifest]);

    // Test 1: invalid resume_to_phase at pause time
    const badPause = runStory([
        "pause", "--epic", "bad-1", "--reason", "Test",
        "--payload", JSON.stringify({
            kind: "test", question: "Test?", choices: ["yes", "no"],
            default_choice: "yes", context: {},
            resume_to_phase: "PHASE_99_INVALID", blocking: true,
        }),
    ], { allowFailure: true });
    assert(badPause.ok === false, "Pause with invalid resume_to_phase should fail");

    // Test 2: terminal phase (DONE) as resume target
    const terminalPause = runStory([
        "pause", "--epic", "bad-1", "--reason", "Test",
        "--payload", JSON.stringify({
            kind: "test", question: "Test?", choices: ["yes", "no"],
            default_choice: "yes", context: {},
            resume_to_phase: "DONE", blocking: true,
        }),
    ], { allowFailure: true });
    assert(terminalPause.ok === false, "Pause with terminal resume_to_phase should fail");

    // Test 3: valid pause, then invalid selected_choice
    runStory([
        "pause", "--epic", "bad-1", "--reason", "Test",
        "--payload", JSON.stringify({
            kind: "test", question: "Test?", choices: ["yes", "no"],
            default_choice: "yes", context: {},
            resume_to_phase: "PHASE_6_DELEGATE", blocking: true,
        }),
    ]);
    const badChoice = runStory([
        "set-decision", "--epic", "bad-1",
        "--payload", JSON.stringify({ selected_choice: "maybe" }),
    ], { allowFailure: true });
    assert(badChoice.ok === false, "Decision with invalid selected_choice should fail");
}


testInactiveShape();
testEnvironmentReplayFromHistory();
testPauseResumeAcrossPlanningFamilies();
testIsolationAcrossIdentifiers();
testInvalidResumeToPhase();

process.stdout.write("platform regression passed\n");
