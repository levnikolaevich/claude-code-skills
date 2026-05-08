#!/usr/bin/env node

const version = typeof __HEX_VERSION__ !== "undefined" ? __HEX_VERSION__
    : (await import("node:module")).createRequire(import.meta.url)("./package.json").version;

import { z } from "zod";
import { flexLimit } from "@levnikolaevich/hex-common/runtime/schema";
import { createServerRuntime } from "@levnikolaevich/hex-common/runtime/mcp-bootstrap";
import {
    DESTRUCTIVE_IDEMPOTENT_ANNOTATIONS,
    DESTRUCTIVE_NON_IDEMPOTENT_ANNOTATIONS,
    READ_ONLY_ANNOTATIONS,
    registerStructuredTool,
} from "@levnikolaevich/hex-common/runtime/structured-tools";
import { checkForUpdates } from "@levnikolaevich/hex-common/runtime/update-check";
import { closeAllStores } from "./lib/store.mjs";
import { BaseOutputSchema } from "./lib/schemas.mjs";
import {
    analyzeProgress,
    analyzeProposed,
    analyzeTopology,
    auditGoalAlignment,
    auditOrphans,
    exportCanvas,
    exportResearchMap,
    findEvidence,
    findHypotheses,
    findRuns,
    indexHypotheses,
    inspectGoal,
    inspectHypothesis,
    normalizeToolError,
    traceGoalTree,
    traceLineage,
    verifyIndex,
} from "./lib/tools.mjs";

const { server, StdioServerTransport } = await createServerRuntime({
    name: "hex-research-mcp",
    version,
});

process.once("beforeExit", closeAllStores);

const PathSchema = z.object({
    path: z.string().optional().describe("Project root containing docs/hypotheses, docs/goals, and benchmark/runs"),
}).strict();

const Limit = flexLimit();

const SelectorSchema = z.object({
    path: z.string().optional().describe("Indexed project root"),
    id: z.string().optional().describe("Canonical H## or G## id"),
    claim_substring: z.string().optional().describe("Fallback selector by claim substring"),
}).strict();

const ReadOnly = READ_ONLY_ANNOTATIONS;

function tool(name, spec, handler, { errorStatuses = ["ERROR"] } = {}) {
    registerStructuredTool(server, name, spec, handler, {
        outputSchema: BaseOutputSchema,
        errorStatuses,
        normalizeError: normalizeToolError,
    });
}

tool("index_hypotheses", {
    title: "Index Hypotheses",
    description: "Rebuild the local SQLite research graph from docs/hypotheses, docs/goals, and benchmark run manifests.",
    inputSchema: PathSchema,
    annotations: DESTRUCTIVE_IDEMPOTENT_ANNOTATIONS,
}, indexHypotheses, { errorStatuses: ["INVALID", "UNSUPPORTED", "ERROR"] });

tool("verify_index", {
    title: "Verify Research Index Inputs",
    description: "Validate research frontmatter and run manifests without rebuilding the SQLite index.",
    inputSchema: PathSchema,
    annotations: ReadOnly,
}, verifyIndex);

tool("find_hypotheses", {
    title: "Find Hypotheses",
    description: "Search indexed hypotheses by status, goal, task state, source type/year, priority tier, or claim text.",
    inputSchema: z.object({
        path: z.string().optional().describe("Indexed project root"),
        status: z.string().optional().describe("Hypothesis status filter"),
        goal: z.string().optional().describe("Goal id filter, e.g. G1"),
        task_state: z.enum(["open", "in_progress", "done", "cancelled"]).optional().describe("Linked task state filter"),
        cited_source_type: z.enum(["paper", "video", "website", "book", "podcast", "code", "dataset", "archive"]).optional().describe("Cited source type filter"),
        cited_source_year_min: z.union([z.number(), z.string()]).optional().describe("Minimum cited source year"),
        priority_tier: z.union([z.number(), z.string()]).optional().describe("Priority tier filter"),
        claim_substring: z.string().optional().describe("Case-insensitive claim substring"),
        limit: Limit.describe("Maximum hypotheses to return"),
    }).strict(),
    annotations: ReadOnly,
}, findHypotheses);

tool("inspect_hypothesis", {
    title: "Inspect Hypothesis",
    description: "Return a bounded structured view of one hypothesis, including goals, tasks, evidence, runs, sources, and edges.",
    inputSchema: SelectorSchema,
    annotations: ReadOnly,
}, inspectHypothesis);

tool("find_evidence", {
    title: "Find Evidence",
    description: "Find evidence entries and cited sources, optionally scoped to one hypothesis and source/evidence type.",
    inputSchema: z.object({
        path: z.string().optional().describe("Indexed project root"),
        id: z.string().optional().describe("Hypothesis id"),
        type: z.string().optional().describe("Evidence or source type"),
        limit: Limit.describe("Maximum rows to return"),
    }).strict(),
    annotations: ReadOnly,
}, findEvidence);

tool("find_runs", {
    title: "Find Runs",
    description: "Find targeted or explicit comprehensive benchmark runs by run id, hypothesis id, type, and comprehensive flag; goal metrics derive only from explicit comprehensive runs.",
    inputSchema: z.object({
        path: z.string().optional().describe("Indexed project root"),
        id: z.string().optional().describe("Run id"),
        hypothesis: z.string().optional().describe("Hypothesis id for targeted runs"),
        type: z.string().optional().describe("Run type"),
        comprehensive: z.boolean().optional().describe("Filter comprehensive runs"),
        limit: Limit.describe("Maximum rows to return"),
    }).strict(),
    annotations: ReadOnly,
}, findRuns);

tool("trace_lineage", {
    title: "Trace Lineage",
    description: "Trace bounded hypothesis lineage and dependency edges around a hypothesis id.",
    inputSchema: z.object({
        path: z.string().optional().describe("Indexed project root"),
        id: z.string().describe("Starting hypothesis id"),
        direction: z.enum(["in", "out", "both"]).optional().describe("Traversal direction"),
        depth: z.union([z.number(), z.string()]).optional().describe("Maximum traversal depth"),
        limit: Limit.describe("Maximum nodes to return"),
    }).strict(),
    annotations: ReadOnly,
}, traceLineage);

tool("analyze_topology", {
    title: "Analyze Topology",
    description: "Summarize graph node/edge counts and high-degree hubs without dumping the full graph.",
    inputSchema: z.object({
        path: z.string().optional().describe("Indexed project root"),
        limit: Limit.describe("Maximum hub rows to return"),
    }).strict(),
    annotations: ReadOnly,
}, analyzeTopology);

tool("audit_orphans", {
    title: "Audit Orphans",
    description: "Audit orphaned, stale, missing-evidence, missing-source, dead-branch, task, and goal-run gaps.",
    inputSchema: z.object({
        path: z.string().optional().describe("Indexed project root"),
        limit: Limit.describe("Maximum issues to return"),
    }).strict(),
    annotations: ReadOnly,
}, auditOrphans);

tool("inspect_goal", {
    title: "Inspect Goal",
    description: "Return a bounded structured view of one goal, including parent/child goals, linked hypotheses, and derived metrics_current provenance or missing-metrics reason.",
    inputSchema: SelectorSchema,
    annotations: ReadOnly,
}, inspectGoal);

tool("trace_goal_tree", {
    title: "Trace Goal Tree",
    description: "Trace the bounded goal decomposition tree around one goal id.",
    inputSchema: z.object({
        path: z.string().optional().describe("Indexed project root"),
        id: z.string().describe("Starting goal id"),
        limit: Limit.describe("Maximum goals to return"),
    }).strict(),
    annotations: ReadOnly,
}, traceGoalTree);

tool("audit_goal_alignment", {
    title: "Audit Goal Alignment",
    description: "Audit hypothesis-goal links, active goals without live hypotheses, goals missing explicit comprehensive-run metrics, and coverage candidates.",
    inputSchema: z.object({
        path: z.string().optional().describe("Indexed project root"),
        limit: Limit.describe("Maximum issues to return"),
    }).strict(),
    annotations: ReadOnly,
}, auditGoalAlignment);

tool("analyze_progress", {
    title: "Analyze Progress",
    description: "Use git diff to identify changed research graph files and field-level frontmatter deltas that should be verified or reindexed.",
    inputSchema: z.object({
        path: z.string().optional().describe("Project root"),
        compare_against: z.string().optional().describe('Git ref to compare against, default "HEAD"'),
    }).strict(),
    annotations: ReadOnly,
}, analyzeProgress);

tool("analyze_proposed", {
    title: "Analyze Proposed Hypothesis",
    description: "Check one indexed hypothesis for readiness gaps before promotion or implementation.",
    inputSchema: SelectorSchema,
    annotations: ReadOnly,
}, analyzeProposed);

tool("export_canvas", {
    title: "Export JSON Canvas",
    description: "Export a bounded JSON Canvas map of goals, hypotheses, runs, and their relationships.",
    inputSchema: z.object({
        path: z.string().optional().describe("Indexed project root"),
        output_path: z.string().optional().describe('Canvas path relative to project root, default "docs/research-map.canvas"'),
        mode: z.enum(["merge", "overwrite"]).optional().describe("merge preserves existing node positions; overwrite creates a fresh layout"),
        dry_run: z.boolean().optional().describe("Preview canvas JSON without writing the file"),
    }).strict(),
    annotations: DESTRUCTIVE_NON_IDEMPOTENT_ANNOTATIONS,
}, exportCanvas);

tool("export_research_map", {
    title: "Export Research Map Markdown",
    description: "Generate docs/research-map.md from canonical split researchgraph files. Dry-run by default; refuses unmarked legacy overwrite unless force is true.",
    inputSchema: z.object({
        path: z.string().optional().describe("Indexed project root"),
        output_path: z.string().optional().describe('Markdown path relative to project root, default "docs/research-map.md"'),
        dry_run: z.boolean().optional().describe("Preview generated markdown without writing; default true"),
        force: z.boolean().optional().describe("Allow replacing an unmarked legacy research-map.md after dry-run review"),
    }).strict(),
    annotations: DESTRUCTIVE_NON_IDEMPOTENT_ANNOTATIONS,
}, exportResearchMap, { errorStatuses: ["UNSUPPORTED", "ERROR"] });

const transport = new StdioServerTransport();
await server.connect(transport);
void checkForUpdates("@levnikolaevich/hex-research-mcp", version);
