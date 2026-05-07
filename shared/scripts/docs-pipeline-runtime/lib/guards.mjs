// SOURCE-OF-TRUTH: shared/scripts/docs-pipeline-runtime/lib/guards.mjs. Edit ONLY here; run `node tools/marketplace/shared.mjs sync`

import {
    computePlanningBaseResumeAction,
    hasChoice,
    validatePlanningBaseTransition,
} from "../../planning-runtime/lib/guards.mjs";
import { PHASES } from "./phases.mjs";

const ALLOWED_TRANSITIONS = new Map([
    [PHASES.CONFIG, new Set([PHASES.SOURCE_SCAN])],
    [PHASES.SOURCE_SCAN, new Set([PHASES.CONFIRMATION])],
    [PHASES.CONFIRMATION, new Set([PHASES.DELEGATE])],
    [PHASES.DELEGATE, new Set([PHASES.QUALITY_GATE])],
    [PHASES.QUALITY_GATE, new Set([PHASES.CLEANUP])],
    [PHASES.CLEANUP, new Set([PHASES.SELF_CHECK])],
    [PHASES.SELF_CHECK, new Set([PHASES.DONE])],
    [PHASES.PAUSED, new Set([])],
    [PHASES.DONE, new Set([])],
]);

export function validateTransition(manifest, state, checkpoints, toPhase) {
    const base = validatePlanningBaseTransition(state, checkpoints, toPhase, ALLOWED_TRANSITIONS);
    if (!base.ok) {
        return base;
    }
    if (toPhase === PHASES.DELEGATE && !manifest.auto_approve && !hasChoice(state.decisions, "confirm_docs_pipeline")) {
        return { ok: false, error: "Source cleanup confirmation decision missing" };
    }
    if (toPhase === PHASES.QUALITY_GATE && Object.keys(state.component_results || {}).length === 0) {
        return { ok: false, error: "No docs component summaries recorded" };
    }
    if (toPhase === PHASES.CLEANUP && !state.quality_summary) {
        return { ok: false, error: "Docs quality summary missing" };
    }
    if (toPhase === PHASES.SELF_CHECK && !state.quality_gate_passed) {
        return { ok: false, error: "Quality gate must pass before self-check (checkpoint QUALITY_GATE with quality_gate_passed=true or ok=true)" };
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
    if (state.phase === PHASES.DELEGATE && Object.keys(state.component_results || {}).length === 0) {
        return "Record component summaries before docs-quality gate";
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
