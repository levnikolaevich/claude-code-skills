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
    recordSummary,
    recordWorkerResult,
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
import {
    computeResumeAction,
    validateTransition,
} from "./lib/guards.mjs";

const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
        skill: { type: "string" },
        identifier: { type: "string" },
        "run-id": { type: "string" },
        "project-root": { type: "string", default: process.cwd() },
        "manifest-file": { type: "string" },
        phase: { type: "string" },
        to: { type: "string" },
        payload: { type: "string" },
        "payload-file": { type: "string" },
        reason: { type: "string" },
    },
});

function resolveRun(projectRoot) {
    const runId = resolveRunId(projectRoot, values.skill, values["run-id"], values.identifier);
    if (!runId) {
        const activeRuns = values.skill ? listActiveRuns(projectRoot, values.skill) : [];
        if (activeRuns.length > 1 && !values.identifier) {
            fail("Multiple active runs found. Pass --identifier or --run-id.");
        }
        fail("No active run found. Pass --run-id, or --skill with --identifier.");
    }
    const run = loadRun(projectRoot, runId);
    if (!run) {
        fail(`Run not found: ${runId}`);
    }
    return { runId, run };
}

function applyCheckpointToState(run, phase, payload) {
    const nextState = {
        ...run.state,
        phase_data: {
            ...(run.state.phase_data || {}),
            [phase]: payload || {},
        },
    };
    const policy = run.manifest.phase_policy || {};

    if (Array.isArray(payload.worker_plan)) {
        nextState.worker_plan = payload.worker_plan;
    }
    if (payload.child_run && typeof payload.child_run === "object") {
        const childIdentifier = payload.child_run.identifier || payload.child_run.phase_context || payload.child_run.run_id || "child";
        const childKey = `${payload.child_run.worker || "worker"}--${childIdentifier}`;
        nextState.child_runs = {
            ...(run.state.child_runs || {}),
            [childKey]: payload.child_run,
        };
    }
    if (payload.final_result) {
        nextState.final_result = payload.final_result;
    }
    if (payload.report_path) {
        nextState.report_path = payload.report_path;
    }
    if (payload.results_log_path) {
        nextState.results_log_path = payload.results_log_path;
    }
    if (phase === policy.aggregate_phase) {
        nextState.aggregation_summary = payload.aggregation_summary || payload.summary || payload;
    }
    if (phase === policy.report_phase) {
        nextState.report_written = payload.report_written === true || Boolean(payload.report_path || nextState.report_path);
    }
    if (phase === policy.results_log_phase) {
        nextState.results_log_appended = payload.results_log_appended === true || payload.appended === true || Boolean(payload.log_row);
    }
    if (phase === policy.cleanup_phase) {
        nextState.cleanup_completed = payload.cleanup_completed === true || payload.deleted === true;
    }
    if (phase === policy.self_check_phase) {
        nextState.self_check_passed = payload.pass === true;
        nextState.final_result = payload.final_result || nextState.final_result;
    }

    return nextState;
}

async function main() {
    const command = positionals[0];
    const projectRoot = values["project-root"];

    if (command === "start") {
        if (!values.skill || !values.identifier || !values["manifest-file"]) {
            fail("start requires --skill, --identifier, and --manifest-file");
        }
        const manifest = readManifestOrFail(values, readJsonFile);
        const result = startRun(projectRoot, {
            ...manifest,
            skill: values.skill,
            identifier: values.identifier,
        });
        output(result);
        process.exit(result.ok ? 0 : 1);
    }

    if (command === "status") {
        if (!values["run-id"] && values.skill && !values.identifier) {
            const activeRuns = listActiveRuns(projectRoot, values.skill);
            if (activeRuns.length > 1) {
                output({ ok: false, error: "Multiple active runs found. Pass --identifier or --run-id." });
                process.exit(1);
            }
        }
        const run = values["run-id"]
            ? loadRun(projectRoot, values["run-id"])
            : (values.skill ? loadActiveRun(projectRoot, values.skill, values.identifier) : null);
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
            complete: values.to === "DONE" ? true : run.state.complete,
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
        const nextState = saveState(projectRoot, runId, applyCheckpointToState(run, values.phase, payload));
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

    if (command === "complete") {
        const { runId, run } = resolveRun(projectRoot);
        const guard = validateTransition(run.manifest, run.state, run.checkpoints, "DONE");
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

    fail("Unknown command. Use: start, status, checkpoint, record-worker-result, record-summary, advance, pause, set-decision, complete");
}

main().catch(error => fail(error.message));
