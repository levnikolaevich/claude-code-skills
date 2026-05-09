// SOURCE-OF-TRUTH: shared/scripts/evaluation-runtime/lib/guards.mjs. Edit ONLY here; run `node tools/marketplace/shared.mjs sync`

import { REVIEW_RESOLVED_AGENT_STATUS_SET } from "../../coordinator-runtime/lib/runtime-constants.mjs";

function latestPayload(checkpoints, phase) {
    return checkpoints?.[phase]?.payload || {};
}

function configuredPhases(manifest) {
    return Array.isArray(manifest.phase_order) ? manifest.phase_order : [];
}

function nextConfiguredPhase(manifest, currentPhase) {
    const phases = configuredPhases(manifest);
    const index = phases.indexOf(currentPhase);
    if (index === -1) {
        return null;
    }
    if (index === phases.length - 1) {
        return "DONE";
    }
    return phases[index + 1];
}

function hasCheckpoint(checkpoints, phase) {
    return Boolean(checkpoints?.[phase]);
}

function workerResultsCount(state) {
    return Object.keys(state.worker_results || {}).length;
}

function inflightWorkersCount(state) {
    return Object.keys(state.inflight_workers || {}).length;
}

function firstMissingWorker(state) {
    const workerPlan = Array.isArray(state.worker_plan) ? state.worker_plan : [];
    const workerResults = state.worker_results || {};
    return workerPlan.find(worker => {
        const workerKey = typeof worker === "string"
            ? worker
            : `${worker.worker}--${worker.identifier}`;
        return !workerResults[workerKey];
    }) || null;
}

function skippedCheckpoint(checkpoints, phase) {
    const payload = latestPayload(checkpoints, phase);
    return payload.skipped_by_mode === true || payload.skipped === true;
}

function allAgentsResolved(state, barrierAgents = []) {
    const agents = state.agents || {};
    const agentNames = barrierAgents.length > 0 ? barrierAgents : Object.keys(agents);
    return agentNames.every(agentName => {
        const agent = agents[agentName];
        if (!agent) {
            return false;
        }
        return REVIEW_RESOLVED_AGENT_STATUS_SET.has(agent.status);
    });
}

function pendingAgentBarrier(manifest, toPhase) {
    const barriers = manifest.phase_policy?.agent_resolve_before || [];
    return barriers.includes(toPhase);
}

export function validateTransition(manifest, state, checkpoints, toPhase) {
    if (state.phase === "DONE" || state.phase === "PAUSED") {
        return { ok: false, error: `Invalid transition: ${state.phase} -> ${toPhase}` };
    }

    const expectedNext = nextConfiguredPhase(manifest, state.phase);
    if (!expectedNext || expectedNext !== toPhase) {
        return { ok: false, error: `Invalid transition: ${state.phase} -> ${toPhase}` };
    }

    if (!hasCheckpoint(checkpoints, state.phase)) {
        return { ok: false, error: `Checkpoint missing for ${state.phase}` };
    }

    const policy = manifest.phase_policy || {};
    const isDelegatePhase = (policy.delegate_phases || []).includes(state.phase);
    if (isDelegatePhase && Array.isArray(state.worker_plan) && state.worker_plan.length > 0
        && workerResultsCount(state) === 0 && !skippedCheckpoint(checkpoints, state.phase)) {
        return { ok: false, error: `Worker summaries missing for ${state.phase}` };
    }

    if (toPhase === policy.aggregate_phase) {
        if (Array.isArray(state.worker_plan) && state.worker_plan.length > 0 && workerResultsCount(state) < state.worker_plan.length) {
            return { ok: false, error: `Not all planned workers produced summaries (${workerResultsCount(state)}/${state.worker_plan.length})` };
        }
        if (inflightWorkersCount(state) > 0) {
            return { ok: false, error: `Aggregate phase blocked by inflight workers (${inflightWorkersCount(state)})` };
        }
    }

    if (pendingAgentBarrier(manifest, toPhase) && !allAgentsResolved(state, manifest.expected_agents || [])) {
        return { ok: false, error: `Required agents are unresolved before ${toPhase}` };
    }

    if (state.phase === policy.aggregate_phase && !state.aggregation_summary) {
        return { ok: false, error: `Aggregation summary missing for ${state.phase}` };
    }

    if (state.phase === policy.report_phase && !state.report_written) {
        return { ok: false, error: `Report checkpoint missing for ${state.phase}` };
    }

    if (state.phase === policy.results_log_phase && !state.results_log_appended) {
        return { ok: false, error: `Results log checkpoint missing for ${state.phase}` };
    }

    if (state.phase === policy.cleanup_phase && !state.cleanup_verified) {
        return { ok: false, error: `Cleanup verification missing for ${state.phase}` };
    }

    if (toPhase === "DONE") {
        if (manifest.required_research !== false && !state.research_completed) {
            return { ok: false, error: "Research evidence must be recorded before completion" };
        }
        if (!state.cleanup_verified) {
            return { ok: false, error: "Cleanup must be verified before completion" };
        }
        if (!state.self_check_passed) {
            return { ok: false, error: "Self-check must pass before completion" };
        }
        if (!state.report_written) {
            return { ok: false, error: "Public report must be written before completion" };
        }
        if (policy.results_log_phase && !state.results_log_appended) {
            return { ok: false, error: "Results log must be appended before completion" };
        }
        if (!state.final_result) {
            return { ok: false, error: "Final result not recorded" };
        }
        if (!state.summary_recorded) {
            return { ok: false, error: "Evaluation coordinator summary must be recorded before completion" };
        }
    }

    return { ok: true };
}

export function computeResumeAction(manifest, state, checkpoints) {
    if (state.complete || state.phase === "DONE") {
        return "Run complete";
    }
    if (state.phase === "PAUSED") {
        if (state.pending_decision?.resume_to_phase) {
            return `Resolve pending decision and resume ${state.pending_decision.resume_to_phase}`;
        }
        return `Paused: ${state.paused_reason || "manual intervention required"}`;
    }
    if (!hasCheckpoint(checkpoints, state.phase)) {
        return `Complete ${state.phase} and write its checkpoint`;
    }

    const policy = manifest.phase_policy || {};
    const isDelegatePhase = (policy.delegate_phases || []).includes(state.phase);
    if (isDelegatePhase && Array.isArray(state.worker_plan) && state.worker_plan.length > 0
        && workerResultsCount(state) === 0 && !skippedCheckpoint(checkpoints, state.phase)) {
        return `Record worker summaries before advancing from ${state.phase}`;
    }
    if (Array.isArray(state.worker_plan) && state.worker_plan.length > 0 && workerResultsCount(state) < state.worker_plan.length) {
        const missingWorker = firstMissingWorker(state);
        const missingKey = typeof missingWorker === "string"
            ? missingWorker
            : `${missingWorker?.worker}--${missingWorker?.identifier}`;
        const childRun = missingKey ? state.child_runs?.[missingKey] : null;
        if (childRun?.run_id) {
            return `Record ${missingKey} summary from child run ${childRun.run_id} before advancing`;
        }
        return `Record remaining worker summaries (${workerResultsCount(state)}/${state.worker_plan.length}) before advancing`;
    }
    if (inflightWorkersCount(state) > 0) {
        return `Wait for inflight workers to resolve (${inflightWorkersCount(state)} remaining)`;
    }
    if (state.phase === policy.aggregate_phase && !state.aggregation_summary) {
        return `Checkpoint ${state.phase} with aggregation_summary`;
    }
    if (state.phase === policy.report_phase && !state.report_written) {
        return `Checkpoint ${state.phase} with report_written=true`;
    }
    if (state.phase === policy.results_log_phase && !state.results_log_appended) {
        return `Checkpoint ${state.phase} with results_log_appended=true`;
    }
    if (state.phase === policy.cleanup_phase && !state.cleanup_verified) {
        return `Checkpoint ${state.phase} with cleanup_verified=true after evidence review`;
    }
    if (state.phase === policy.self_check_phase && !state.self_check_passed) {
        return `Fix self-check failures, then checkpoint ${state.phase} with pass=true`;
    }
    if (manifest.required_research !== false && !state.research_completed) {
        return "Record mandatory research evidence before final completion";
    }
    if (pendingAgentBarrier(manifest, nextConfiguredPhase(manifest, state.phase)) && !allAgentsResolved(state, manifest.expected_agents || [])) {
        return "Sync agents until every required agent is resolved";
    }
    if (state.phase === policy.self_check_phase && !state.summary_recorded) {
        return "Record evaluation coordinator summary before completion";
    }

    const nextPhase = nextConfiguredPhase(manifest, state.phase);
    return nextPhase ? `Advance to ${nextPhase}` : "No automatic resume action available";
}
