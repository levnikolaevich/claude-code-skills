export const RESEARCHGRAPH_DIR = ".hex-skills/researchgraph";
export const DB_RELATIVE_PATH = `${RESEARCHGRAPH_DIR}/index.db`;

export const STATUS_VALUES = ["OK", "ERROR", "INVALID", "UNSUPPORTED", "NO_CHANGES", "CHANGED", "STALE"];
export const NEXT_ACTIONS = [
    "none",
    "fix_frontmatter",
    "fix_path",
    "index_project",
    "inspect_hypothesis",
    "inspect_goal",
    "find_hypotheses",
    "find_runs",
    "trace_lineage",
    "trace_goal_tree",
    "review_warnings",
    "merge_canvas",
    "export_research_map",
    "widen_query",
];

export const HYPOTHESIS_STATUSES = [
    "not_started",
    "in_progress",
    "validated_branch",
    "pending_implementation",
    "live",
    "rejected",
    "deferred",
    "mixed",
];

export const GOAL_STATUSES = ["active", "achieved", "paused", "abandoned"];
export const TASK_STATES = ["open", "in_progress", "done", "cancelled"];
export const TASK_TYPES = ["implementation", "refinement", "research", "rollback"];

export const TOOL_NAMES = [
    "index_hypotheses",
    "verify_index",
    "find_hypotheses",
    "inspect_hypothesis",
    "find_evidence",
    "find_runs",
    "trace_lineage",
    "analyze_topology",
    "audit_orphans",
    "analyze_progress",
    "analyze_proposed",
    "inspect_goal",
    "trace_goal_tree",
    "audit_goal_alignment",
    "export_canvas",
    "export_research_map",
];
