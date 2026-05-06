export const WORKER_PHASES = Object.freeze({
    "ln-401": Object.freeze([
        "PHASE_0_CONFIG",
        "PHASE_1_RESOLVE_TASK",
        "PHASE_2_LOAD_CONTEXT",
        "PHASE_3_GOAL_GATE_BLUEPRINT",
        "PHASE_4_START_WORK",
        "PHASE_5_IMPLEMENT_AND_VERIFY_AC",
        "PHASE_6_QUALITY_AND_HANDOFF",
        "PHASE_7_WRITE_SUMMARY",
        "PHASE_8_SELF_CHECK",
    ]),
    "ln-402": Object.freeze([
        "PHASE_0_CONFIG",
        "PHASE_1_RESOLVE_TASK",
        "PHASE_2_LOAD_CONTEXT",
        "PHASE_3_REVIEW_CHECKS",
        "PHASE_4_AC_VALIDATION",
        "PHASE_5_SIDE_EFFECT_SCAN",
        "PHASE_6_DECISION_AND_MECHANICAL_CHECKS",
        "PHASE_7_WRITE_REVIEW_OUTPUT",
        "PHASE_8_WRITE_SUMMARY",
        "PHASE_9_SELF_CHECK",
    ]),
    "ln-403": Object.freeze([
        "PHASE_0_CONFIG",
        "PHASE_1_RESOLVE_TASK",
        "PHASE_2_LOAD_CONTEXT",
        "PHASE_3_PLAN_REWORK",
        "PHASE_4_IMPLEMENT_FIXES",
        "PHASE_5_QUALITY_AND_ROOT_CAUSE",
        "PHASE_6_HANDOFF_TO_REVIEW",
        "PHASE_7_WRITE_SUMMARY",
        "PHASE_8_SELF_CHECK",
    ]),
    "ln-404": Object.freeze([
        "PHASE_0_CONFIG",
        "PHASE_1_RESOLVE_TASK",
        "PHASE_2_LOAD_CONTEXT",
        "PHASE_3_VALIDATE_TEST_PLAN",
        "PHASE_4_START_WORK",
        "PHASE_5_IMPLEMENT_AND_RUN",
        "PHASE_6_HANDOFF_TO_REVIEW",
        "PHASE_7_WRITE_SUMMARY",
        "PHASE_8_SELF_CHECK",
    ]),
});

export function getWorkerPhases(skill) {
    return WORKER_PHASES[skill] || null;
}
