#!/usr/bin/env node

import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
import {
    EVAL_REPORT_PATH,
    assertToolCoverage,
    callTool,
    ensureDirs,
    setupGitRepo,
    stableJson,
    withFixture,
} from "../scripts/quality-lib.mjs";
import { TOOL_NAMES } from "../lib/constants.mjs";

const scenarios = [
    {
        tool: "index_hypotheses",
        description: "rebuilds the fixture SQLite index",
        params: root => ({ path: root }),
        expect(result) {
            assert.equal(result.structuredContent.status, "OK");
            assert.ok(result.structuredContent.summary.hypotheses >= 6);
        },
    },
    {
        tool: "verify_index",
        description: "validates fixture corpus without treating diagnostics as tool errors",
        params: root => ({ path: root }),
        expect(result) {
            assert.ok(["OK", "STALE"].includes(result.structuredContent.status));
            assert.equal(result.isError, undefined);
        },
    },
    {
        tool: "find_hypotheses",
        description: "finds live hypotheses with bounded rows",
        params: root => ({ path: root, status: "live", limit: 5 }),
        expect(result) {
            assert.equal(result.structuredContent.status, "OK");
            assert.ok(result.structuredContent.hypotheses.length >= 1);
            assert.ok(result.structuredContent.hypotheses.length <= 5);
        },
    },
    {
        tool: "inspect_hypothesis",
        description: "inspects one hypothesis with linked graph data",
        params: root => ({ path: root, id: "H01" }),
        expect(result) {
            assert.equal(result.structuredContent.hypothesis.id, "H01");
            assert.ok(result.structuredContent.summary.goals >= 1);
        },
    },
    {
        tool: "find_evidence",
        description: "finds evidence and cited sources",
        params: root => ({ path: root, id: "H01", limit: 10 }),
        expect(result) {
            assert.equal(result.structuredContent.status, "OK");
            assert.ok(result.structuredContent.summary.sources >= 1);
        },
    },
    {
        tool: "find_runs",
        description: "finds comprehensive benchmark runs",
        params: root => ({ path: root, comprehensive: true, limit: 5 }),
        expect(result) {
            assert.equal(result.structuredContent.status, "OK");
            assert.ok(result.structuredContent.runs.some(run => run.comprehensive));
        },
    },
    {
        tool: "trace_lineage",
        description: "returns bounded lineage graph",
        params: root => ({ path: root, id: "H01", direction: "both", depth: 2, limit: 25 }),
        expect(result) {
            assert.equal(result.structuredContent.status, "OK");
            assert.ok(result.structuredContent.summary.nodes <= 25);
            assert.ok(Array.isArray(result.structuredContent.edges));
        },
    },
    {
        tool: "analyze_topology",
        description: "summarizes topology without graph dump",
        params: root => ({ path: root, limit: 5 }),
        expect(result) {
            assert.equal(result.structuredContent.status, "OK");
            assert.ok(Object.hasOwn(result.structuredContent.summary.nodes, "hypothesis"));
            assert.ok(result.structuredContent.hubs.length <= 5);
        },
    },
    {
        tool: "audit_orphans",
        description: "audits drift and task/refine gaps",
        params: root => ({ path: root, limit: 100 }),
        expect(result) {
            assert.ok(["OK", "STALE"].includes(result.structuredContent.status));
            assert.ok(result.structuredContent.summary.categories.includes("implementation_gap"));
            assert.ok(result.structuredContent.summary.categories.includes("status_verdict_drift"));
        },
    },
    {
        tool: "analyze_progress",
        description: "detects changed research files through git diff",
        before: setupGitRepo,
        params: root => ({ path: root }),
        expect(result) {
            assert.equal(result.structuredContent.status, "OK");
            assert.ok(result.structuredContent.summary.relevant_files >= 1);
        },
    },
    {
        tool: "analyze_proposed",
        description: "checks proposal readiness gaps",
        params: root => ({ path: root, id: "H01" }),
        expect(result) {
            assert.ok(["OK", "STALE"].includes(result.structuredContent.status));
            assert.equal(result.structuredContent.proposal.id, "H01");
        },
    },
    {
        tool: "inspect_goal",
        description: "inspects one goal and linked hypotheses",
        params: root => ({ path: root, id: "G1" }),
        expect(result) {
            assert.equal(result.structuredContent.goal.id, "G1");
            assert.ok(result.structuredContent.hypotheses.length >= 1);
        },
    },
    {
        tool: "trace_goal_tree",
        description: "returns bounded goal tree",
        params: root => ({ path: root, id: "G1", limit: 25 }),
        expect(result) {
            assert.equal(result.structuredContent.status, "OK");
            assert.ok(result.structuredContent.summary.goals <= 25);
        },
    },
    {
        tool: "audit_goal_alignment",
        description: "audits goal coverage and comprehensive metrics",
        params: root => ({ path: root, limit: 100 }),
        expect(result) {
            assert.ok(["OK", "STALE"].includes(result.structuredContent.status));
            assert.ok(Array.isArray(result.structuredContent.issues));
        },
    },
    {
        tool: "export_canvas",
        description: "exports bounded JSON Canvas in dry-run mode",
        params: root => ({ path: root, dry_run: true, mode: "merge" }),
        expect(result) {
            assert.equal(result.structuredContent.status, "OK");
            assert.equal(result.structuredContent.summary.dry_run, true);
            assert.ok(result.structuredContent.canvas.nodes.length >= 1);
        },
    },
    {
        tool: "export_research_map",
        description: "exports generated research-map markdown in dry-run mode",
        params: root => ({ path: root, dry_run: true }),
        expect(result) {
            assert.equal(result.structuredContent.status, "OK");
            assert.equal(result.structuredContent.summary.dry_run, true);
            assert.match(result.structuredContent.markdown, /HEX_RESEARCH_GENERATED/);
        },
    },
];

function runScenario(scenario) {
    return withFixture(`eval-${scenario.tool}`, (root) => {
        if (scenario.before) scenario.before(root);
        if (scenario.tool !== "index_hypotheses" && scenario.tool !== "verify_index") {
            callTool("index_hypotheses", { path: root });
        }
        const result = callTool(scenario.tool, scenario.params(root));
        scenario.expect(result);
        const outputChars = result.content[0].text.length;
        return {
            tool: scenario.tool,
            description: scenario.description,
            status: "verified",
            output_status: result.structuredContent.status,
            key_fields: Object.keys(result.structuredContent).sort(),
            bounded: outputChars < 100_000,
            structured_mirror: true,
        };
    });
}

ensureDirs();
assertToolCoverage(scenarios.map(scenario => scenario.tool));

const results = scenarios.map(runScenario);
const report = {
    generated_at: "fixture-deterministic",
    tool_count: TOOL_NAMES.length,
    scenario_count: results.length,
    status: "verified",
    results,
};

writeFileSync(EVAL_REPORT_PATH, stableJson(report), "utf8");

for (const result of results) {
    console.log(`${result.tool}: ${result.output_status} (${result.bounded ? "bounded" : "unbounded"})`);
}
console.log(`evals: ${results.length}/${TOOL_NAMES.length} tools verified`);

if (process.argv.includes("--check")) {
    assert.equal(results.length, TOOL_NAMES.length);
    assert.ok(results.every(result => result.status === "verified"));
}
