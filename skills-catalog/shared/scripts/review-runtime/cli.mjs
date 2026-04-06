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
    recordStageSummary,
    registerAgent,
    resolveRunId,
    resolveTrackedPath,
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
    RESOLVED_AGENT_STATUSES,
    computeResumeAction,
    validateTransition,
} from "./lib/guards.mjs";
import { REVIEW_AGENT_STATUSES } from "../coordinator-runtime/lib/runtime-constants.mjs";
import { PHASES } from "./lib/phases.mjs";

const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
        skill: { type: "string" },
        "run-id": { type: "string" },
        mode: { type: "string" },
        identifier: { type: "string" },
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

function applyCheckpointToState(state, phase, payload) {
    const nextState = { ...state };

    if (phase === PHASES.AGENT_LAUNCH) {
        nextState.health_check_done = payload.health_check_done === true;
        nextState.agents_available = Number(payload.agents_available || 0);
        nextState.agents_required = Array.isArray(payload.agents_required) ? payload.agents_required : [];
        nextState.agents_skipped_reason = payload.agents_skipped_reason || null;
    }

    if (phase === PHASES.DOCS && payload.docs_checkpoint) {
        nextState.docs_checkpoint = payload.docs_checkpoint;
    }

    if (phase === PHASES.MERGE) {
        nextState.merge_summary = payload.merge_summary || payload.summary || payload;
    }

    if (phase === PHASES.REFINEMENT) {
        nextState.refinement_iterations = Number(payload.iterations || 0);
        nextState.refinement_exit_reason = payload.exit_reason || null;
        nextState.refinement_applied = Number(payload.applied || 0);
    }

    if (phase === PHASES.APPROVE && payload.verdict) {
        nextState.final_verdict = payload.verdict;
        nextState.final_result = payload.verdict;
    }

    if (phase === PHASES.SELF_CHECK) {
        nextState.self_check_passed = payload.pass === true;
        nextState.processes_verified_dead = payload.processes_verified_dead === true;
        if (payload.final_verdict) {
            nextState.final_verdict = payload.final_verdict;
            nextState.final_result = payload.final_verdict;
        }
        // Guard: pass cannot be true if processes not verified
        if (nextState.self_check_passed && !nextState.processes_verified_dead) {
            nextState.self_check_passed = false;
        }
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

    // Read metadata only for PID (liveness check) and error details.
    // Status is determined by result file existence, then PID liveness.
    const metadata = metadataPath && existsSync(metadataPath) ? readJsonFile(metadataPath) : null;
    if (metadata) {
        nextAgent.pid = metadata.pid ?? nextAgent.pid ?? null;
        nextAgent.error = metadata.error ?? nextAgent.error ?? null;
    }

    // Primary signal: result file existence → RESULT_READY
    if (resultPath && fileExists(resultPath)) {
        nextAgent.status = REVIEW_AGENT_STATUSES.RESULT_READY;
    } else if (metadata && (metadata.success === false || metadata.status === REVIEW_AGENT_STATUSES.FAILED)) {
        nextAgent.status = REVIEW_AGENT_STATUSES.FAILED;
    } else if (nextAgent.pid && !isProcessAlive(nextAgent.pid)) {
        nextAgent.status = REVIEW_AGENT_STATUSES.DEAD;
    } else if (!RESOLVED_AGENT_STATUSES.has(nextAgent.status)) {
        nextAgent.status = REVIEW_AGENT_STATUSES.LAUNCHED;
    }

    return nextAgent;
}

async function main() {
    const command = positionals[0];
    const projectRoot = values["project-root"];

    if (command === "start") {
        if (!values.skill || !values.mode || !values.identifier || !values["manifest-file"]) {
            fail("start requires --skill, --mode, --identifier, and --manifest-file");
        }
        const manifest = readManifestOrFail(values, readJsonFile);
        const result = startRun(projectRoot, {
            ...manifest,
            skill: values.skill,
            mode: values.mode,
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
        const nextState = saveState(projectRoot, runId, applyCheckpointToState(run.state, values.phase, payload));
        if (nextState?.ok === false) {
            failResult(nextState);
        }
        outputRuntimeState(output, run, nextState, {
            checkpoint: result.checkpoints[values.phase],
        });
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
            resolved: Object.values(nextState.agents).every(agent => RESOLVED_AGENT_STATUSES.has(agent.status)),
        });
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

    fail("Unknown command. Use: start, status, advance, checkpoint, register-agent, record-stage-summary, sync-agent, pause, complete");
}

main().catch(error => fail(error.message));
