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

function firstMissingWorker(state) {
    const workerPlan = Array.isArray(state.worker_plan) ? state.worker_plan : [];
    const workerResults = state.worker_results || {};
    return workerPlan.find(workerIdentifier => !workerResults[workerIdentifier]) || null;
}

function skippedCheckpoint(checkpoints, phase) {
    const payload = latestPayload(checkpoints, phase);
    return payload.skipped_by_mode === true || payload.skipped === true;
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
    if ((policy.delegate_phases || []).includes(state.phase) && workerResultsCount(state) === 0 && !skippedCheckpoint(checkpoints, state.phase)) {
        return { ok: false, error: `Worker summaries missing for ${state.phase}` };
    }

    if (toPhase === policy.aggregate_phase && state.worker_plan.length > 0 && workerResultsCount(state) < state.worker_plan.length) {
        return { ok: false, error: `Not all planned workers produced summaries (${workerResultsCount(state)}/${state.worker_plan.length})` };
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

    if (state.phase === policy.cleanup_phase && !state.cleanup_completed) {
        return { ok: false, error: `Cleanup checkpoint missing for ${state.phase}` };
    }

    if (toPhase === "DONE") {
        if (!state.self_check_passed) {
            return { ok: false, error: "Self-check must pass before completion" };
        }
        if (!state.report_written) {
            return { ok: false, error: "Public report must be written before completion" };
        }
        if (policy.results_log_phase && !state.results_log_appended) {
            return { ok: false, error: "Results log must be appended before completion" };
        }
        if (policy.cleanup_phase && !state.cleanup_completed) {
            return { ok: false, error: "Cleanup must complete before completion" };
        }
        if (!state.final_result) {
            return { ok: false, error: "Final result not recorded" };
        }
        if (!state.summary_recorded) {
            return { ok: false, error: "Audit coordinator summary must be recorded before completion" };
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
    if ((policy.delegate_phases || []).includes(state.phase) && workerResultsCount(state) === 0 && !skippedCheckpoint(checkpoints, state.phase)) {
        return `Record worker summaries before advancing from ${state.phase}`;
    }
    if (state.worker_plan.length > 0 && workerResultsCount(state) < state.worker_plan.length) {
        const missingWorker = firstMissingWorker(state);
        const childRun = missingWorker ? state.child_runs?.[missingWorker] : null;
        if (childRun?.run_id) {
            return `Record ${missingWorker} summary from child run ${childRun.run_id} before advancing`;
        }
        return `Record remaining worker summaries (${workerResultsCount(state)}/${state.worker_plan.length}) before advancing`;
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
    if (state.phase === policy.cleanup_phase && !state.cleanup_completed) {
        return `Checkpoint ${state.phase} with cleanup_completed=true`;
    }
    if (state.phase === policy.self_check_phase && !state.self_check_passed) {
        return `Fix self-check failures, then checkpoint ${state.phase} with pass=true`;
    }
    if (state.phase === policy.self_check_phase && !state.summary_recorded) {
        return "Record audit coordinator summary before completion";
    }

    const nextPhase = nextConfiguredPhase(manifest, state.phase);
    return nextPhase ? `Advance to ${nextPhase}` : "No automatic resume action available";
}
