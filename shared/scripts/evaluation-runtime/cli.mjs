#!/usr/bin/env node

import { existsSync } from "node:fs";
import { parseArgs } from "node:util";
import {
    checkpointPhase,
    completeRun,
    fileExists,
    listActiveRuns,
    loadActiveRun,
    loadRun,
    pauseRun,
    readJsonFile,
    recordDecision,
    recordSummary,
    recordWorkerResult,
    registerAgent,
    resolveRunId,
    resolveTrackedPath,
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
import { REVIEW_AGENT_STATUSES, REVIEW_RESOLVED_AGENT_STATUS_SET } from "../coordinator-runtime/lib/runtime-constants.mjs";

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
        agent: { type: "string" },
        "prompt-file": { type: "string" },
        "result-file": { type: "string" },
        "log-file": { type: "string" },
        "metadata-file": { type: "string" },
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

function mergeObjectMap(current, incoming) {
    if (!incoming || typeof incoming !== "object") {
        return current;
    }
    return {
        ...(current || {}),
        ...incoming,
    };
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
        const childKey = `${payload.child_run.worker}--${payload.child_run.identifier}`;
        nextState.child_runs = {
            ...(run.state.child_runs || {}),
            [childKey]: payload.child_run,
        };
    }
    if (payload.child_runs && typeof payload.child_runs === "object") {
        nextState.child_runs = mergeObjectMap(run.state.child_runs, payload.child_runs);
    }
    if (payload.inflight_worker && typeof payload.inflight_worker === "object") {
        const inflightKey = `${payload.inflight_worker.worker}--${payload.inflight_worker.identifier}`;
        nextState.inflight_workers = {
            ...(run.state.inflight_workers || {}),
            [inflightKey]: payload.inflight_worker,
        };
    }
    if (payload.inflight_workers && typeof payload.inflight_workers === "object") {
        nextState.inflight_workers = mergeObjectMap(run.state.inflight_workers, payload.inflight_workers);
    }
    if (payload.resolved_workers && Array.isArray(payload.resolved_workers)) {
        const inflight = { ...(nextState.inflight_workers || {}) };
        for (const workerKey of payload.resolved_workers) {
            delete inflight[workerKey];
        }
        nextState.inflight_workers = inflight;
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
    if (payload.research_completed === true || Array.isArray(payload.research_sources) || Array.isArray(payload.research_artifacts)) {
        nextState.research_completed = true;
    }
    if (payload.background_agent_cleanup && typeof payload.background_agent_cleanup === "object") {
        nextState.background_agent_cleanup = mergeObjectMap(run.state.background_agent_cleanup, payload.background_agent_cleanup);
    }
    if (payload.refinement_cleanup && typeof payload.refinement_cleanup === "object") {
        nextState.refinement_cleanup = mergeObjectMap(run.state.refinement_cleanup, payload.refinement_cleanup);
    }
    if (typeof payload.cleanup_verified === "boolean") {
        nextState.cleanup_verified = payload.cleanup_verified;
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
        nextState.cleanup_verified = payload.cleanup_verified === true;
    }
    if (phase === policy.self_check_phase) {
        nextState.self_check_passed = payload.pass === true;
        nextState.final_result = payload.final_result || nextState.final_result;
    }

    return nextState;
}

function isProcessAlive(pid) {
    if (!pid) {
        return false;
    }
    try {
        process.kill(pid, 0);
        return true;
    } catch {
        return false;
    }
}

function syncOneAgent(projectRoot, agentState) {
    const nextAgent = { ...agentState };
    const metadataPath = resolveTrackedPath(projectRoot, nextAgent.metadata_file);
    const resultPath = resolveTrackedPath(projectRoot, nextAgent.result_file);
    const metadata = metadataPath && existsSync(metadataPath) ? readJsonFile(metadataPath) : null;
    if (metadata) {
        nextAgent.pid = metadata.pid ?? nextAgent.pid ?? null;
        nextAgent.error = metadata.error ?? nextAgent.error ?? null;
        nextAgent.exit_code = metadata.exit_code ?? nextAgent.exit_code ?? null;
        nextAgent.finished_at = metadata.finished_at ?? nextAgent.finished_at ?? null;
    }
    if (resultPath && fileExists(resultPath)) {
        nextAgent.status = REVIEW_AGENT_STATUSES.RESULT_READY;
    } else if (metadata && (metadata.success === false || metadata.status === REVIEW_AGENT_STATUSES.FAILED)) {
        nextAgent.status = REVIEW_AGENT_STATUSES.FAILED;
    } else if (nextAgent.pid && !isProcessAlive(nextAgent.pid)) {
        nextAgent.status = REVIEW_AGENT_STATUSES.DEAD;
    } else if (!REVIEW_RESOLVED_AGENT_STATUS_SET.has(nextAgent.status)) {
        nextAgent.status = REVIEW_AGENT_STATUSES.LAUNCHED;
    }
    return nextAgent;
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

    if (command === "register-agent") {
        if (!values.agent) {
            fail("register-agent requires --agent");
        }
        const { runId } = resolveRun(projectRoot);
        const result = registerAgent(projectRoot, runId, {
            name: values.agent,
            prompt_file: values["prompt-file"] || null,
            result_file: values["result-file"] || null,
            log_file: values["log-file"] || null,
            metadata_file: values["metadata-file"] || null,
            status: REVIEW_AGENT_STATUSES.LAUNCHED,
        });
        if (!result.ok) {
            failResult(result);
        }
        output(result);
        return;
    }

    if (command === "sync-agent") {
        const { runId, run } = resolveRun(projectRoot);
        const agentNames = values.agent ? [values.agent] : Object.keys(run.state.agents || {});
        if (agentNames.length === 0) {
            output({ ok: true, agents: {}, resolved: true });
            return;
        }
        const nextAgents = { ...run.state.agents };
        for (const agentName of agentNames) {
            if (!nextAgents[agentName]) {
                fail(`Agent not registered: ${agentName}`);
            }
            nextAgents[agentName] = syncOneAgent(projectRoot, nextAgents[agentName]);
        }
        const nextState = saveState(projectRoot, runId, { ...run.state, agents: nextAgents });
        if (nextState?.ok === false) {
            failResult(nextState);
        }
        output({
            ok: true,
            agents: agentNames.reduce((acc, name) => {
                acc[name] = nextState.agents[name];
                return acc;
            }, {}),
            resolved: Object.values(nextState.agents).every(agent => REVIEW_RESOLVED_AGENT_STATUS_SET.has(agent.status)),
        });
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

    fail("Unknown command. Use: start, status, checkpoint, record-worker-result, record-summary, register-agent, sync-agent, advance, pause, set-decision, complete");
}

main().catch(error => fail(error.message));
