// Canonical STATUS/ACTION/REASON enums for hex-line response grammar.
// PROTOCOL.md §Response grammar uses the lowercase string values directly.
// server.mjs imports from here; do not duplicate enums elsewhere.

export const STATUS = {
    OK: "OK",
    ERROR: "ERROR",
    AUTO_REBASED: "AUTO_REBASED",
    CONFLICT: "CONFLICT",
    STALE: "STALE",
    INVALID: "INVALID",
    NO_CHANGES: "NO_CHANGES",
    CHANGED: "CHANGED",
    UNSUPPORTED: "UNSUPPORTED",
};

export const STATUS_VALUES = Object.freeze(Object.values(STATUS));

export const ACTION = {
    APPLY_RETRY_EDIT: "apply_retry_edit",
    APPLY_RETRY_BATCH: "apply_retry_batch",
    REREAD_THEN_RETRY: "reread_then_retry",
    INSPECT_SNIPPET: "inspect_snippet",
    KEEP_USING: "keep_using",
    REREAD_RANGE: "reread_range",
    REREAD_RANGES: "reread_ranges",
    FIX_INPUT: "fix_input",
    FIX_INPUTS: "fix_inputs",
    FIX_INPUT_OR_REREAD: "fix_input_or_reread",
    FIX_INPUTS_THEN_REREAD: "fix_inputs_then_reread",
    NO_ACTION: "no_action",
    INSPECT_FILE: "inspect_file",
    INSPECT_RAW_DIFF: "inspect_raw_diff",
    REVIEW_RISKS: "review_risks",
};

export const ACTION_VALUES = Object.freeze(Object.values(ACTION));

export const REASON = {
    EDIT_APPLIED: "edit_applied",
    EDIT_AUTO_REBASED: "edit_auto_rebased",
    DRY_RUN_PREVIEW: "dry_run_preview",
    CHECKSUMS_CURRENT: "checksums_current",
    CHECKSUMS_STALE: "checksums_stale",
    CHECKSUMS_INVALID: "checksums_invalid",
    DIRECTORY_CHANGED: "directory_changed",
    DIRECTORY_UNCHANGED: "directory_unchanged",
    FILE_CHANGED: "file_changed",
    FILE_UNCHANGED: "file_unchanged",
    SEMANTIC_DIFF_UNSUPPORTED: "semantic_diff_unsupported",
    BATCH_CONFLICT: "batch_conflict",
    MISSING_ANCHOR: "missing_anchor",
    CHECKSUM_COVERAGE_MISMATCH: "checksum_coverage_mismatch",
    OVERLAP_DETECTED: "overlap_detected",
};
