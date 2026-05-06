export const BENCHMARK_WORKER_PHASES = Object.freeze([
    "PHASE_0_CONFIG",
    "PHASE_1_PREFLIGHT",
    "PHASE_2_LOAD_SUITE",
    "PHASE_3_RUN_SCENARIOS",
    "PHASE_4_PARSE_RESULTS",
    "PHASE_5_WRITE_REPORT",
    "PHASE_6_WRITE_SUMMARY",
    "PHASE_7_SELF_CHECK",
]);

export function getWorkerPhases(skill) {
    if (skill === "ln-840-benchmark-compare") {
        return BENCHMARK_WORKER_PHASES;
    }
    return null;
}
