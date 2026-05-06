export const WORKER_PHASES = Object.freeze({
    "ln-521": Object.freeze([
        "PHASE_0_CONFIG",
        "PHASE_1_RESOLVE_STORY",
        "PHASE_2_EXTRACT_DOMAIN",
        "PHASE_3_RESEARCH_PROBLEMS",
        "PHASE_4_RESEARCH_COMPETITORS",
        "PHASE_5_RESEARCH_COMPLAINTS",
        "PHASE_6_WRITE_COMMENT",
        "PHASE_7_WRITE_SUMMARY",
        "PHASE_8_SELF_CHECK",
    ]),
    "ln-522": Object.freeze([
        "PHASE_0_CONFIG",
        "PHASE_1_RESOLVE_STORY",
        "PHASE_2_SETUP_MANUAL_TEST_STRUCTURE",
        "PHASE_3_GENERATE_SCRIPT",
        "PHASE_4_UPDATE_TEST_DOCS",
        "PHASE_5_EXECUTE_AND_CAPTURE",
        "PHASE_6_WRITE_COMMENT",
        "PHASE_7_WRITE_SUMMARY",
        "PHASE_8_SELF_CHECK",
    ]),
    "ln-523": Object.freeze([
        "PHASE_0_CONFIG",
        "PHASE_1_RESOLVE_STORY",
        "PHASE_2_LOAD_RESEARCH_AND_MANUAL_RESULTS",
        "PHASE_3_ANALYZE_STORY_AND_TASKS",
        "PHASE_4_BUILD_RISK_PLAN",
        "PHASE_5_GENERATE_TEST_TASK_SPEC",
        "PHASE_6_DELEGATE_TASK_PLAN",
        "PHASE_7_WRITE_SUMMARY",
        "PHASE_8_SELF_CHECK",
    ]),
});

export function getWorkerPhases(skill) {
    return WORKER_PHASES[skill] || null;
}
