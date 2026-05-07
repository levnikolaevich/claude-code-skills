import { PHASES } from "./phases.mjs";

const ALLOWED_TRANSITIONS = new Map([
    [PHASES.CONFIG, new Set([PHASES.CONTEXT_ASSEMBLY])],
    [PHASES.CONTEXT_ASSEMBLY, new Set([PHASES.DETECTION])],
    [PHASES.DETECTION, new Set([PHASES.DELEGATE])],
    [PHASES.DELEGATE, new Set([PHASES.AGGREGATE])],
    [PHASES.AGGREGATE, new Set([PHASES.SELF_CHECK])],
    [PHASES.SELF_CHECK, new Set([PHASES.DONE])],
    [PHASES.PAUSED, new Set([])],
    [PHASES.DONE, new Set([])],
]);

function hasCheckpoint(checkpoints, phase) {
    return Boolean(checkpoints?.[phase]);
}

export function validateTransition(manifest, state, checkpoints, toPhase) {
    const allowed = ALLOWED_TRANSITIONS.get(state.phase);
    if (!allowed || !allowed.has(toPhase)) {
        return { ok: false, error: `Invalid transition: ${state.phase} -> ${toPhase}` };
    }
    if (!hasCheckpoint(checkpoints, state.phase)) {
        return { ok: false, error: `Checkpoint missing for ${state.phase}` };
    }
    if (toPhase === PHASES.DETECTION && !state.context_ready) {
        return { ok: false, error: "Context assembly not recorded" };
    }
    if (toPhase === PHASES.DELEGATE && !state.detected_flags) {
        return { ok: false, error: "Detected project flags missing" };
    }
    if (toPhase === PHASES.AGGREGATE) {
        const expected = state.worker_plan || [];
        const actual = Object.keys(state.worker_results || {});
        if (expected.length > 0 && actual.length < expected.length) {
            return { ok: false, error: "Not all docs workers produced summaries" };
        }
    }
    if (toPhase === PHASES.DONE) {
        if (!state.self_check_passed) {
            return { ok: false, error: "Self-check must pass before completion" };
        }
        if (!state.final_result) {
            return { ok: false, error: "Final result not recorded" };
        }
    }
    return { ok: true };
}

export function computeResumeAction(manifest, state, checkpoints) {
    if (state.complete || state.phase === PHASES.DONE) {
        return "Run complete";
    }
    if (state.phase === PHASES.PAUSED) {
        return `Paused: ${state.paused_reason || "manual intervention required"}`;
    }
    if (!hasCheckpoint(checkpoints, state.phase)) {
        return `Complete ${state.phase} and write its checkpoint`;
    }
    if (state.phase === PHASES.DELEGATE) {
        const expected = state.worker_plan || [];
        const actual = Object.keys(state.worker_results || {});
        if (expected.length > actual.length) {
            return "Record remaining docs worker summaries before aggregation";
        }
    }
    if (state.phase === PHASES.SELF_CHECK && !state.self_check_passed) {
        return `Fix self-check failures, then checkpoint ${PHASES.SELF_CHECK} with pass=true`;
    }
    const nextPhase = Array.from(ALLOWED_TRANSITIONS.get(state.phase) || [])[0];
    return nextPhase ? `Advance to ${nextPhase}` : "No automatic resume action available";
}
