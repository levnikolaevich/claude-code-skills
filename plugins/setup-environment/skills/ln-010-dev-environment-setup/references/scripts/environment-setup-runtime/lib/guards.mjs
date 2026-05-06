import { PHASES } from "./phases.mjs";

const ALLOWED_TRANSITIONS = new Map([
    [PHASES.CONFIG, new Set([PHASES.ASSESS])],
    [PHASES.ASSESS, new Set([PHASES.PROVIDER_SELECTION])],
    [PHASES.PROVIDER_SELECTION, new Set([PHASES.DISPATCH_PLAN])],
    [PHASES.DISPATCH_PLAN, new Set([PHASES.WORKER_EXECUTION])],
    [PHASES.WORKER_EXECUTION, new Set([PHASES.VERIFY])],
    [PHASES.VERIFY, new Set([PHASES.WRITE_ENV_STATE])],
    [PHASES.WRITE_ENV_STATE, new Set([PHASES.SELF_CHECK])],
    [PHASES.SELF_CHECK, new Set([PHASES.DONE])],
    [PHASES.PAUSED, new Set([])],
    [PHASES.DONE, new Set([])],
]);

function hasCheckpoint(checkpoints, phase) {
    return Boolean(checkpoints?.[phase]);
}

function requiredWorkers(dispatchPlan) {
    return (dispatchPlan?.workers_to_run || []).length;
}

export function validateTransition(manifest, state, checkpoints, toPhase) {
    const allowed = ALLOWED_TRANSITIONS.get(state.phase);
    if (!allowed || !allowed.has(toPhase)) {
        return { ok: false, error: `Invalid transition: ${state.phase} -> ${toPhase}` };
    }
    if (!hasCheckpoint(checkpoints, state.phase)) {
        return { ok: false, error: `Checkpoint missing for ${state.phase}` };
    }
    if (state.pending_decision) {
        return { ok: false, error: "Pending decision must be resolved before advancing" };
    }

    if (toPhase === PHASES.PROVIDER_SELECTION && !state.assess_summary) {
        return { ok: false, error: "Assessment summary missing" };
    }

    if (toPhase === PHASES.DISPATCH_PLAN && !state.provider_selection?.chosen) {
        return { ok: false, error: "Tracker provider selection missing - run Phase 1b" };
    }

    if (toPhase === PHASES.WORKER_EXECUTION) {
        if (!state.dispatch_plan || !Array.isArray(state.dispatch_plan.workers_to_run)) {
            return { ok: false, error: "Dispatch plan missing" };
        }
    }

    if (toPhase === PHASES.VERIFY) {
        const expected = requiredWorkers(state.dispatch_plan);
        const actual = Object.keys(state.worker_results || {}).length;
        if (expected > 0 && actual < expected) {
            return { ok: false, error: "Not all dispatched workers recorded summaries" };
        }
    }

    if (toPhase === PHASES.WRITE_ENV_STATE && !state.verification_summary) {
        return { ok: false, error: "Verification summary missing" };
    }

    if (toPhase === PHASES.DONE) {
        if (!state.self_check_passed) {
            return { ok: false, error: "Self-check must pass before completion" };
        }
        if (!state.env_state_written && state.final_result !== "DRY_RUN_PLAN") {
            return { ok: false, error: "Environment state write not recorded" };
        }
    }

    return { ok: true };
}

export function computeResumeAction(manifest, state, checkpoints) {
    if (state.complete || state.phase === PHASES.DONE) {
        return "Run complete";
    }
    if (state.phase === PHASES.PAUSED) {
        if (state.pending_decision) {
            return `Resolve pending decision: ${state.pending_decision.kind}`;
        }
        return `Paused: ${state.paused_reason || "manual intervention required"}`;
    }
    if (!hasCheckpoint(checkpoints, state.phase)) {
        return `Complete ${state.phase} and write its checkpoint`;
    }
    if (state.phase === PHASES.PROVIDER_SELECTION && !state.provider_selection?.chosen) {
        return "Resolve tracker provider selection (record-decision) before advancing";
    }
    if (state.phase === PHASES.WORKER_EXECUTION) {
        const expected = requiredWorkers(state.dispatch_plan);
        const actual = Object.keys(state.worker_results || {}).length;
        if (expected > actual) {
            return "Record remaining worker summaries before verification";
        }
    }
    if (state.phase === PHASES.WRITE_ENV_STATE && !state.env_state_written) {
        return `Write .hex-skills/environment_state.json and checkpoint ${PHASES.WRITE_ENV_STATE}`;
    }
    if (state.phase === PHASES.SELF_CHECK && !state.self_check_passed) {
        return `Fix self-check failures, then checkpoint ${PHASES.SELF_CHECK} with pass=true`;
    }

    const nextPhase = Array.from(ALLOWED_TRANSITIONS.get(state.phase) || [])[0];
    return nextPhase ? `Advance to ${nextPhase}` : "No automatic resume action available";
}
