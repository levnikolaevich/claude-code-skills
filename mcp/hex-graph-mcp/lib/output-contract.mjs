export const STATUS = {
    OK: "OK",
    PARTIAL: "PARTIAL",
    NOT_FOUND: "NOT_FOUND",
    STALE: "STALE",
    ERROR: "ERROR",
};

export const ACTION = {
    INSPECT_SYMBOL: "inspect_symbol",
    FIND_REFERENCES: "find_references",
    FIND_IMPLEMENTATIONS: "find_implementations",
    TRACE_PATHS: "trace_paths",
    TRACE_DATAFLOW: "trace_dataflow",
    API_IMPACT: "api_impact",
    DIAGNOSE_GRAPH: "diagnose_graph",
    ANALYZE_CHANGES: "analyze_changes",
    AUDIT_WORKSPACE: "audit_workspace",
    ANALYZE_EDIT_REGION: "analyze_edit_region",
    INDEX_PROJECT: "index_project",
    WIDEN_QUERY: "widen_query",
    WIDEN_RANGE: "widen_range",
    REVIEW_DELETED_API: "review_deleted_api",
    REVIEW_DUPLICATES: "review_duplicates",
    FIX_DB_LOCK: "fix_db_lock",
    FIX_DB_ACCESS: "fix_db_access",
    FIX_PATH: "fix_path",
    CHECK_PROVIDER_SETUP: "check_provider_setup",
    CHECK_SCIP_INPUTS: "check_scip_inputs",
    ADJUST_QUERY: "adjust_query",
};

export function nextActions(actions) {
    return [...new Set((actions || []).filter(Boolean))];
}

export function pruneEmpty(value) {
    if (Array.isArray(value)) {
        const items = value.map(pruneEmpty).filter((item) => item !== undefined);
        return items.length ? items : undefined;
    }
    if (value && typeof value === "object") {
        const entries = Object.entries(value)
            .map(([key, entryValue]) => [key, pruneEmpty(entryValue)])
            .filter(([, entryValue]) => entryValue !== undefined);
        return entries.length ? Object.fromEntries(entries) : undefined;
    }
    if (value === null || value === undefined) return undefined;
    return value;
}
