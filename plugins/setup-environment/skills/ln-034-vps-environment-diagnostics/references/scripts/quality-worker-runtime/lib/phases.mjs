export const WORKER_PHASES = Object.freeze({
    "ln-511": Object.freeze([
        "PHASE_0_CONFIG",
        "PHASE_1_RESOLVE_STORY",
        "PHASE_2_LOAD_SCOPE",
        "PHASE_3_METRICS_AND_STATIC_ANALYSIS",
        "PHASE_4_EXTERNAL_REF_VALIDATION",
        "PHASE_5_SCORE_AND_FINDINGS",
        "PHASE_6_WRITE_PUBLIC_OUTPUT",
        "PHASE_7_WRITE_SUMMARY",
        "PHASE_8_SELF_CHECK",
    ]),
    "ln-512": Object.freeze([
        "PHASE_0_CONFIG",
        "PHASE_1_LOAD_FINDINGS",
        "PHASE_2_FILTER_FIXABLE",
        "PHASE_3_VERIFY_CANDIDATES",
        "PHASE_4_APPLY_FIXES",
        "PHASE_5_VERIFY_BUILD_AND_REPORT",
        "PHASE_6_WRITE_SUMMARY",
        "PHASE_7_SELF_CHECK",
    ]),
    "ln-513": Object.freeze([
        "PHASE_0_CONFIG",
        "PHASE_1_RESOLVE_STORY",
        "PHASE_2_DISCOVER_TEST_COMMAND",
        "PHASE_3_EXECUTE_SUITE",
        "PHASE_4_NORMALIZE_RESULTS",
        "PHASE_5_WRITE_PUBLIC_OUTPUT",
        "PHASE_6_WRITE_SUMMARY",
        "PHASE_7_SELF_CHECK",
    ]),
    "ln-514": Object.freeze([
        "PHASE_0_CONFIG",
        "PHASE_1_PARSE_ARGS",
        "PHASE_2_DETECT_LOG_SOURCE_AND_COLLECT",
        "PHASE_3_CLASSIFY_ERRORS",
        "PHASE_4_ASSESS_LOG_QUALITY",
        "PHASE_5_MAP_STACKS_AND_RECOMMEND",
        "PHASE_6_WRITE_PUBLIC_OUTPUT",
        "PHASE_7_WRITE_SUMMARY",
        "PHASE_8_SELF_CHECK",
    ]),
});

export function getWorkerPhases(skill) {
    return WORKER_PHASES[skill] || null;
}
