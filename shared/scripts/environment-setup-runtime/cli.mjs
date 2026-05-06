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
    recordDecision,
    recordWorker,
    resolveRunId,
    runtimePaths,
    saveState,
    setPendingDecision,
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
import { computeResumeAction, validateTransition } from "./lib/guards.mjs";
import { PHASES } from "./lib/phases.mjs";

const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
        "project-root": { type: "string", default: process.cwd() },
        "run-id": { type: "string" },
        identifier: { type: "string" },
        phase: { type: "string" },
        to: { type: "string" },
        payload: { type: "string" },
        "payload-file": { type: "string" },
        "manifest-file": { type: "string" },
        reason: { type: "string" },
    },
});

function resolveRun(projectRoot) {
    const runId = resolveRunId(projectRoot, "ln-010", values["run-id"], values.identifier);
    if (!runId) {
        const activeRuns = listActiveRuns(projectRoot, "ln-010");
        if (activeRuns.length > 1 && !values.identifier) {
            fail("Multiple active ln-010 runs found. Pass --identifier or --run-id.");
        }
        fail("No active ln-010 run found. Pass --identifier or --run-id.");
    }
    const run = loadRun(projectRoot, runId);
    if (!run) {
        fail(`Run not found: ${runId}`);
    }
    return { runId, run };
}

function applyCheckpointToState(state, phase, payload) {
    const nextState = { ...state };

    if (phase === PHASES.ASSESS) {
        nextState.assess_summary = payload.assess_summary || payload.summary || payload;
    }
    if (phase === PHASES.PROVIDER_SELECTION) {
        if (payload.provider_selection && typeof payload.provider_selection === "object") {
            nextState.provider_selection = payload.provider_selection;
        } else if (payload.chosen) {
            nextState.provider_selection = {
                chosen: payload.chosen,
                available: payload.available || [payload.chosen],
                reason: payload.reason || null,
                selected_by: payload.selected_by || "user",
            };
        }
    }
    if (phase === PHASES.DISPATCH_PLAN) {
        if (payload.dispatch_plan && typeof payload.dispatch_plan === "object") {
            nextState.dispatch_plan = payload.dispatch_plan;
        } else if (payload.plan && typeof payload.plan === "object") {
            nextState.dispatch_plan = payload.plan;
        }
    }
    if (phase === PHASES.VERIFY) {
        nextState.verification_summary = payload.verification_summary || payload.summary || payload;
    }
    if (phase === PHASES.WRITE_ENV_STATE) {
        nextState.env_state_written = payload.env_state_written === true;
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
        if (!values.identifier || !values["manifest-file"]) {
            fail("start requires --identifier and --manifest-file");
        }
        const manifest = readManifestOrFail(values, readJsonFile);
        const result = startRun(projectRoot, { ...manifest, identifier: values.identifier });
        output(result);
        process.exit(result.ok ? 0 : 1);
    }

    if (command === "status") {
        if (!values["run-id"] && !values.identifier) {
            const activeRuns = listActiveRuns(projectRoot, "ln-010");
            if (activeRuns.length > 1) {
                output({ ok: false, error: "Multiple active ln-010 runs found. Pass --identifier or --run-id." });
                process.exit(1);
            }
        }
        const run = values["run-id"]
            ? loadRun(projectRoot, values["run-id"])
            : loadActiveRun(projectRoot, "ln-010", values.identifier);
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
        const payload = readPayload(values, readJsonFile);
        const { runId } = resolveRun(projectRoot);
        const result = recordWorker(projectRoot, runId, payload);
        if (!result.ok) {
            failResult(result);
        }
        output(result);
        return;
    }

    if (command === "set-decision") {
        const payload = readPayload(values, readJsonFile);
        const { runId } = resolveRun(projectRoot);
        const result = recordDecision(projectRoot, runId, payload);
        if (!result.ok) {
            failResult(result);
        }
        output(result);
        return;
    }

    if (command === "pause") {
        const payload = readPayload(values, readJsonFile);
        const { runId } = resolveRun(projectRoot);
        const result = Object.keys(payload).length > 0
            ? setPendingDecision(projectRoot, runId, payload, values.reason || "Decision required")
            : pauseRun(projectRoot, runId, values.reason || "Paused");
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

    fail("Unknown command. Use: start, status, advance, checkpoint, record-worker, set-decision, pause, complete");
}

main().catch(error => fail(error.message));
