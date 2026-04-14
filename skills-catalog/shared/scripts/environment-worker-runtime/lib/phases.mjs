export const WORKER_PHASES = Object.freeze({
    "ln-011": Object.freeze([
        "PHASE_0_CONFIG",
        "PHASE_1_INSTALL_VERIFY",
        "PHASE_2_POST_GEMINI_CONFIG",
        "PHASE_3_POST_CODEX_SANITY_CHECK",
        "PHASE_4_WRITE_SUMMARY",
        "PHASE_5_SELF_CHECK",
    ]),
    "ln-012": Object.freeze([
        "PHASE_0_CONFIG",
        "PHASE_1_CHECK_STATUS_AND_VERSION",
        "PHASE_2_REGISTER_AND_CONFIGURE",
        "PHASE_3_VERIFY_GRAPH_PROVIDER_DEPS",
        "PHASE_4_HOOKS_AND_OUTPUT_STYLE",
        "PHASE_5_GRAPH_INDEXING",
        "PHASE_6_MIGRATE_ALLOWED_TOOLS",
        "PHASE_7_PERMISSION_SURFACES",
        "PHASE_8_WRITE_SUMMARY",
        "PHASE_9_SELF_CHECK",
    ]),
    "ln-013": Object.freeze([
        "PHASE_0_CONFIG",
        "PHASE_1_DISCOVER_STATE",
        "PHASE_2_SYNC_SKILLS_MAPPING",
        "PHASE_3_SYNC_MCP_SETTINGS",
        "PHASE_4_SYNC_HOOKS_AND_POLICY",
        "PHASE_4A_MCP_PROVIDER_CHECK",
        "PHASE_5_WRITE_SUMMARY",
        "PHASE_6_SELF_CHECK",
    ]),
    "ln-014": Object.freeze([
        "PHASE_0_CONFIG",
        "PHASE_1_DISCOVER_FILES",
        "PHASE_2_CREATE_MISSING_FILES",
        "PHASE_3_TOKEN_BUDGET_AUDIT",
        "PHASE_4_PROMPT_CACHE_SAFETY",
        "PHASE_5_CONTENT_QUALITY",
        "PHASE_6_CROSS_AGENT_CONSISTENCY",
        "PHASE_7_WRITE_SUMMARY",
        "PHASE_8_SELF_CHECK",
    ]),
    "ln-015": Object.freeze([
        "PHASE_0_CONFIG",
        "PHASE_1_RESOLVE_CLAUDE_STATE",
        "PHASE_2_REMOVE_HEXLINE_REGISTRATION",
        "PHASE_3_REMOVE_HEXLINE_ARTIFACTS",
        "PHASE_4_VERIFY_CLEANUP",
        "PHASE_5_WRITE_SUMMARY",
        "PHASE_6_SELF_CHECK",
    ]),
});

export function getWorkerPhases(skill) {
    return WORKER_PHASES[skill] || null;
}
