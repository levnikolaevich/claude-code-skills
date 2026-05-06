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
    recordSummary,
    recordWorkerResult,
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
    const runId = resolveRunId(projectRoot, "ln-820", values["run-id"], values.identifier);
    if (!runId) {
        const activeRuns = listActiveRuns(projectRoot, "ln-820");
        if (activeRuns.length > 1 && !values.identifier) {
            fail("Multiple active ln-820 runs found. Pass --identifier or --run-id.");
        }
        fail("No active ln-820 run found. Pass --identifier or --run-id.");
    }
    const run = loadRun(projectRoot, runId);
    if (!run) {
        fail(`Run not found: ${runId}`);
    }
    return { runId, run };
}

function applyCheckpointToState(state, payload) {
    const nextState = { ...state };
    if (Array.isArray(payload.worker_plan)) {
        nextState.worker_plan = payload.worker_plan;
    }
    if (payload.child_run?.worker) {
        nextState.child_runs = {
            ...(nextState.child_runs || {}),
            [payload.child_run.worker]: payload.child_run,
        };
    }
    if (typeof payload.verification_passed === "boolean") {
        nextState.verification_passed = payload.verification_passed;
    }
    if (typeof payload.report_ready === "boolean") {
        nextState.report_ready = payload.report_ready;
    }
    if (payload.report_path) {
        nextState.report_path = payload.report_path;
    }
    if (payload.final_result) {
        nextState.final_result = payload.final_result;
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
        const result = startRun(projectRoot, {
            ...manifest,
            identifier: values.identifier,
        });
        output(result);
        process.exit(result.ok ? 0 : 1);
    }

    if (command === "status") {
        if (!values["run-id"] && !values.identifier) {
            const activeRuns = listActiveRuns(projectRoot, "ln-820");
            if (activeRuns.length > 1) {
                output({ ok: false, error: "Multiple active ln-820 runs found. Pass --identifier or --run-id." });
                process.exit(1);
            }
        }
        const run = values["run-id"]
            ? loadRun(projectRoot, values["run-id"])
            : loadActiveRun(projectRoot, "ln-820", values.identifier);
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
        const result = checkpointPhase(projectRoot, runId, values.phase, payload);
        if (!result.ok) {
            fail(result.error);
        }
        const nextState = saveState(projectRoot, runId, applyCheckpointToState(run.state, payload));
        if (nextState?.ok === false) {
            failResult(nextState);
        }
        outputRuntimeState(output, run, nextState, {
            checkpoint: result.checkpoints[values.phase],
        });
        return;
    }

    if (command === "record-worker-result") {
        const payload = readPayload(values, readJsonFile);
        const { runId } = resolveRun(projectRoot);
        const result = recordWorkerResult(projectRoot, runId, payload);
        if (!result.ok) {
            failResult(result);
        }
        output(result);
        return;
    }

    if (command === "record-summary") {
        const payload = readPayload(values, readJsonFile);
        const { runId } = resolveRun(projectRoot);
        const result = recordSummary(projectRoot, runId, payload);
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

    fail("Unknown command. Use: start, status, advance, checkpoint, record-worker-result, record-summary, pause, complete");
}

main().catch(error => fail(error.message));
