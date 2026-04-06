const SCAN_ANALYZE_REPORT_PHASES = Object.freeze([
    "PHASE_0_CONFIG",
    "PHASE_1_RESOLVE_SCOPE",
    "PHASE_2_LOAD_CONTEXT",
    "PHASE_3_LAYER1_SCAN",
    "PHASE_4_LAYER2_ANALYSIS",
    "PHASE_5_SCORE_FINDINGS",
    "PHASE_6_WRITE_REPORT",
    "PHASE_7_WRITE_SUMMARY",
    "PHASE_8_SELF_CHECK",
]);

const PATTERN_ANALYZER_PHASES = Object.freeze([
    "PHASE_0_CONFIG",
    "PHASE_1_RESOLVE_PATTERN",
    "PHASE_2_LOAD_CONTEXT",
    "PHASE_3_FIND_IMPLEMENTATIONS",
    "PHASE_4_ANALYZE_PATTERN",
    "PHASE_5_SCORE_GAPS",
    "PHASE_6_WRITE_REPORT",
    "PHASE_7_WRITE_SUMMARY",
    "PHASE_8_SELF_CHECK",
]);

const REPLACEMENT_RESEARCH_PHASES = Object.freeze([
    "PHASE_0_CONFIG",
    "PHASE_1_RESOLVE_SCOPE",
    "PHASE_2_LOAD_CONTEXT",
    "PHASE_3_DISCOVER_CUSTOM_MODULES",
    "PHASE_4_RESEARCH_ALTERNATIVES",
    "PHASE_5_COMPARE_RECOMMEND",
    "PHASE_6_WRITE_REPORT",
    "PHASE_7_WRITE_SUMMARY",
    "PHASE_8_SELF_CHECK",
]);

function mapSkills(skills, phases) {
    return Object.fromEntries(skills.map(skill => [skill, phases]));
}

export const WORKER_PHASES = Object.freeze({
    ...mapSkills([
        "ln-611", "ln-612", "ln-613", "ln-614",
        "ln-621", "ln-622", "ln-623", "ln-624", "ln-625", "ln-626", "ln-627", "ln-628", "ln-629",
        "ln-631", "ln-632", "ln-633", "ln-634", "ln-635", "ln-636", "ln-637",
        "ln-642", "ln-643", "ln-644", "ln-646", "ln-647",
        "ln-651", "ln-652", "ln-653", "ln-654",
    ], SCAN_ANALYZE_REPORT_PHASES),
    "ln-641": PATTERN_ANALYZER_PHASES,
    "ln-645": REPLACEMENT_RESEARCH_PHASES,
});

export function getWorkerPhases(skill) {
    return WORKER_PHASES[skill] || null;
}

