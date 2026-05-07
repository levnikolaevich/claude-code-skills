import { computeLinearWorkerResumeAction, validateLinearWorkerTransition } from "../../coordinator-runtime/lib/worker-guards.mjs";
import { getWorkerPhases } from "./phases.mjs";

export function validateTransition(manifest, state, checkpoints, toPhase) {
    const phases = getWorkerPhases(manifest.skill);
    if (!phases) {
        return { ok: false, error: `Unsupported quality worker skill: ${manifest.skill}` };
    }
    return validateLinearWorkerTransition(state, checkpoints, toPhase, phases);
}

export function computeResumeAction(manifest, state, checkpoints) {
    const phases = getWorkerPhases(manifest.skill);
    if (!phases) {
        return "Unsupported quality worker skill";
    }
    return computeLinearWorkerResumeAction(state, checkpoints, phases);
}
