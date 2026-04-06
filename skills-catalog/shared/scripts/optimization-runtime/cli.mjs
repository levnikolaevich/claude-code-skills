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
    recordCycle,
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
import {
    computeResumeAction,
    validateTransition,
} from "./lib/guards.mjs";
import {
    OPTIMIZATION_CHECKPOINT_STATUSES,
    OPTIMIZATION_GATE_VERDICTS,
    OPTIMIZATION_VALIDATION_VERDICTS,
} from "../coordinator-runtime/lib/runtime-constants.mjs";
import { PHASES } from "./lib/phases.mjs";

const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
        "project-root": { type: "string", default: process.cwd() },
        "run-id": { type: "string" },
        slug: { type: "string" },
        phase: { type: "string" },
        to: { type: "string" },
        payload: { type: "string" },
        "payload-file": { type: "string" },
        "manifest-file": { type: "string" },
        reason: { type: "string" },
        resolve: { type: "boolean", default: false },
        worker: { type: "string" },
    },
});

function resolveRun(projectRoot) {
    const runId = resolveRunId(projectRoot, "ln-810", values["run-id"], values.slug);
    if (!runId) {
        const activeRuns = listActiveRuns(projectRoot, "ln-810");
        if (activeRuns.length > 1 && !values.slug) {
            fail("Multiple active ln-810 runs found. Pass --slug or --run-id.");
        }
        fail("No active ln-810 run found. Pass --slug or --run-id.");
    }
    const run = loadRun(projectRoot, runId);
    if (!run) {
        fail(`Run not found: ${runId}`);
    }
    return { runId, run };
}

function markPhase(state, phase, status, extra = {}) {
    return {
        ...state.phases,
        [phase]: {
            ...(state.phases?.[phase] || {}),
            status,
            ts: new Date().toISOString(),
            ...extra,
        },
    };
}

function childRunKey(childRun) {
    const identifier = childRun?.identifier || childRun?.phase_context || childRun?.run_id || "child";
    return `${childRun?.worker || "worker"}--${identifier}`;
}

function applyCheckpointToState(state, phase, payload) {
    const nextState = {
        ...state,
        phases: markPhase(state, phase, payload.phase_status || OPTIMIZATION_CHECKPOINT_STATUSES.COMPLETED),
    };

    if ([PHASES.PROFILE, PHASES.RESEARCH, PHASES.VALIDATE_PLAN, PHASES.EXECUTE].includes(phase)
        && payload.child_run && typeof payload.child_run === "object") {
        nextState.child_runs = {
            ...(nextState.child_runs || {}),
            [childRunKey(payload.child_run)]: payload.child_run,
        };
    }

    if (phase === PHASES.PARSE_INPUT) {
        nextState.target = payload.target || nextState.target;
        nextState.target_metric = payload.target_metric || nextState.target_metric;
    }

    if (phase === PHASES.WRONG_TOOL_GATE) {
        nextState.final_result = payload.gate_verdict === OPTIMIZATION_GATE_VERDICTS.BLOCK ? (payload.final_result || nextState.final_result) : nextState.final_result;
        nextState.stop_reason = payload.gate_verdict === OPTIMIZATION_GATE_VERDICTS.BLOCK ? (payload.stop_reason || nextState.stop_reason) : nextState.stop_reason;
    }

    if (phase === PHASES.SET_TARGET) {
        nextState.target_metric = payload.target_metric || nextState.target_metric;
    }

    if (phase === PHASES.WRITE_CONTEXT) {
        nextState.context_file = payload.context_file || nextState.context_file;
    }

    if (phase === PHASES.VALIDATE_PLAN && payload.validation_verdict === OPTIMIZATION_VALIDATION_VERDICTS.NO_GO) {
        nextState.paused_reason = payload.paused_reason || nextState.paused_reason;
    }

    if (phase === PHASES.CYCLE_BOUNDARY) {
        nextState.stop_reason = payload.stop_reason || nextState.stop_reason;
        nextState.final_result = payload.final_result || nextState.final_result;
        nextState.current_cycle = Number(payload.next_cycle || nextState.current_cycle);
    }

    if (phase === PHASES.REPORT) {
        nextState.final_result = payload.final_result || nextState.final_result;
        nextState.report_ready = payload.report_ready === true;
    }

    return nextState;
}

async function main() {
    const command = positionals[0];
    const projectRoot = values["project-root"];

    if (command === "start") {
        if (!values.slug || !values["manifest-file"]) {
            fail("start requires --slug and --manifest-file");
        }
        const manifest = readManifestOrFail(values, readJsonFile);
        const result = startRun(projectRoot, {
            ...manifest,
            slug: values.slug,
            identifier: values.slug,
        });
        output(result);
        process.exit(result.ok ? 0 : 1);
    }

    if (command === "status") {
        if (!values["run-id"] && !values.slug) {
            const activeRuns = listActiveRuns(projectRoot, "ln-810");
            if (activeRuns.length > 1) {
                output({ ok: false, error: "Multiple active ln-810 runs found. Pass --slug or --run-id." });
                process.exit(1);
            }
        }
        const run = values["run-id"]
            ? loadRun(projectRoot, values["run-id"])
            : loadActiveRun(projectRoot, "ln-810", values.slug);
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

    if (command === "record-cycle") {
        const payload = readPayload(values, readJsonFile);
        const { runId } = resolveRun(projectRoot);
        const result = recordCycle(projectRoot, runId, payload);
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

    fail("Unknown command. Use: start, status, advance, checkpoint, record-worker-result, record-summary, record-cycle, pause, complete");
}

main().catch(error => fail(error.message));
