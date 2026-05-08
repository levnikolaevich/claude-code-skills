#!/usr/bin/env node

import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import {
    BENCHMARK_REPORT_PATH,
    EVAL_REPORT_PATH,
    PACKAGE_ROOT,
    QUALITY_REPORT_PATH,
    QUALITY_SUMMARY_PATH,
    TOOL_MANIFEST_PATH,
    assertToolCoverage,
    compareOrWrite,
    ensureDirs,
    readJson,
    stableJson,
} from "./quality-lib.mjs";
import { TOOL_NAMES } from "../lib/constants.mjs";

const check = process.argv.includes("--check");

function runGeneratedInputs() {
    execFileSync(process.execPath, ["evals/index.mjs"], { cwd: PACKAGE_ROOT, stdio: "inherit" });
    execFileSync(process.execPath, ["benchmark/index.mjs"], { cwd: PACKAGE_ROOT, stdio: "inherit" });
}

function buildSummary(report) {
    const lines = [
        "## Quality Snapshot",
        "",
        report.release_readiness,
        "",
        "| Metric | Value |",
        "|---|---:|",
        `| MCP tools covered | ${report.summary.tools_verified}/${report.summary.tools_total} |`,
        `| Eval scenarios | ${report.summary.eval_scenarios} |`,
        `| Benchmark workflows | ${report.summary.benchmark_workflows} |`,
        `| Avg estimated benchmark savings | ${report.summary.average_estimated_savings_percent.toFixed(1)}% |`,
        "",
        `Methodology: ${report.methodology}`,
        "",
        "| Tool | Risk | Eval | Test source |",
        "|---|---|---|---|",
    ];
    for (const tool of report.tools) {
        lines.push(`| ${tool.name} | ${tool.risk} | ${tool.eval_status} | ${tool.test_source} |`);
    }
    lines.push("");
    return `${lines.join("\n")}`;
}

ensureDirs();
runGeneratedInputs();

const manifest = readJson(TOOL_MANIFEST_PATH);
const evalReport = readJson(EVAL_REPORT_PATH);
const benchmarkReport = readJson(BENCHMARK_REPORT_PATH);
const tools = manifest.tools;

assertToolCoverage(tools.map(tool => tool.name));
assertToolCoverage(evalReport.results.map(result => result.tool));
assert.equal(evalReport.scenario_count, TOOL_NAMES.length);
assert.equal(benchmarkReport.workflows.length, 5);
assert.ok(benchmarkReport.methodology.includes("not production tokenizer accuracy"));

const evalByTool = new Map(evalReport.results.map(result => [result.tool, result]));
const mergedTools = tools.map((tool) => {
    const evalResult = evalByTool.get(tool.name);
    assert.ok(evalResult, `missing eval result for ${tool.name}`);
    return {
        ...tool,
        eval_status: evalResult.status,
        output_status: evalResult.output_status,
        bounded: evalResult.bounded,
        structured_mirror: evalResult.structured_mirror,
    };
});

const report = {
    generated_at: "fixture-deterministic",
    release_readiness: "Release readiness: Server MVP verified on deterministic fixtures with npm packaging enabled. btc-trader migration, Phase 7 pull-up, and skill packaging remain out of scope for this snapshot.",
    methodology: "evals call every registered tool against test/fixtures/project with deterministic assertions and structuredContent/text mirror checks. Benchmark token counts are rough ceil(chars / 4) estimates, not production tokenizer measurements.",
    summary: {
        tools_total: TOOL_NAMES.length,
        tools_verified: mergedTools.filter(tool => tool.eval_status === "verified").length,
        eval_scenarios: evalReport.scenario_count,
        benchmark_workflows: benchmarkReport.workflows.length,
        average_estimated_savings_percent: benchmarkReport.summary.average_estimated_savings_percent,
    },
    tools: mergedTools,
    eval_report: "evals/report.json",
    benchmark_report: "benchmark/report.json",
};

assert.equal(report.summary.tools_verified, TOOL_NAMES.length);

const reportContent = stableJson(report);
const summaryContent = buildSummary(report);

compareOrWrite(QUALITY_REPORT_PATH, reportContent, { check });
compareOrWrite(QUALITY_SUMMARY_PATH, summaryContent, { check });

console.log(`quality: ${report.summary.tools_verified}/${report.summary.tools_total} tools, ${report.summary.eval_scenarios} eval scenarios`);
