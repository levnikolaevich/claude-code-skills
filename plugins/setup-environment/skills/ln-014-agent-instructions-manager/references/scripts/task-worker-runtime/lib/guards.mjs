// SOURCE-OF-TRUTH: shared/scripts/task-worker-runtime/lib/guards.mjs. Edit ONLY here; run `node tools/marketplace/shared.mjs sync`

import { TASK_BOARD_STATUSES } from "../../coordinator-runtime/lib/runtime-constants.mjs";
import { computeLinearWorkerResumeAction, validateLinearWorkerTransition } from "../../coordinator-runtime/lib/worker-guards.mjs";
import { getWorkerPhases } from "./phases.mjs";
import { blueprintCheckpointPayloadSchema, blueprintStatusSchema } from "../../coordinator-runtime/lib/schemas.mjs";
import { assertSchema } from "../../coordinator-runtime/lib/validate.mjs";

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

function validateBlueprintGuard(state, checkpoints, toPhase) {
    if (toPhase === "PHASE_4_START_WORK") {
        const phase3 = checkpoints?.PHASE_3_GOAL_GATE_BLUEPRINT;
        if (!phase3?.payload?.blueprint) {
            return { ok: false, error: "PHASE_3 checkpoint must include structured blueprint before starting work" };
        }
        const v = assertSchema(blueprintCheckpointPayloadSchema, phase3.payload, "blueprint checkpoint");
        if (!v.ok) return v;
    }
    if (toPhase === "PHASE_7_WRITE_SUMMARY") {
        const phase6 = checkpoints?.PHASE_6_QUALITY_AND_HANDOFF;
        if (!phase6?.payload?.blueprint_status) {
            return { ok: false, error: "PHASE_6 checkpoint must include blueprint_status before writing summary" };
        }
        const v = assertSchema(blueprintStatusSchema, phase6.payload.blueprint_status, "blueprint status");
        if (!v.ok) return v;
    }
    return null;
}

export function validateTransition(manifest, state, checkpoints, toPhase) {
    const phases = getWorkerPhases(manifest.skill);
    if (!phases) {
        return { ok: false, error: `Unsupported task worker skill: ${manifest.skill}` };
    }
    const extra = manifest.skill === "ln-401" ? validateBlueprintGuard : null;
    return validateLinearWorkerTransition(state, checkpoints, toPhase, phases, extra);
}

export function computeResumeAction(manifest, state, checkpoints) {
    const phases = getWorkerPhases(manifest.skill);
    if (!phases) {
        return "Unsupported task worker skill";
    }
    return computeLinearWorkerResumeAction(state, checkpoints, phases);
}

export { validateTaskSummaryForSkill };
