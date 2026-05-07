import {
    computeLinearWorkerResumeAction,
    validateLinearWorkerTransition,
} from "../../coordinator-runtime/lib/worker-guards.mjs";

function getWorkerPhases(manifest) {
    return Array.isArray(manifest.phase_order) ? manifest.phase_order : [];
}

export function validateTransition(manifest, state, checkpoints, toPhase) {
    const phases = getWorkerPhases(manifest);
    if (phases.length === 0) {
        return { ok: false, error: `Missing phase_order for evaluation worker: ${manifest.skill}` };
    }
    return validateLinearWorkerTransition(state, checkpoints, toPhase, phases);
}

export function computeResumeAction(manifest, state, checkpoints) {
    const phases = getWorkerPhases(manifest);
    if (phases.length === 0) {
        return "Missing phase_order for evaluation worker";
    }
    return computeLinearWorkerResumeAction(state, checkpoints, phases);
}
