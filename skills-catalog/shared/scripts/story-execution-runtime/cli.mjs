#!/usr/bin/env node

import { parseArgs } from "node:util";
import {
    checkpointPhase,
    completeRun,
    listActiveRuns,
    loadActiveRun,
    loadRun,
    pauseRun,
    readJsonFile,
    recordGroup,
    recordStageSummary,
    recordWorker,
    resolveRunId,
    runtimePaths,
    saveState,
    startRun,
} from "./lib/store.mjs";
import {
    failJson as fail,
    failResult,
    outputJson as output,
    outputGuardFailure,
    outputInactiveRuntime,
    outputRuntimeState,
    outputRuntimeStatus,
    readManifestOrFail,
    readPayload,
} from "../coordinator-runtime/lib/cli-helpers.mjs";
import {
    computeResumeAction,
    validateTransition,
} from "./lib/guards.mjs";
import { PHASES } from "./lib/phases.mjs";

const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
        "project-root": { type: "string", default: process.cwd() },
        "run-id": { type: "string" },
        story: { type: "string" },
        phase: { type: "string" },
        to: { type: "string" },
        payload: { type: "string" },
        "payload-file": { type: "string" },
        "manifest-file": { type: "string" },
        reason: { type: "string" },
        resolve: { type: "boolean", default: false },
        "task-id": { type: "string" },
        worker: { type: "string" },
        result: { type: "string" },
        "from-status": { type: "string" },
        "to-status": { type: "string" },
        "group-id": { type: "string" },
    },
});

function resolveRun(projectRoot) {
    const runId = resolveRunId(projectRoot, "ln-400", values["run-id"], values.story);
    if (!runId) {
        const activeRuns = listActiveRuns(projectRoot, "ln-400");
        if (activeRuns.length > 1 && !values.story) {
            fail("Multiple active ln-400 runs found. Pass --story or --run-id.");
        }
        fail("No active ln-400 run found. Pass --story or --run-id.");
    }
    const run = loadRun(projectRoot, runId);
    if (!run) {
        fail(`Run not found: ${runId}`);
    }
    return { runId, run };
}

function applyCheckpointToState(state, phase, payload) {
    const nextState = { ...state };

    if (phase === PHASES.WORKTREE_SETUP) {
        nextState.worktree_ready = payload.worktree_ready === true;
        nextState.worktree_dir = payload.worktree_dir || nextState.worktree_dir || null;
        nextState.branch = payload.branch || nextState.branch || null;
    }

    if (phase === PHASES.SELECT_WORK) {
        nextState.current_task_id = payload.current_task_id || null;
        nextState.current_group_id = payload.current_group_id || null;
        if (payload.processable_counts) {
            nextState.processable_counts = payload.processable_counts;
        }
    }

    if (phase === PHASES.VERIFY_STATUSES) {
        nextState.current_task_id = null;
        nextState.current_group_id = null;
        nextState.inflight_workers = payload.inflight_workers || {};
        if (payload.processable_counts) {
            nextState.processable_counts = payload.processable_counts;
        }
    }

    if (phase === PHASES.SCENARIO_VALIDATION) {
        nextState.scenario_pass = payload.scenario_pass === true;
        nextState.validation_mode = payload.validation_mode || null;
        nextState.rework_tasks = payload.rework_tasks || [];
    }

    if (phase === PHASES.STORY_TO_REVIEW) {
        nextState.story_transition_done = payload.story_transition_done === true;
        nextState.final_result = payload.final_result || nextState.final_result;
    }

    if (phase === PHASES.SELF_CHECK) {
        nextState.self_check_passed = payload.pass === true;
        nextState.final_result = payload.final_result || nextState.final_result;
    }

    return nextState;
}

async function main() {
    const command = positionals[0];
    const projectRoot = values["project-root"];

    if (command === "start") {
        if (!values.story || !values["manifest-file"]) {
            fail("start requires --story and --manifest-file");
        }
        const manifest = readManifestOrFail(values, readJsonFile);
        const result = startRun(projectRoot, {
            ...manifest,
            story_id: values.story,
            identifier: values.story,
        });
        output(result);
        process.exit(result.ok ? 0 : 1);
    }

    if (command === "status") {
        if (!values["run-id"] && !values.story) {
            const activeRuns = listActiveRuns(projectRoot, "ln-400");
            if (activeRuns.length > 1) {
                output({ ok: false, error: "Multiple active ln-400 runs found. Pass --story or --run-id." });
                process.exit(1);
            }
        }
        const run = values["run-id"]
            ? loadRun(projectRoot, values["run-id"])
            : loadActiveRun(projectRoot, "ln-400", values.story);
        if (!run) {
            outputInactiveRuntime(output);
            return;
        }
        outputRuntimeStatus(output, projectRoot, run, runtimePaths, computeResumeAction);
        return;
    }

    if (command === "advance") {
        if (!values.to) {
            fail("advance requires --to");
        }
        const { runId, run } = resolveRun(projectRoot);
        if (run.state.phase === PHASES.PAUSED && values.resolve) {
            const resumed = saveState(projectRoot, runId, {
                ...run.state,
                phase: values.to,
                paused_reason: null,
            });
            if (resumed?.ok === false) {
                outputGuardFailure(output, resumed);
            }
            outputRuntimeState(output, run, resumed, { resumed_from: "PAUSED" });
            return;
        }
        const guard = validateTransition(run.manifest, run.state, run.checkpoints, values.to);
        if (!guard.ok) {
            outputGuardFailure(output, guard);
        }
        const nextState = saveState(projectRoot, runId, {
            ...run.state,
            phase: values.to,
            complete: values.to === PHASES.DONE ? true : run.state.complete,
            paused_reason: null,
        });
        if (nextState?.ok === false) {
            outputGuardFailure(output, nextState);
        }
        outputRuntimeState(output, run, nextState);
        return;
    }

    if (command === "checkpoint") {
        if (!values.phase) {
            fail("checkpoint requires --phase");
        }
        const payload = readPayload(values, readJsonFile);
        const { runId, run } = resolveRun(projectRoot);
        const checkpointed = checkpointPhase(projectRoot, runId, values.phase, payload);
        if (!checkpointed.ok) {
            fail(checkpointed.error);
        }
        const nextState = saveState(projectRoot, runId, applyCheckpointToState(run.state, values.phase, payload));
        if (nextState?.ok === false) {
            failResult(nextState);
        }
        outputRuntimeState(output, run, nextState, {
            checkpoint: checkpointed.checkpoints[values.phase],
            history_length: checkpointed.checkpoints._history.length,
        });
        return;
    }

    if (command === "record-worker") {
        if (!values["task-id"]) {
            fail("record-worker requires --task-id");
        }
        const payload = readPayload(values, readJsonFile);
        const { runId } = resolveRun(projectRoot);
        const result = recordWorker(projectRoot, runId, values["task-id"], payload);
        if (!result.ok) {
            failResult(result);
        }
        output(result);
        return;
    }

    if (command === "record-group") {
        if (!values["group-id"]) {
            fail("record-group requires --group-id");
        }
        const payload = readPayload(values, readJsonFile);
        const { runId } = resolveRun(projectRoot);
        const result = recordGroup(projectRoot, runId, {
            ...payload,
            group_id: values["group-id"],
        });
        if (!result.ok) {
            failResult(result);
        }
        output(result);
        return;
    }

    if (command === "record-stage-summary") {
        const payload = readPayload(values, readJsonFile);
        const { runId } = resolveRun(projectRoot);
        const result = recordStageSummary(projectRoot, runId, payload);
        if (!result.ok) {
            failResult(result);
        }
        output(result);
        return;
    }

    if (command === "pause") {
        const { runId } = resolveRun(projectRoot);
        const result = pauseRun(projectRoot, runId, values.reason || "Paused");
        if (!result.ok) {
            failResult(result);
        }
        output(result);
        return;
    }

    if (command === "complete") {
        const { runId, run } = resolveRun(projectRoot);
        const guard = validateTransition(run.manifest, run.state, run.checkpoints, PHASES.DONE);
        if (!guard.ok) {
            outputGuardFailure(output, guard);
        }
        const result = completeRun(projectRoot, runId);
        if (!result.ok) {
            failResult(result);
        }
        output(result);
        return;
    }

    fail("Unknown command. Use: start, status, advance, checkpoint, record-worker, record-group, record-stage-summary, pause, complete");
}

main().catch(error => fail(error.message));
