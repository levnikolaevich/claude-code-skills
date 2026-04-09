#!/usr/bin/env node
/**
 * Hex-line workflow benchmark with optional diagnostics.
 *
 * Reports hex-line multi-step workflow metrics (chars + ops).
 * Synthetic tool-level scenarios are available behind --diagnostics.
 *
 * Usage:
 *   node mcp/hex-line-mcp/scenarios/index.mjs [--repo /path/to/repo]
 *   node mcp/hex-line-mcp/scenarios/index.mjs --diagnostics [--with-graph]
 */

import { writeFileSync, unlinkSync } from "node:fs";
import { resolve, basename } from "node:path";
import { tmpdir } from "node:os";
import {
    walkDir, getFileLines, categorize, generateTempCode,
    fmt, RUNS,
} from "../lib/scenario-helpers.mjs";
import { runAtomic } from "./atomic.mjs";
import { runGraph } from "./graph.mjs";
import { runWorkflows } from "./workflows.mjs";

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

const args = process.argv.slice(2);
let repoRoot = process.cwd();
const repoIdx = args.indexOf("--repo");
if (repoIdx !== -1 && args[repoIdx + 1]) {
    repoRoot = resolve(args[repoIdx + 1]);
}

const diagnostics = args.includes("--diagnostics");
const withGraph = args.includes("--with-graph");

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
    const allFiles = walkDir(repoRoot);
    if (allFiles.length === 0) {
        console.log(`No code files found in ${repoRoot}`);
        process.exit(1);
    }

    const totalLines = allFiles.reduce((sum, f) => {
        const lines = getFileLines(f);
        return lines ? sum + lines.length : sum;
    }, 0);

    const cats = categorize(allFiles);
    const repoName = basename(repoRoot);

    // Top 3 largest code files for realistic tests
    const sorted = allFiles.map(f => ({ f, lines: getFileLines(f)?.length || 0 }))
        .sort((a, b) => b.lines - a.lines);
    const largeFiles = sorted.slice(0, 3).map(s => s.f);

    // Temp file setup
    const ts = Date.now();
    const tmpPath = resolve(tmpdir(), `hex-line-bench-${ts}.js`);
    const tmpLines = generateTempCode();
    const tmpContent = tmpLines.join("\n");
    writeFileSync(tmpPath, tmpContent, "utf-8");

    // Build config shared across all benchmark modules
    const config = { allFiles, cats, largeFiles, tmpPath, tmpContent, tmpLines, repoRoot, ts };

    // Run benchmark suites
    const workflowResults = await runWorkflows(config);
    const results = diagnostics ? await runAtomic(config) : [];
    const graphOut = diagnostics && withGraph ? await runGraph(config) : [];

    // Cleanup
    try { unlinkSync(tmpPath); } catch { /* ok */ }

    // ===================================================================
    // Report
    // ===================================================================
    const out = [];
    out.push("# Hex-line Workflow Benchmark");
    out.push("");
    out.push(`Repository: ${repoName} (${fmt(allFiles.length)} code files, ${fmt(totalLines)} lines)  `);
    out.push(`Temp file: ${tmpPath} (200 lines)  `);
    out.push(`Date: ${new Date().toISOString().slice(0, 10)}  `);
    out.push(`Runs per scenario: ${RUNS} (median)  `);
    out.push("");
    out.push("Mode: hex-line workflow benchmark");
    out.push("");
    out.push("## Workflow Scenarios");
    out.push("");
    out.push("| # | Scenario | Chars | Ops |");
    out.push("|---|----------|-------|-----|");
    for (const w of workflowResults) {
        out.push(`| ${w.id} | ${w.scenario} | ${fmt(w.chars)} | ${w.ops} |`);
    }
    out.push("");

    if (workflowResults.length > 0) {
        const totalChars = workflowResults.reduce((sum, w) => sum + w.chars, 0);
        const totalOps = workflowResults.reduce((sum, w) => sum + w.ops, 0);
        out.push(`Workflow summary: ${fmt(totalChars)} total chars | ${totalOps} total ops across ${workflowResults.length} scenarios`);
        out.push("");
    }

    out.push("Note: benchmark reports hex-line multi-step workflows. Synthetic tool-level scenarios live under --diagnostics.");
    out.push("");

    if (diagnostics) {
        out.push("## Diagnostics");
        out.push("");
        out.push("These rows are hex-line tool-level metrics for engineering inspection only. They are not part of the public workflow benchmark score.");
        out.push("");
        out.push("| # | Scenario | Chars | Latency |");
        out.push("|---|----------|-------|---------|");
        for (const r of results) {
            out.push(`| ${r.num} | ${r.scenario} | ${fmt(r.chars)} | ${r.latency} ms |`);
        }
        out.push("");
        if (graphOut.length > 0) {
            out.push("### Graph Enrichment Diagnostics");
            out.push("");
            out.push("Graph-enrichment rows remain diagnostics only. Read the graph table as payload overhead versus follow-up tool calls avoided; it is not a compression score.");
            out.push("");
            out.push(...graphOut);
            out.push("");
        }
    }

    console.log(out.join("\n"));
}

main();
