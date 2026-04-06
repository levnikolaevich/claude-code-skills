#!/usr/bin/env node

import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { isAbsolute, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
    STORY_EXECUTION_FINAL_RESULTS,
    STORY_GATE_FINALIZATION_STATUSES,
    STORY_GATE_VERDICTS,
    TASK_BOARD_STATUSES,
} from "../../../shared/scripts/coordinator-runtime/lib/runtime-constants.mjs";
import {
    createJsonCliRunner,
    createProjectRoot,
    writeJson,
} from "../../../shared/scripts/coordinator-runtime/test/cli-test-helpers.mjs";
import { PHASES as PIPELINE_PHASES } from "../lib/phases.mjs";
import { PHASES as TASK_PLANNING_PHASES } from "../../../shared/scripts/task-planning-runtime/lib/phases.mjs";
import { PHASES as REVIEW_PHASES } from "../../../shared/scripts/review-runtime/lib/phases.mjs";
import { PHASES as EXECUTION_PHASES } from "../../../shared/scripts/story-execution-runtime/lib/phases.mjs";
import { PHASES as GATE_PHASES } from "../../../shared/scripts/story-gate-runtime/lib/phases.mjs";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const pipelineCliPath = join(__dirname, "..", "cli.mjs");
const taskPlanningCliPath = join(__dirname, "../../../shared/scripts/task-planning-runtime/cli.mjs");
const reviewCliPath = join(__dirname, "../../../shared/scripts/review-runtime/cli.mjs");
const executionCliPath = join(__dirname, "../../../shared/scripts/story-execution-runtime/cli.mjs");
const gateCliPath = join(__dirname, "../../../shared/scripts/story-gate-runtime/cli.mjs");
const FIXED_TIME = "2026-04-06T00:00:00Z";

export function createScenarioContext(prefix, {
    storyId = "PROJ-123",
    title = "Story title",
} = {}) {
    const projectRoot = createProjectRoot(prefix);
    return {
        projectRoot,
        storyId,
        title,
        runPipeline: createJsonCliRunner(pipelineCliPath, projectRoot),
        runTaskPlanning: createJsonCliRunner(taskPlanningCliPath, projectRoot),
        runReview: createJsonCliRunner(reviewCliPath, projectRoot),
        runExecution: createJsonCliRunner(executionCliPath, projectRoot),
        runGate: createJsonCliRunner(gateCliPath, projectRoot),
    };
}

export function cleanupScenarioContext(context) {
    rmSync(context.projectRoot, { recursive: true, force: true });
}

function startPipeline(context) {
    const started = context.runPipeline(["start", "--story", context.storyId, "--title", context.title]);
    assert(started.ok, "Failed to start pipeline runtime");
    return started;
}

function pipelineStatus(context) {
    return context.runPipeline(["status", "--story", context.storyId]);
}

function advancePipeline(context, toPhase, { allowFailure = false } = {}) {
    return context.runPipeline(["advance", "--story", context.storyId, "--to", toPhase], { allowFailure });
}

function completePipeline(context, { allowFailure = false } = {}) {
    return context.runPipeline(["complete", "--story", context.storyId], { allowFailure });
}

function checkpointPipelineStage(context, checkpoint) {
    const args = [
        "checkpoint",
        "--story", context.storyId,
        "--stage", String(checkpoint.stage),
        "--last-action", checkpoint.lastAction,
    ];

    if (checkpoint.stage === 0) {
        args.push("--plan-score", String(checkpoint.planScore));
        args.push("--tasks-remaining", JSON.stringify(checkpoint.tasksRemaining || []));
    }
    if (checkpoint.stage === 1) {
        args.push("--verdict", checkpoint.verdict);
        args.push("--readiness", String(checkpoint.readinessScore));
    }
    if (checkpoint.stage === 2) {
        args.push("--tasks-completed", JSON.stringify(checkpoint.tasksCompleted || []));
        args.push("--git-stats", JSON.stringify(checkpoint.gitStats || {}));
    }
    if (checkpoint.stage === 3) {
        args.push("--verdict", checkpoint.verdict);
        args.push("--quality-score", String(checkpoint.qualityScore));
        if (checkpoint.issues) {
            args.push("--issues", checkpoint.issues);
        }
    }

    return context.runPipeline(args);
}

function recordPipelineStageArtifact(context, artifact) {
    return context.runPipeline([
        "record-stage-summary",
        "--story", context.storyId,
        "--payload", JSON.stringify(artifact),
    ]);
}

function buildPipelineStageArtifact({
    stage,
    runId,
    storyId,
    producerSkill,
    finalResult,
    storyStatus,
    extra = {},
}) {
    return {
        schema_version: "1.0.0",
        summary_kind: "pipeline-stage",
        run_id: runId,
        identifier: storyId,
        producer_skill: producerSkill,
        produced_at: FIXED_TIME,
        payload: {
            stage,
            story_id: storyId,
            status: "completed",
            final_result: finalResult,
            story_status: storyStatus,
            warnings: [],
            ...extra,
        },
    };
}

function readRuntimeArtifact(projectRoot, artifactPath) {
    const resolvedPath = isAbsolute(artifactPath) ? artifactPath : join(projectRoot, artifactPath);
    return JSON.parse(readFileSync(resolvedPath, "utf8"));
}

function taskPlanWorkerSummary(runId, storyId) {
    return {
        schema_version: "1.0.0",
        summary_kind: "task-plan",
        run_id: runId,
        identifier: `story-${storyId}`,
        producer_skill: "ln-301",
        produced_at: FIXED_TIME,
        payload: {
            mode: "CREATE",
            story_id: storyId,
            task_type: "implementation",
            tasks_created: 3,
            tasks_updated: 0,
            tasks_canceled: 0,
            task_urls: ["TASK-1", "TASK-2", "TASK-3"],
            dry_warnings_count: 0,
            warnings: [],
            kanban_updated: true,
        },
    };
}

function taskStatusWorkerSummary(runId, taskId, producerSkill, fromStatus, toStatus, overrides = {}) {
    return {
        schema_version: "1.0.0",
        summary_kind: "task-status",
        run_id: runId,
        identifier: taskId,
        producer_skill: producerSkill,
        produced_at: FIXED_TIME,
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

function assert(condition, message) {
    if (!condition) {
        throw new Error(message);
    }
}

function assertIncludes(value, expected, message) {
    if (!String(value || "").includes(expected)) {
        throw new Error(`${message}: expected "${expected}" in "${value}"`);
    }
}

function runStage0(context, { label, planScore = 4, finalResult = "PLAN_READY", storyStatus = "Backlog" }) {
    const manifestPath = join(context.projectRoot, `task-planning-${label}.manifest.json`);
    writeJson(manifestPath, {
        task_provider: "file",
        auto_approve: true,
    });

    const started = context.runTaskPlanning([
        "start",
        "--project-root", context.projectRoot,
        "--story", context.storyId,
        "--manifest-file", manifestPath,
    ]);
    assert(started.ok, "Failed to start Stage 0 runtime");

    context.runTaskPlanning(["checkpoint", "--project-root", context.projectRoot, "--story", context.storyId, "--phase", TASK_PLANNING_PHASES.CONFIG]);
    context.runTaskPlanning(["advance", "--project-root", context.projectRoot, "--story", context.storyId, "--to", TASK_PLANNING_PHASES.DISCOVERY]);
    context.runTaskPlanning(["checkpoint", "--project-root", context.projectRoot, "--story", context.storyId, "--phase", TASK_PLANNING_PHASES.DISCOVERY, "--payload", "{\"discovery_ready\":true}"]);
    context.runTaskPlanning(["advance", "--project-root", context.projectRoot, "--story", context.storyId, "--to", TASK_PLANNING_PHASES.DECOMPOSE]);
    context.runTaskPlanning(["checkpoint", "--project-root", context.projectRoot, "--story", context.storyId, "--phase", TASK_PLANNING_PHASES.DECOMPOSE, "--payload", "{\"ideal_plan_summary\":{\"tasks_planned\":3}}"]);
    context.runTaskPlanning(["advance", "--project-root", context.projectRoot, "--story", context.storyId, "--to", TASK_PLANNING_PHASES.READINESS_GATE]);
    context.runTaskPlanning(["checkpoint", "--project-root", context.projectRoot, "--story", context.storyId, "--phase", TASK_PLANNING_PHASES.READINESS_GATE, "--payload", "{\"readiness_score\":6,\"readiness_findings\":[]}"]);
    context.runTaskPlanning(["advance", "--project-root", context.projectRoot, "--story", context.storyId, "--to", TASK_PLANNING_PHASES.MODE_DETECTION]);
    context.runTaskPlanning(["checkpoint", "--project-root", context.projectRoot, "--story", context.storyId, "--phase", TASK_PLANNING_PHASES.MODE_DETECTION, "--payload", "{\"mode_detection\":\"CREATE\"}"]);
    context.runTaskPlanning(["advance", "--project-root", context.projectRoot, "--story", context.storyId, "--to", TASK_PLANNING_PHASES.DELEGATE]);
    context.runTaskPlanning([
        "record-plan",
        "--project-root", context.projectRoot,
        "--story", context.storyId,
        "--payload", JSON.stringify(taskPlanWorkerSummary(started.run_id, context.storyId)),
    ]);
    context.runTaskPlanning(["checkpoint", "--project-root", context.projectRoot, "--story", context.storyId, "--phase", TASK_PLANNING_PHASES.DELEGATE]);
    context.runTaskPlanning(["advance", "--project-root", context.projectRoot, "--story", context.storyId, "--to", TASK_PLANNING_PHASES.VERIFY]);
    context.runTaskPlanning(["checkpoint", "--project-root", context.projectRoot, "--story", context.storyId, "--phase", TASK_PLANNING_PHASES.VERIFY, "--payload", "{\"verification_summary\":{\"tasks_verified\":3},\"final_result\":\"PLAN_READY\",\"template_compliance_passed\":true}"]);
    context.runTaskPlanning(["advance", "--project-root", context.projectRoot, "--story", context.storyId, "--to", TASK_PLANNING_PHASES.SELF_CHECK]);
    context.runTaskPlanning([
        "record-stage-summary",
        "--project-root", context.projectRoot,
        "--story", context.storyId,
        "--payload", JSON.stringify(buildPipelineStageArtifact({
            stage: 0,
            runId: started.run_id,
            storyId: context.storyId,
            producerSkill: "ln-300",
            finalResult,
            storyStatus,
        })),
    ]);
    context.runTaskPlanning(["checkpoint", "--project-root", context.projectRoot, "--story", context.storyId, "--phase", TASK_PLANNING_PHASES.SELF_CHECK, "--payload", "{\"pass\":true,\"final_result\":\"PLAN_READY\"}"]);
    const status = context.runTaskPlanning(["status", "--project-root", context.projectRoot, "--story", context.storyId]);
    const artifact = readRuntimeArtifact(context.projectRoot, status.state.stage_summary.payload.artifact_path);
    const completed = context.runTaskPlanning(["complete", "--project-root", context.projectRoot, "--story", context.storyId]);
    assert(completed.ok && completed.state.phase === "DONE", "Stage 0 runtime did not complete");

    return {
        artifact,
        checkpoint: {
            stage: 0,
            planScore,
            tasksRemaining: [],
            lastAction: `stage-0-${label}`,
        },
    };
}

function runStage1(context, {
    label,
    verdict,
    readinessScore,
    storyStatus,
}) {
    mkdirSync(join(context.projectRoot, ".hex-skills", "agent-review"), { recursive: true });
    const manifestPath = join(context.projectRoot, `review-${label}.manifest.json`);
    const metadataPath = join(context.projectRoot, `review-${label}.meta.json`);
    const resultPath = join(context.projectRoot, `review-${label}.result.md`);

    writeJson(manifestPath, {
        storage_mode: "file",
        expected_agents: ["codex"],
        phase_policy: { phase5: "required", phase8: "required" },
    });

    const started = context.runReview([
        "start",
        "--project-root", context.projectRoot,
        "--skill", "ln-310",
        "--mode", "story",
        "--identifier", context.storyId,
        "--manifest-file", manifestPath,
    ]);
    assert(started.ok, "Failed to start Stage 1 runtime");

    context.runReview(["checkpoint", "--project-root", context.projectRoot, "--skill", "ln-310", "--phase", REVIEW_PHASES.CONFIG]);
    context.runReview(["advance", "--project-root", context.projectRoot, "--skill", "ln-310", "--to", REVIEW_PHASES.DISCOVERY]);
    context.runReview(["checkpoint", "--project-root", context.projectRoot, "--skill", "ln-310", "--phase", REVIEW_PHASES.DISCOVERY]);
    context.runReview(["advance", "--project-root", context.projectRoot, "--skill", "ln-310", "--to", REVIEW_PHASES.AGENT_LAUNCH]);
    context.runReview([
        "register-agent",
        "--project-root", context.projectRoot,
        "--skill", "ln-310",
        "--agent", "codex",
        "--metadata-file", metadataPath,
        "--result-file", resultPath,
    ]);
    context.runReview([
        "checkpoint",
        "--project-root", context.projectRoot,
        "--skill", "ln-310",
        "--phase", REVIEW_PHASES.AGENT_LAUNCH,
        "--payload", "{\"health_check_done\":true,\"agents_available\":1,\"agents_required\":[\"codex\"]}",
    ]);
    context.runReview(["advance", "--project-root", context.projectRoot, "--skill", "ln-310", "--to", REVIEW_PHASES.RESEARCH]);
    context.runReview(["checkpoint", "--project-root", context.projectRoot, "--skill", "ln-310", "--phase", REVIEW_PHASES.RESEARCH]);
    context.runReview(["advance", "--project-root", context.projectRoot, "--skill", "ln-310", "--to", REVIEW_PHASES.DOCS]);
    context.runReview(["checkpoint", "--project-root", context.projectRoot, "--skill", "ln-310", "--phase", REVIEW_PHASES.DOCS, "--payload", "{\"docs_checkpoint\":{\"docs_created\":[],\"docs_skipped_reason\":\"test\"}}"]);
    context.runReview(["advance", "--project-root", context.projectRoot, "--skill", "ln-310", "--to", REVIEW_PHASES.AUTOFIX]);
    context.runReview(["checkpoint", "--project-root", context.projectRoot, "--skill", "ln-310", "--phase", REVIEW_PHASES.AUTOFIX]);

    writeFileSync(metadataPath, JSON.stringify({
        pid: process.pid,
        started_at: FIXED_TIME,
        finished_at: FIXED_TIME,
        status: "result_ready",
        success: true,
        exit_code: 0,
    }, null, 2));
    writeFileSync(resultPath, "<!-- AGENT_REVIEW_RESULT -->ok<!-- END_AGENT_REVIEW_RESULT -->");

    context.runReview(["sync-agent", "--project-root", context.projectRoot, "--skill", "ln-310", "--agent", "codex"]);
    context.runReview(["advance", "--project-root", context.projectRoot, "--skill", "ln-310", "--to", REVIEW_PHASES.MERGE]);
    context.runReview(["checkpoint", "--project-root", context.projectRoot, "--skill", "ln-310", "--phase", REVIEW_PHASES.MERGE, "--payload", "{\"merge_summary\":{\"accepted\":2,\"rejected\":1}}"]);
    context.runReview(["advance", "--project-root", context.projectRoot, "--skill", "ln-310", "--to", REVIEW_PHASES.REFINEMENT]);
    context.runReview(["checkpoint", "--project-root", context.projectRoot, "--skill", "ln-310", "--phase", REVIEW_PHASES.REFINEMENT, "--payload", "{\"iterations\":1,\"exit_reason\":\"CONVERGED\",\"applied\":3}"]);
    context.runReview(["advance", "--project-root", context.projectRoot, "--skill", "ln-310", "--to", REVIEW_PHASES.APPROVE]);
    context.runReview(["checkpoint", "--project-root", context.projectRoot, "--skill", "ln-310", "--phase", REVIEW_PHASES.APPROVE, "--payload", JSON.stringify({ verdict })]);
    context.runReview(["advance", "--project-root", context.projectRoot, "--skill", "ln-310", "--to", REVIEW_PHASES.SELF_CHECK]);
    context.runReview([
        "record-stage-summary",
        "--project-root", context.projectRoot,
        "--skill", "ln-310",
        "--payload", JSON.stringify(buildPipelineStageArtifact({
            stage: 1,
            runId: started.run_id,
            storyId: context.storyId,
            producerSkill: "ln-310",
            finalResult: verdict,
            storyStatus,
            extra: {
                verdict,
                readiness_score: readinessScore,
            },
        })),
    ]);
    context.runReview(["checkpoint", "--project-root", context.projectRoot, "--skill", "ln-310", "--phase", REVIEW_PHASES.SELF_CHECK, "--payload", JSON.stringify({ pass: true, processes_verified_dead: true, final_verdict: verdict })]);
    const status = context.runReview(["status", "--project-root", context.projectRoot, "--skill", "ln-310", "--identifier", context.storyId]);
    const artifact = readRuntimeArtifact(context.projectRoot, status.state.stage_summary.payload.artifact_path);
    const completed = context.runReview(["complete", "--project-root", context.projectRoot, "--skill", "ln-310", "--identifier", context.storyId]);
    assert(completed.ok && completed.state.phase === REVIEW_PHASES.DONE, "Stage 1 runtime did not complete");

    return {
        artifact,
        checkpoint: {
            stage: 1,
            verdict,
            readinessScore,
            lastAction: `stage-1-${label}-${verdict}`,
        },
    };
}

function runStage2(context, {
    label,
    finalResult = STORY_EXECUTION_FINAL_RESULTS.READY_FOR_GATE,
    storyStatus = TASK_BOARD_STATUSES.TO_REVIEW,
}) {
    const manifestPath = join(context.projectRoot, `execution-${label}.manifest.json`);
    writeJson(manifestPath, {
        task_provider: "file",
        worktree_dir: `.hex-skills/worktrees/story-${context.storyId}`,
        branch: `feature/${label}-${context.storyId.toLowerCase()}`,
    });

    const started = context.runExecution([
        "start",
        "--project-root", context.projectRoot,
        "--story", context.storyId,
        "--manifest-file", manifestPath,
    ]);
    assert(started.ok, "Failed to start Stage 2 runtime");

    const taskId = `TASK-${label.toUpperCase()}`;
    context.runExecution(["checkpoint", "--project-root", context.projectRoot, "--phase", EXECUTION_PHASES.CONFIG]);
    context.runExecution(["advance", "--project-root", context.projectRoot, "--to", EXECUTION_PHASES.DISCOVERY]);
    context.runExecution(["checkpoint", "--project-root", context.projectRoot, "--phase", EXECUTION_PHASES.DISCOVERY]);
    context.runExecution(["advance", "--project-root", context.projectRoot, "--to", EXECUTION_PHASES.WORKTREE_SETUP]);
    context.runExecution(["checkpoint", "--project-root", context.projectRoot, "--phase", EXECUTION_PHASES.WORKTREE_SETUP, "--payload", JSON.stringify({
        worktree_ready: true,
        worktree_dir: `.hex-skills/worktrees/story-${context.storyId}`,
        branch: `feature/${label}-${context.storyId.toLowerCase()}`,
    })]);
    context.runExecution(["advance", "--project-root", context.projectRoot, "--to", EXECUTION_PHASES.SELECT_WORK]);
    context.runExecution(["checkpoint", "--project-root", context.projectRoot, "--phase", EXECUTION_PHASES.SELECT_WORK, "--payload", JSON.stringify({
        current_task_id: taskId,
        processable_counts: { todo: 1, to_review: 0, to_rework: 0 },
    })]);
    context.runExecution(["advance", "--project-root", context.projectRoot, "--to", EXECUTION_PHASES.TASK_EXECUTION]);
    context.runExecution(["record-worker", "--project-root", context.projectRoot, "--task-id", taskId, "--payload", JSON.stringify(taskStatusWorkerSummary(started.run_id, taskId, "ln-401", TASK_BOARD_STATUSES.TODO, TASK_BOARD_STATUSES.TO_REVIEW, {
        result: "review_handoff",
        files_changed: [`src/${label}.ts`],
    }))]);
    context.runExecution(["record-worker", "--project-root", context.projectRoot, "--task-id", taskId, "--payload", JSON.stringify(taskStatusWorkerSummary(started.run_id, taskId, "ln-402", TASK_BOARD_STATUSES.TO_REVIEW, TASK_BOARD_STATUSES.DONE, {
        result: "accepted",
        score: 97,
    }))]);
    context.runExecution(["checkpoint", "--project-root", context.projectRoot, "--phase", EXECUTION_PHASES.TASK_EXECUTION]);
    context.runExecution(["advance", "--project-root", context.projectRoot, "--to", EXECUTION_PHASES.VERIFY_STATUSES]);
    context.runExecution(["checkpoint", "--project-root", context.projectRoot, "--phase", EXECUTION_PHASES.VERIFY_STATUSES, "--payload", "{\"processable_counts\":{\"todo\":0,\"to_review\":0,\"to_rework\":0},\"inflight_workers\":{}}"]);
    context.runExecution(["advance", "--project-root", context.projectRoot, "--to", EXECUTION_PHASES.SCENARIO_VALIDATION]);
    context.runExecution(["checkpoint", "--project-root", context.projectRoot, "--phase", EXECUTION_PHASES.SCENARIO_VALIDATION, "--payload", "{\"scenario_pass\":true,\"validation_mode\":\"self_check_only\"}"]);
    context.runExecution(["advance", "--project-root", context.projectRoot, "--to", EXECUTION_PHASES.STORY_TO_REVIEW]);
    context.runExecution(["checkpoint", "--project-root", context.projectRoot, "--phase", EXECUTION_PHASES.STORY_TO_REVIEW, "--payload", JSON.stringify({
        story_transition_done: true,
        story_final_status: storyStatus,
        final_result: finalResult,
    })]);
    context.runExecution(["advance", "--project-root", context.projectRoot, "--to", EXECUTION_PHASES.SELF_CHECK]);
    context.runExecution(["record-stage-summary", "--project-root", context.projectRoot, "--story", context.storyId, "--payload", JSON.stringify(buildPipelineStageArtifact({
        stage: 2,
        runId: started.run_id,
        storyId: context.storyId,
        producerSkill: "ln-400",
        finalResult,
        storyStatus,
    }))]);
    context.runExecution(["checkpoint", "--project-root", context.projectRoot, "--phase", EXECUTION_PHASES.SELF_CHECK, "--payload", JSON.stringify({ pass: true, final_result: finalResult })]);
    const status = context.runExecution(["status", "--project-root", context.projectRoot, "--story", context.storyId]);
    const artifact = readRuntimeArtifact(context.projectRoot, status.state.stage_summary.payload.artifact_path);
    const completed = context.runExecution(["complete", "--project-root", context.projectRoot]);
    assert(completed.ok && completed.state.phase === EXECUTION_PHASES.DONE, "Stage 2 runtime did not complete");

    return {
        artifact,
        checkpoint: {
            stage: 2,
            tasksCompleted: [],
            gitStats: {},
            lastAction: `stage-2-${label}`,
        },
    };
}

function runStage3(context, {
    label,
    verdict,
    qualityScore,
    storyStatus = verdict === STORY_GATE_VERDICTS.FAIL ? TASK_BOARD_STATUSES.TO_REWORK : TASK_BOARD_STATUSES.DONE,
}) {
    const manifestPath = join(context.projectRoot, `gate-${label}.manifest.json`);
    writeJson(manifestPath, {
        task_provider: "file",
        worktree_dir: `.hex-skills/worktrees/story-${context.storyId}`,
        branch: `feature/${label}-${context.storyId.toLowerCase()}`,
    });

    const started = context.runGate([
        "start",
        "--project-root", context.projectRoot,
        "--story", context.storyId,
        "--manifest-file", manifestPath,
    ]);
    assert(started.ok, "Failed to start Stage 3 runtime");

    context.runGate(["checkpoint", "--project-root", context.projectRoot, "--phase", GATE_PHASES.CONFIG]);
    context.runGate(["advance", "--project-root", context.projectRoot, "--to", GATE_PHASES.DISCOVERY]);
    context.runGate(["checkpoint", "--project-root", context.projectRoot, "--phase", GATE_PHASES.DISCOVERY]);
    context.runGate(["advance", "--project-root", context.projectRoot, "--to", GATE_PHASES.FAST_TRACK]);
    context.runGate(["checkpoint", "--project-root", context.projectRoot, "--phase", GATE_PHASES.FAST_TRACK, "--payload", "{\"fast_track\":false}"]);
    context.runGate(["advance", "--project-root", context.projectRoot, "--to", GATE_PHASES.QUALITY_CHECKS]);
    context.runGate(["record-quality", "--project-root", context.projectRoot, "--payload", JSON.stringify({
        story_id: context.storyId,
        verdict,
        quality_score: qualityScore,
    })]);
    context.runGate(["checkpoint", "--project-root", context.projectRoot, "--phase", GATE_PHASES.QUALITY_CHECKS, "--payload", JSON.stringify({
        child_run: {
            worker: "ln-510",
            run_id: `${started.run_id}--ln-510--${context.storyId}`,
            summary_artifact_path: `.hex-skills/runtime-artifacts/runs/${started.run_id}/story-quality/${context.storyId}.json`,
            phase_context: "quality_checks",
        },
        quality_summary: { story_id: context.storyId, verdict },
        quality_score: qualityScore,
    })]);

    if (verdict === STORY_GATE_VERDICTS.FAIL) {
        context.runGate(["advance", "--project-root", context.projectRoot, "--to", GATE_PHASES.VERDICT]);
        context.runGate(["checkpoint", "--project-root", context.projectRoot, "--phase", GATE_PHASES.VERDICT, "--payload", JSON.stringify({
            final_result: verdict,
            quality_score: qualityScore,
            nfr_validation: {},
            fix_tasks_created: ["FIX-1"],
        })]);
        context.runGate(["advance", "--project-root", context.projectRoot, "--to", GATE_PHASES.FINALIZATION]);
        context.runGate(["checkpoint", "--project-root", context.projectRoot, "--phase", GATE_PHASES.FINALIZATION, "--payload", JSON.stringify({
            status: STORY_GATE_FINALIZATION_STATUSES.SKIPPED_BY_VERDICT,
            story_final_status: storyStatus,
        })]);
    } else {
        context.runGate(["advance", "--project-root", context.projectRoot, "--to", GATE_PHASES.TEST_PLANNING]);
        context.runGate(["record-test-status", "--project-root", context.projectRoot, "--payload", JSON.stringify({
            story_id: context.storyId,
            planner_invoked: true,
            status: TASK_BOARD_STATUSES.SKIPPED,
        })]);
        context.runGate(["checkpoint", "--project-root", context.projectRoot, "--phase", GATE_PHASES.TEST_PLANNING, "--payload", JSON.stringify({
            child_run: {
                worker: "ln-520",
                run_id: `${started.run_id}--ln-520--${context.storyId}`,
                summary_artifact_path: `.hex-skills/runtime-artifacts/runs/${started.run_id}/story-tests/${context.storyId}.json`,
                phase_context: "test_planning",
            },
            test_planner_invoked: true,
            test_task_status: TASK_BOARD_STATUSES.SKIPPED,
        })]);
        context.runGate(["advance", "--project-root", context.projectRoot, "--to", GATE_PHASES.TEST_VERIFICATION]);
        context.runGate(["checkpoint", "--project-root", context.projectRoot, "--phase", GATE_PHASES.TEST_VERIFICATION, "--payload", JSON.stringify({
            test_task_status: TASK_BOARD_STATUSES.SKIPPED,
        })]);
        context.runGate(["advance", "--project-root", context.projectRoot, "--to", GATE_PHASES.VERDICT]);
        context.runGate(["checkpoint", "--project-root", context.projectRoot, "--phase", GATE_PHASES.VERDICT, "--payload", JSON.stringify({
            final_result: verdict,
            quality_score: qualityScore,
            nfr_validation: { security: STORY_GATE_VERDICTS.PASS },
        })]);
        context.runGate(["advance", "--project-root", context.projectRoot, "--to", GATE_PHASES.FINALIZATION]);
        context.runGate(["checkpoint", "--project-root", context.projectRoot, "--phase", GATE_PHASES.FINALIZATION, "--payload", JSON.stringify({
            branch_finalized: true,
            story_final_status: storyStatus,
        })]);
    }

    context.runGate(["record-stage-summary", "--project-root", context.projectRoot, "--payload", JSON.stringify(buildPipelineStageArtifact({
        stage: 3,
        runId: started.run_id,
        storyId: context.storyId,
        producerSkill: "ln-500",
        finalResult: verdict,
        storyStatus,
        extra: {
            verdict,
            quality_score: qualityScore,
        },
    }))]);
    context.runGate(["advance", "--project-root", context.projectRoot, "--to", GATE_PHASES.SELF_CHECK]);
    context.runGate(["checkpoint", "--project-root", context.projectRoot, "--phase", GATE_PHASES.SELF_CHECK, "--payload", JSON.stringify({
        pass: true,
        final_result: verdict,
    })]);
    const status = context.runGate(["status", "--project-root", context.projectRoot, "--story", context.storyId]);
    const artifact = readRuntimeArtifact(context.projectRoot, status.state.stage_summary.payload.artifact_path);
    const completed = context.runGate(["complete", "--project-root", context.projectRoot]);
    assert(completed.ok && completed.state.phase === GATE_PHASES.DONE, "Stage 3 runtime did not complete");

    return {
        artifact,
        checkpoint: {
            stage: 3,
            verdict,
            qualityScore,
            lastAction: `stage-3-${label}-${verdict}`,
        },
    };
}

function pauseStage3(context, { label }) {
    const manifestPath = join(context.projectRoot, `gate-${label}.manifest.json`);
    writeJson(manifestPath, {
        task_provider: "file",
        worktree_dir: `.hex-skills/worktrees/story-${context.storyId}`,
        branch: `feature/${label}-${context.storyId.toLowerCase()}`,
    });

    const started = context.runGate([
        "start",
        "--project-root", context.projectRoot,
        "--story", context.storyId,
        "--manifest-file", manifestPath,
    ]);
    assert(started.ok, "Failed to start paused Stage 3 runtime");

    context.runGate(["checkpoint", "--project-root", context.projectRoot, "--phase", GATE_PHASES.CONFIG]);
    context.runGate(["advance", "--project-root", context.projectRoot, "--to", GATE_PHASES.DISCOVERY]);
    context.runGate(["checkpoint", "--project-root", context.projectRoot, "--phase", GATE_PHASES.DISCOVERY]);
    context.runGate(["advance", "--project-root", context.projectRoot, "--to", GATE_PHASES.FAST_TRACK]);
    context.runGate(["checkpoint", "--project-root", context.projectRoot, "--phase", GATE_PHASES.FAST_TRACK, "--payload", "{\"fast_track\":false}"]);
    context.runGate(["advance", "--project-root", context.projectRoot, "--to", GATE_PHASES.QUALITY_CHECKS]);
    context.runGate(["record-quality", "--project-root", context.projectRoot, "--payload", JSON.stringify({
        story_id: context.storyId,
        verdict: STORY_GATE_VERDICTS.PASS,
        quality_score: 88,
    })]);
    context.runGate(["checkpoint", "--project-root", context.projectRoot, "--phase", GATE_PHASES.QUALITY_CHECKS, "--payload", JSON.stringify({
        child_run: {
            worker: "ln-510",
            run_id: `${started.run_id}--ln-510--${context.storyId}`,
            summary_artifact_path: `.hex-skills/runtime-artifacts/runs/${started.run_id}/story-quality/${context.storyId}.json`,
            phase_context: "quality_checks",
        },
        quality_summary: { story_id: context.storyId, verdict: STORY_GATE_VERDICTS.PASS },
        quality_score: 88,
    })]);
    context.runGate(["advance", "--project-root", context.projectRoot, "--to", GATE_PHASES.TEST_PLANNING]);
    context.runGate(["record-test-status", "--project-root", context.projectRoot, "--payload", JSON.stringify({
        story_id: context.storyId,
        planner_invoked: true,
        status: TASK_BOARD_STATUSES.IN_PROGRESS,
    })]);
    context.runGate(["checkpoint", "--project-root", context.projectRoot, "--phase", GATE_PHASES.TEST_PLANNING, "--payload", JSON.stringify({
        child_run: {
            worker: "ln-520",
            run_id: `${started.run_id}--ln-520--${context.storyId}`,
            summary_artifact_path: `.hex-skills/runtime-artifacts/runs/${started.run_id}/story-tests/${context.storyId}.json`,
            phase_context: "test_planning",
        },
        test_planner_invoked: true,
        test_task_status: TASK_BOARD_STATUSES.IN_PROGRESS,
    })]);
    context.runGate(["advance", "--project-root", context.projectRoot, "--to", GATE_PHASES.TEST_VERIFICATION]);
    const paused = context.runGate(["pause", "--project-root", context.projectRoot, "--run-id", started.run_id, "--reason", "Waiting for test task completion"]);
    assert(paused.ok, "Stage 3 runtime did not pause");
    return { runId: started.run_id };
}

function resumePausedStage3(context, runId, {
    label,
    verdict,
    qualityScore,
    storyStatus = TASK_BOARD_STATUSES.DONE,
}) {
    context.runGate(["advance", "--project-root", context.projectRoot, "--run-id", runId, "--to", GATE_PHASES.TEST_VERIFICATION, "--resolve"]);
    context.runGate(["checkpoint", "--project-root", context.projectRoot, "--run-id", runId, "--phase", GATE_PHASES.TEST_VERIFICATION, "--payload", JSON.stringify({
        test_task_status: TASK_BOARD_STATUSES.DONE,
    })]);
    context.runGate(["advance", "--project-root", context.projectRoot, "--run-id", runId, "--to", GATE_PHASES.VERDICT]);
    context.runGate(["checkpoint", "--project-root", context.projectRoot, "--run-id", runId, "--phase", GATE_PHASES.VERDICT, "--payload", JSON.stringify({
        final_result: verdict,
        quality_score: qualityScore,
        nfr_validation: { security: STORY_GATE_VERDICTS.PASS },
    })]);
    context.runGate(["advance", "--project-root", context.projectRoot, "--run-id", runId, "--to", GATE_PHASES.FINALIZATION]);
    context.runGate(["checkpoint", "--project-root", context.projectRoot, "--run-id", runId, "--phase", GATE_PHASES.FINALIZATION, "--payload", JSON.stringify({
        branch_finalized: true,
        story_final_status: storyStatus,
    })]);
    context.runGate(["record-stage-summary", "--project-root", context.projectRoot, "--run-id", runId, "--payload", JSON.stringify(buildPipelineStageArtifact({
        stage: 3,
        runId,
        storyId: context.storyId,
        producerSkill: "ln-500",
        finalResult: verdict,
        storyStatus,
        extra: {
            verdict,
            quality_score: qualityScore,
            metadata: { resumed_from_pause: true, label },
        },
    }))]);
    context.runGate(["advance", "--project-root", context.projectRoot, "--run-id", runId, "--to", GATE_PHASES.SELF_CHECK]);
    context.runGate(["checkpoint", "--project-root", context.projectRoot, "--run-id", runId, "--phase", GATE_PHASES.SELF_CHECK, "--payload", JSON.stringify({
        pass: true,
        final_result: verdict,
    })]);
    const status = context.runGate(["status", "--project-root", context.projectRoot, "--run-id", runId]);
    const artifact = readRuntimeArtifact(context.projectRoot, status.state.stage_summary.payload.artifact_path);
    const completed = context.runGate(["complete", "--project-root", context.projectRoot, "--run-id", runId]);
    assert(completed.ok && completed.state.phase === GATE_PHASES.DONE, "Resumed Stage 3 runtime did not complete");

    return {
        artifact,
        checkpoint: {
            stage: 3,
            verdict,
            qualityScore,
            lastAction: `stage-3-${label}-resume-${verdict}`,
        },
    };
}

export function runHappyPathScenario(context) {
    startPipeline(context);
    advancePipeline(context, PIPELINE_PHASES.STAGE_0);

    const stage0 = runStage0(context, { label: "happy" });
    checkpointPipelineStage(context, stage0.checkpoint);
    const blocked = advancePipeline(context, PIPELINE_PHASES.STAGE_1, { allowFailure: true });
    assertIncludes(blocked.error, "Stage 0 coordinator summary missing", "Stage 0 artifact must gate STAGE_1");
    recordPipelineStageArtifact(context, stage0.artifact);

    advancePipeline(context, PIPELINE_PHASES.STAGE_1);
    const stage1 = runStage1(context, { label: "happy", verdict: "GO", readinessScore: 8, storyStatus: TASK_BOARD_STATUSES.TODO });
    checkpointPipelineStage(context, stage1.checkpoint);
    recordPipelineStageArtifact(context, stage1.artifact);

    advancePipeline(context, PIPELINE_PHASES.STAGE_2);
    const stage2 = runStage2(context, { label: "happy" });
    checkpointPipelineStage(context, stage2.checkpoint);
    recordPipelineStageArtifact(context, stage2.artifact);

    advancePipeline(context, PIPELINE_PHASES.STAGE_3);
    const stage3 = runStage3(context, { label: "happy", verdict: STORY_GATE_VERDICTS.PASS, qualityScore: 90 });
    checkpointPipelineStage(context, stage3.checkpoint);
    recordPipelineStageArtifact(context, stage3.artifact);

    const completed = completePipeline(context);
    assert(completed.ok && completed.state.phase === PIPELINE_PHASES.DONE, "Happy path pipeline did not complete");
    return completed;
}

export function runValidationRetryThenGoScenario(context) {
    startPipeline(context);
    advancePipeline(context, PIPELINE_PHASES.STAGE_0);
    const stage0 = runStage0(context, { label: "retry-go" });
    checkpointPipelineStage(context, stage0.checkpoint);
    recordPipelineStageArtifact(context, stage0.artifact);

    advancePipeline(context, PIPELINE_PHASES.STAGE_1);
    const firstValidation = runStage1(context, { label: "retry-go-1", verdict: "NO-GO", readinessScore: 4, storyStatus: "Backlog" });
    checkpointPipelineStage(context, firstValidation.checkpoint);
    recordPipelineStageArtifact(context, firstValidation.artifact);

    const retryAdvance = advancePipeline(context, PIPELINE_PHASES.STAGE_1);
    assert(retryAdvance.counter_incremented === "validation_retries", "Validation retry counter did not increment");

    const secondValidation = runStage1(context, { label: "retry-go-2", verdict: "GO", readinessScore: 8, storyStatus: TASK_BOARD_STATUSES.TODO });
    checkpointPipelineStage(context, secondValidation.checkpoint);
    recordPipelineStageArtifact(context, secondValidation.artifact);

    advancePipeline(context, PIPELINE_PHASES.STAGE_2);
    const stage2 = runStage2(context, { label: "retry-go" });
    checkpointPipelineStage(context, stage2.checkpoint);
    recordPipelineStageArtifact(context, stage2.artifact);

    advancePipeline(context, PIPELINE_PHASES.STAGE_3);
    const stage3 = runStage3(context, { label: "retry-go", verdict: STORY_GATE_VERDICTS.PASS, qualityScore: 91 });
    checkpointPipelineStage(context, stage3.checkpoint);
    recordPipelineStageArtifact(context, stage3.artifact);

    const completed = completePipeline(context);
    assert(completed.ok && completed.state.phase === PIPELINE_PHASES.DONE, "Validation retry-then-go pipeline did not complete");
    assert(completed.state.validation_retries === 1, "validation_retries must equal 1 after retry-then-go");
    return completed;
}

export function runValidationRetryExhaustedScenario(context) {
    startPipeline(context);
    advancePipeline(context, PIPELINE_PHASES.STAGE_0);
    const stage0 = runStage0(context, { label: "retry-exhausted" });
    checkpointPipelineStage(context, stage0.checkpoint);
    recordPipelineStageArtifact(context, stage0.artifact);

    advancePipeline(context, PIPELINE_PHASES.STAGE_1);
    const firstValidation = runStage1(context, { label: "retry-exhausted-1", verdict: "NO-GO", readinessScore: 4, storyStatus: "Backlog" });
    checkpointPipelineStage(context, firstValidation.checkpoint);
    recordPipelineStageArtifact(context, firstValidation.artifact);

    const firstRetry = advancePipeline(context, PIPELINE_PHASES.STAGE_1);
    assert(firstRetry.counter_incremented === "validation_retries", "First validation retry should increment validation_retries");

    const secondValidation = runStage1(context, { label: "retry-exhausted-2", verdict: "NO-GO", readinessScore: 3, storyStatus: "Backlog" });
    checkpointPipelineStage(context, secondValidation.checkpoint);
    recordPipelineStageArtifact(context, secondValidation.artifact);

    const blockedRetry = advancePipeline(context, PIPELINE_PHASES.STAGE_1, { allowFailure: true });
    assertIncludes(blockedRetry.error, "Validation retry exhausted", "Second validation retry should be rejected");

    const status = pipelineStatus(context);
    assert(status.state.validation_retries === 1, "validation_retries must remain 1 after retry exhaustion");
    assert(status.state.phase === PIPELINE_PHASES.STAGE_1, "Pipeline should remain at STAGE_1 after retry exhaustion");
    return blockedRetry;
}

export function runQualityFailReentryThenPassScenario(context) {
    startPipeline(context);
    advancePipeline(context, PIPELINE_PHASES.STAGE_0);
    const stage0 = runStage0(context, { label: "quality-reentry" });
    checkpointPipelineStage(context, stage0.checkpoint);
    recordPipelineStageArtifact(context, stage0.artifact);

    advancePipeline(context, PIPELINE_PHASES.STAGE_1);
    const stage1 = runStage1(context, { label: "quality-reentry", verdict: "GO", readinessScore: 8, storyStatus: TASK_BOARD_STATUSES.TODO });
    checkpointPipelineStage(context, stage1.checkpoint);
    recordPipelineStageArtifact(context, stage1.artifact);

    advancePipeline(context, PIPELINE_PHASES.STAGE_2);
    const stage2First = runStage2(context, { label: "quality-reentry-1" });
    checkpointPipelineStage(context, stage2First.checkpoint);
    recordPipelineStageArtifact(context, stage2First.artifact);

    advancePipeline(context, PIPELINE_PHASES.STAGE_3);
    const failStage3 = runStage3(context, { label: "quality-reentry-fail", verdict: STORY_GATE_VERDICTS.FAIL, qualityScore: 45, storyStatus: TASK_BOARD_STATUSES.TO_REWORK });
    checkpointPipelineStage(context, failStage3.checkpoint);
    recordPipelineStageArtifact(context, failStage3.artifact);

    const reentry = advancePipeline(context, PIPELINE_PHASES.STAGE_2);
    assert(reentry.counter_incremented === "quality_cycles", "Quality re-entry should increment quality_cycles");

    const stage2Second = runStage2(context, { label: "quality-reentry-2" });
    checkpointPipelineStage(context, stage2Second.checkpoint);
    recordPipelineStageArtifact(context, stage2Second.artifact);

    advancePipeline(context, PIPELINE_PHASES.STAGE_3);
    const passStage3 = runStage3(context, { label: "quality-reentry-pass", verdict: STORY_GATE_VERDICTS.PASS, qualityScore: 93 });
    checkpointPipelineStage(context, passStage3.checkpoint);
    recordPipelineStageArtifact(context, passStage3.artifact);

    const completed = completePipeline(context);
    assert(completed.ok && completed.state.phase === PIPELINE_PHASES.DONE, "Quality fail re-entry scenario did not complete");
    assert(completed.state.quality_cycles === 1, "quality_cycles must equal 1 after fail-then-pass");
    return completed;
}

export function runQualityFailLimitExhaustedScenario(context) {
    startPipeline(context);
    advancePipeline(context, PIPELINE_PHASES.STAGE_0);
    const stage0 = runStage0(context, { label: "quality-limit" });
    checkpointPipelineStage(context, stage0.checkpoint);
    recordPipelineStageArtifact(context, stage0.artifact);

    advancePipeline(context, PIPELINE_PHASES.STAGE_1);
    const stage1 = runStage1(context, { label: "quality-limit", verdict: "GO", readinessScore: 8, storyStatus: TASK_BOARD_STATUSES.TODO });
    checkpointPipelineStage(context, stage1.checkpoint);
    recordPipelineStageArtifact(context, stage1.artifact);

    advancePipeline(context, PIPELINE_PHASES.STAGE_2);
    const stage2First = runStage2(context, { label: "quality-limit-1" });
    checkpointPipelineStage(context, stage2First.checkpoint);
    recordPipelineStageArtifact(context, stage2First.artifact);

    for (let cycle = 1; cycle <= 2; cycle += 1) {
        advancePipeline(context, PIPELINE_PHASES.STAGE_3);
        const failStage3 = runStage3(context, {
            label: `quality-limit-fail-${cycle}`,
            verdict: STORY_GATE_VERDICTS.FAIL,
            qualityScore: 40 + cycle,
            storyStatus: TASK_BOARD_STATUSES.TO_REWORK,
        });
        checkpointPipelineStage(context, failStage3.checkpoint);
        recordPipelineStageArtifact(context, failStage3.artifact);

        const reentry = advancePipeline(context, PIPELINE_PHASES.STAGE_2);
        assert(reentry.counter_incremented === "quality_cycles", `Quality cycle ${cycle} should increment quality_cycles`);

        const rerunStage2 = runStage2(context, { label: `quality-limit-stage2-${cycle + 1}` });
        checkpointPipelineStage(context, rerunStage2.checkpoint);
        recordPipelineStageArtifact(context, rerunStage2.artifact);
    }

    advancePipeline(context, PIPELINE_PHASES.STAGE_3);
    const terminalFail = runStage3(context, {
        label: "quality-limit-fail-3",
        verdict: STORY_GATE_VERDICTS.FAIL,
        qualityScore: 43,
        storyStatus: TASK_BOARD_STATUSES.TO_REWORK,
    });
    checkpointPipelineStage(context, terminalFail.checkpoint);
    recordPipelineStageArtifact(context, terminalFail.artifact);

    const blocked = advancePipeline(context, PIPELINE_PHASES.STAGE_2, { allowFailure: true });
    assertIncludes(blocked.error, "Quality cycle limit reached", "Third quality re-entry should be rejected");

    const status = pipelineStatus(context);
    assert(status.state.quality_cycles === 2, "quality_cycles must stop at 2 when limit is reached");
    assert(status.state.phase === PIPELINE_PHASES.STAGE_3, "Pipeline should remain at STAGE_3 when quality cycle limit is reached");
    return blocked;
}

export function runStage3PauseResumeScenario(context) {
    startPipeline(context);
    advancePipeline(context, PIPELINE_PHASES.STAGE_0);
    const stage0 = runStage0(context, { label: "pause-resume" });
    checkpointPipelineStage(context, stage0.checkpoint);
    recordPipelineStageArtifact(context, stage0.artifact);

    advancePipeline(context, PIPELINE_PHASES.STAGE_1);
    const stage1 = runStage1(context, { label: "pause-resume", verdict: "GO", readinessScore: 8, storyStatus: TASK_BOARD_STATUSES.TODO });
    checkpointPipelineStage(context, stage1.checkpoint);
    recordPipelineStageArtifact(context, stage1.artifact);

    advancePipeline(context, PIPELINE_PHASES.STAGE_2);
    const stage2 = runStage2(context, { label: "pause-resume" });
    checkpointPipelineStage(context, stage2.checkpoint);
    recordPipelineStageArtifact(context, stage2.artifact);

    advancePipeline(context, PIPELINE_PHASES.STAGE_3);
    const pausedGate = pauseStage3(context, { label: "pause-resume" });
    const gateStatus = context.runGate(["status", "--project-root", context.projectRoot, "--run-id", pausedGate.runId]);
    assert(gateStatus.state.phase === GATE_PHASES.PAUSED, "Stage 3 runtime must be paused before resume");

    const blockedComplete = completePipeline(context, { allowFailure: true });
    assertIncludes(blockedComplete.error, "Stage 3 checkpoint missing", "Pipeline must not complete without Stage 3 artifact");

    const resumedStage3 = resumePausedStage3(context, pausedGate.runId, {
        label: "pause-resume",
        verdict: STORY_GATE_VERDICTS.PASS,
        qualityScore: 92,
    });
    checkpointPipelineStage(context, resumedStage3.checkpoint);
    recordPipelineStageArtifact(context, resumedStage3.artifact);

    const completed = completePipeline(context);
    assert(completed.ok && completed.state.phase === PIPELINE_PHASES.DONE, "Stage 3 pause/resume pipeline did not complete");
    return completed;
}
