import {
    computePlanningBaseResumeAction,
    hasChoice,
    validatePlanningBaseTransition,
} from "../../planning-runtime/lib/guards.mjs";
import { PHASES } from "./phases.mjs";

const ALLOWED_TRANSITIONS = new Map([
    [PHASES.CONFIG, new Set([PHASES.DISCOVERY])],
    [PHASES.DISCOVERY, new Set([PHASES.DECOMPOSE])],
    [PHASES.DECOMPOSE, new Set([PHASES.READINESS_GATE])],
    [PHASES.READINESS_GATE, new Set([PHASES.MODE_DETECTION])],
    [PHASES.MODE_DETECTION, new Set([PHASES.DELEGATE])],
    [PHASES.DELEGATE, new Set([PHASES.VERIFY])],
    [PHASES.VERIFY, new Set([PHASES.SELF_CHECK])],
    [PHASES.SELF_CHECK, new Set([PHASES.DONE])],
    [PHASES.PAUSED, new Set([])],
    [PHASES.DONE, new Set([])],
]);

export function validateTransition(manifest, state, checkpoints, toPhase) {
    const base = validatePlanningBaseTransition(state, checkpoints, toPhase, ALLOWED_TRANSITIONS);
    if (!base.ok) {
        return base;
    }
    if (toPhase === PHASES.DECOMPOSE && !state.discovery_ready) {
        return { ok: false, error: "Discovery summary missing" };
    }
    if (toPhase === PHASES.READINESS_GATE && !state.ideal_plan_summary) {
        return { ok: false, error: "Ideal task plan summary missing" };
    }
    if (toPhase === PHASES.MODE_DETECTION) {
        if (state.readiness_score == null) {
            return { ok: false, error: "Readiness score missing" };
        }
        if (state.readiness_score < 4) {
            return { ok: false, error: "Readiness gate blocked the plan" };
        }
        if (state.readiness_score < 6 && !hasChoice(state.decisions, "continue_with_warnings")) {
            return { ok: false, error: "Readiness approval decision missing" };
        }
    }
    if (toPhase === PHASES.DELEGATE && !state.mode_detection) {
        return { ok: false, error: "Mode detection missing" };
    }
    if (toPhase === PHASES.VERIFY && !state.plan_result) {
        return { ok: false, error: "Worker summary missing" };
    }
    if (toPhase === PHASES.SELF_CHECK && !state.verification_summary) {
        return { ok: false, error: "Verification summary missing" };
    }
    if (toPhase === PHASES.SELF_CHECK && !state.template_compliance_passed) {
        return { ok: false, error: "Template compliance not verified. Fetch each created task via get_issue, run validateTemplateCompliance(description, 'task'), record template_compliance_passed in state." };
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
    if (state.phase === PHASES.READINESS_GATE && state.readiness_score != null && state.readiness_score < 6) {
        return "Record approval decision or improve the plan before mode detection";
    }
    if (state.phase === PHASES.DELEGATE && !state.plan_result) {
        if (state.child_run?.run_id) {
            return `Check child runtime ${state.child_run.run_id} for ${state.child_run.worker || "task-plan worker"} or record task-planning worker summary before verification`;
        }
        return "Record task-planning worker summary before verification";
    }
    if (state.phase === PHASES.SELF_CHECK && !state.self_check_passed) {
        return `Fix self-check failures, then checkpoint ${PHASES.SELF_CHECK} with pass=true`;
    }
    return computePlanningBaseResumeAction(
        state,
        checkpoints,
        ALLOWED_TRANSITIONS,
        PHASES.PAUSED,
        PHASES.DONE,
    );
}
