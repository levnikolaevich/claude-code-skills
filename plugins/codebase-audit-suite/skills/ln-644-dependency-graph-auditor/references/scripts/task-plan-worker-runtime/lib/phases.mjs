export const WORKER_PHASES = Object.freeze({
    "ln-301": Object.freeze([
        "PHASE_0_CONFIG",
        "PHASE_1_LOAD_INPUTS",
        "PHASE_2_LOAD_CONTEXT",
        "PHASE_3_GENERATE_TASK_DOCS",
        "PHASE_4_VALIDATE_TASKS",
        "PHASE_5_CONFIRM_OR_AUTOAPPROVE",
        "PHASE_6_APPLY_CREATE",
        "PHASE_7_UPDATE_KANBAN",
        "PHASE_8_WRITE_SUMMARY",
        "PHASE_9_SELF_CHECK",
    ]),
    "ln-302": Object.freeze([
        "PHASE_0_CONFIG",
        "PHASE_1_LOAD_INPUTS",
        "PHASE_2_LOAD_EXISTING_TASKS",
        "PHASE_3_NORMALIZE_AND_CLASSIFY",
        "PHASE_4_CONFIRM_OR_AUTOAPPROVE",
        "PHASE_5_APPLY_REPLAN",
        "PHASE_6_UPDATE_KANBAN",
        "PHASE_7_WRITE_SUMMARY",
        "PHASE_8_SELF_CHECK",
    ]),
});

export function getWorkerPhases(skill) {
    return WORKER_PHASES[skill] || null;
}
