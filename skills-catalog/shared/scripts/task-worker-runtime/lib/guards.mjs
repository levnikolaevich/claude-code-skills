import { TASK_BOARD_STATUSES } from "../../coordinator-runtime/lib/runtime-constants.mjs";
import { computeLinearWorkerResumeAction, validateLinearWorkerTransition } from "../../coordinator-runtime/lib/worker-guards.mjs";
import { getWorkerPhases } from "./phases.mjs";

function validateTaskSummaryForSkill(manifest, summary) {
    const toStatus = summary.payload?.to_status;
    if (manifest.skill === "ln-402") {
        if (toStatus !== TASK_BOARD_STATUSES.DONE && toStatus !== TASK_BOARD_STATUSES.TO_REWORK) {
            return { ok: false, error: "ln-402 summaries must end in Done or To Rework" };
        }
        return { ok: true };
    }
    if (toStatus !== TASK_BOARD_STATUSES.TO_REVIEW) {
        return { ok: false, error: `${manifest.skill} summaries must hand off to To Review` };
    }
    return { ok: true };
}

export function validateTransition(manifest, state, checkpoints, toPhase) {
    const phases = getWorkerPhases(manifest.skill);
    if (!phases) {
        return { ok: false, error: `Unsupported task worker skill: ${manifest.skill}` };
    }
    return validateLinearWorkerTransition(state, checkpoints, toPhase, phases);
}

export function computeResumeAction(manifest, state, checkpoints) {
    const phases = getWorkerPhases(manifest.skill);
    if (!phases) {
        return "Unsupported task worker skill";
    }
    return computeLinearWorkerResumeAction(state, checkpoints, phases);
}

export { validateTaskSummaryForSkill };
