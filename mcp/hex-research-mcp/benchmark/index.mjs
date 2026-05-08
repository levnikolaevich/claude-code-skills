#!/usr/bin/env node

import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
import {
    BENCHMARK_MARKDOWN_PATH,
    BENCHMARK_REPORT_PATH,
    baselineCorpusStats,
    callTool,
    ensureDirs,
    stableJson,
    textStats,
    withFixture,
} from "../scripts/quality-lib.mjs";

const methodology = "Rough deterministic estimate: baseline reads all Markdown/YAML/JSON fixture research files; workflow output is JSON.stringify(structuredContent); estimated tokens = ceil(chars / 4). This is not production tokenizer accuracy.";

const workflows = [
    {
        id: "find_live_hypotheses",
        label: "Find live hypotheses",
        run(root) {
            return [callTool("find_hypotheses", { path: root, status: "live", limit: 10 }).structuredContent];
        },
    },
    {
        id: "find_pending_implementation",
        label: "Find pending implementation",
        run(root) {
            return [callTool("find_hypotheses", { path: root, status: "pending_implementation", limit: 10 }).structuredContent];
        },
    },
    {
        id: "inspect_goal",
        label: "Inspect goal",
        run(root) {
            return [callTool("inspect_goal", { path: root, id: "G1" }).structuredContent];
        },
    },
    {
        id: "trace_lineage",
        label: "Trace lineage",
        run(root) {
            return [callTool("trace_lineage", { path: root, id: "H01", direction: "both", depth: 3, limit: 50 }).structuredContent];
        },
    },
    {
        id: "audit_drift_refine_gaps",
        label: "Audit drift/refine gaps",
        run(root) {
            return [callTool("audit_orphans", { path: root, limit: 100 }).structuredContent];
        },
    },
];

function markdownReport(report) {
    const lines = [
        "# hex-research-mcp Benchmark Report",
        "",
        report.methodology,
        "",
        `Baseline: ${report.baseline.file_count} files, ${report.baseline.chars} chars, ${report.baseline.estimated_tokens} estimated tokens.`,
        "",
        "| Workflow | MCP chars | MCP estimated tokens | Estimated savings |",
        "|---|---:|---:|---:|",
    ];
    for (const workflow of report.workflows) {
        lines.push(`| ${workflow.label} | ${workflow.output.chars} | ${workflow.output.estimated_tokens} | ${workflow.estimated_savings_percent.toFixed(1)}% |`);
    }
    lines.push("");
    return `${lines.join("\n")}\n`;
}

ensureDirs();

const report = withFixture("benchmark", (root) => {
    const baseline = baselineCorpusStats(root);
    callTool("index_hypotheses", { path: root });
    const results = workflows.map((workflow) => {
        const payload = workflow.run(root);
        const output = textStats(JSON.stringify(payload));
        const estimatedSavingsPercent = ((baseline.estimated_tokens - output.estimated_tokens) / baseline.estimated_tokens) * 100;
        return {
            id: workflow.id,
            label: workflow.label,
            baseline_tokens: baseline.estimated_tokens,
            output,
            estimated_savings_percent: Number(estimatedSavingsPercent.toFixed(1)),
        };
    });
    return {
        generated_at: "fixture-deterministic",
        methodology,
        baseline,
        workflows: results,
        summary: {
            workflow_count: results.length,
            average_estimated_savings_percent: Number((results.reduce((sum, row) => sum + row.estimated_savings_percent, 0) / results.length).toFixed(1)),
        },
    };
});

assert.equal(report.workflows.length, workflows.length);
assert.ok(report.methodology.includes("not production tokenizer accuracy"));

writeFileSync(BENCHMARK_REPORT_PATH, stableJson(report), "utf8");
writeFileSync(BENCHMARK_MARKDOWN_PATH, markdownReport(report), "utf8");

for (const workflow of report.workflows) {
    console.log(`${workflow.id}: ${workflow.output.estimated_tokens} estimated tokens, ${workflow.estimated_savings_percent.toFixed(1)}% savings`);
}
console.log(`benchmark: ${report.workflows.length} workflows, ${report.summary.average_estimated_savings_percent.toFixed(1)}% avg estimated savings`);
