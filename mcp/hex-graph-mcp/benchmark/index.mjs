#!/usr/bin/env node
/**
 * Hex-graph workflow benchmark with optional diagnostics.
 *
 * Public benchmark mode reports only comparative multi-step workflows.
 * Atomic scenarios and amortization numbers are diagnostics, not headline
 * benchmark results.
 *
 * Prerequisites: .hex-skills/codegraph/index.db must exist. Run hex-graph index_project first.
 * Usage:
 *   node benchmark/index.mjs [--repo /path/to/repo]
 *   node benchmark/index.mjs --diagnostics [--repo /path/to/repo]
 */

import { existsSync } from "node:fs";
import { resolve, basename } from "node:path";
import { getStore } from "../lib/store.mjs";
import { fmt, pctSavings, walkDir, git } from "./helpers.mjs";
import { runAtomic } from "./atomic.mjs";
import { runWorkflows } from "./workflows.mjs";
import { runAmortization } from "./amortization.mjs";

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

const args = process.argv.slice(2);
let repoRoot = process.cwd();
const repoIdx = args.indexOf("--repo");
if (repoIdx !== -1 && args[repoIdx + 1]) repoRoot = resolve(args[repoIdx + 1]);
const diagnostics = args.includes("--diagnostics");
const baseRefIdx = args.indexOf("--base-ref");
const headRefIdx = args.indexOf("--head-ref");
let prBaseRef = baseRefIdx !== -1 && args[baseRefIdx + 1] ? args[baseRefIdx + 1] : null;
let prHeadRef = headRefIdx !== -1 && args[headRefIdx + 1] ? args[headRefIdx + 1] : null;

// Check DB
const dbPath = resolve(repoRoot, ".hex-skills/codegraph/index.db");
if (!existsSync(dbPath)) {
    console.error(
        "hex-graph benchmark requires .hex-skills/codegraph/index.db.\n" +
        "Run: mcp__hex-graph__index_project or node mcp/hex-graph-mcp/server.mjs first."
    );
    process.exit(1);
}

// ---------------------------------------------------------------------------
// Initialize store and pick symbols
// ---------------------------------------------------------------------------

const store = getStore(repoRoot);

/** Pick a symbol name that exists in the DB (function/method, well-connected) */
function pickSymbol() {
    const row = store.db.prepare(`
        SELECT n.name, n.kind, n.file, COUNT(e.id) as refs
        FROM nodes n
        JOIN edges e ON e.target_id = n.id
        WHERE n.kind IN ('function', 'method')
        GROUP BY n.id
        ORDER BY refs DESC
        LIMIT 1
    `).get();
    return row || null;
}

/** Pick a symbol with callers from other files */
function pickCrossFileSymbol() {
    const row = store.db.prepare(`
        SELECT n.name, n.kind, n.file, COUNT(DISTINCT n2.file) as caller_files
        FROM nodes n
        JOIN edges e ON e.target_id = n.id AND e.kind = 'calls'
        JOIN nodes n2 ON n2.id = e.source_id
        WHERE n.kind IN ('function', 'method') AND n2.file != n.file
        GROUP BY n.id
        ORDER BY caller_files DESC
        LIMIT 1
    `).get();
    return row || null;
}

/** Pick a function from the largest file */
function pickLargestFileSymbol() {
    const row = store.db.prepare(`
        SELECT n.name, n.kind, n.file
        FROM nodes n
        JOIN files f ON f.path = n.file
        WHERE n.kind IN ('function', 'method')
        ORDER BY f.node_count DESC, n.line_start ASC
        LIMIT 1
    `).get();
    return row || null;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
    if (!prBaseRef) {
        const previous = git(["rev-parse", "HEAD~1"], repoRoot, true).trim();
        if (previous) {
            prBaseRef = "HEAD~1";
            prHeadRef ||= "HEAD";
        } else {
            prBaseRef = "HEAD";
        }
    }

    const allFiles = walkDir(repoRoot);
    if (allFiles.length === 0) {
        console.log(`No code files found in ${repoRoot}`);
        process.exit(1);
    }

    const stats = store.stats();
    const repoName = basename(repoRoot);

    // Pre-pick symbols for tests
    const sym1 = pickSymbol();
    const sym2 = pickLargestFileSymbol();
    const sym3 = pickCrossFileSymbol();

    if (!sym1 && !sym2 && !sym3) {
        console.error("No suitable symbols found in index. Re-index with more files.");
        process.exit(1);
    }

    // Use fallbacks if specific picks fail
    const searchSym = sym1 || sym2 || sym3;
    const contextSym = sym2 || sym1 || sym3;
    const impactSym = sym3 || sym1 || sym2;
    const traceSym = sym1 || sym3 || sym2;

    const config = { repoRoot, allFiles, searchSym, contextSym, impactSym, traceSym, prBaseRef, prHeadRef };

    const workflows = await runWorkflows(store, config);
    const results = diagnostics ? runAtomic(store, config) : [];
    const amort = diagnostics ? await runAmortization(store, config) : null;

    // ===================================================================
    // Report
    // ===================================================================

    const out = [];
    out.push("# Hex-graph Workflow Benchmark");
    out.push("");
    out.push(`Repository: ${repoName} (${fmt(allFiles.length)} files, ${fmt(stats.nodes)} symbols indexed)`);
    out.push(`Date: ${new Date().toISOString().slice(0, 10)}`);
    out.push("");
    out.push("Mode: comparative workflow benchmark");
    out.push("");
    out.push("## Workflow Scenarios");
    out.push("");
    out.push("| # | Scenario | Built-in | Hex-graph | Savings | Ops | Steps |");
    out.push("|---|----------|----------|-----------|---------|-----|-------|");

    let totalWorkflowOpsWithout = 0;
    let totalWorkflowOpsWith = 0;
    let totalWorkflowStepsWithout = 0;
    let totalWorkflowStepsWith = 0;
    for (const w of workflows) {
        out.push(
            `| ${w.id} | ${w.scenario} | ${fmt(w.without)} chars | ${fmt(w.withG)} chars | ${pctSavings(w.without, w.withG)} | ${w.opsWithout}\u2192${w.opsWith} | ${w.stepsWithout}\u2192${w.stepsWith} |`
        );
        totalWorkflowOpsWithout += w.opsWithout;
        totalWorkflowOpsWith += w.opsWith;
        totalWorkflowStepsWithout += w.stepsWithout;
        totalWorkflowStepsWith += w.stepsWith;
    }
    out.push("");
    if (workflows.length > 0) {
        const avgWorkflowSavings = workflows.reduce((sum, w) => {
            if (w.without === 0) return sum;
            return sum + (((w.without - w.withG) / w.without) * 100);
        }, 0) / workflows.length;
        out.push(`Workflow summary: ${avgWorkflowSavings.toFixed(0)}% average token savings | ${totalWorkflowOpsWithout}\u2192${totalWorkflowOpsWith} ops | ${totalWorkflowStepsWithout}\u2192${totalWorkflowStepsWith} steps`);
        out.push("");
    }

    out.push("Note: public benchmark mode reports only workflow comparisons. Atomic scenarios and index-cost measurements are diagnostics and should not be used as headline benchmark claims.");
    out.push("");

    if (diagnostics) {
        out.push("## Diagnostics");
        out.push("");
        out.push("These rows are engineering diagnostics. They are useful for inspecting specific query shapes and latency, but they are not part of the public workflow benchmark score.");
        out.push("");
        out.push("| # | Scenario | Built-in | Hex-graph | Savings | Ops | Steps |");
        out.push("|---|----------|----------|-----------|---------|-----|-------|");
        for (const r of results) {
            out.push(
                `| ${r.id} | ${r.scenario} | ${fmt(r.without)} chars | ${fmt(r.withG)} chars | ${pctSavings(r.without, r.withG)} | ${r.opsWithout}\u2192${r.opsWith} | ${r.stepsWithout}\u2192${r.stepsWith} |`
            );
        }
        out.push("");
        if (amort) {
            out.push("### Latency Diagnostics");
            out.push("");
            out.push(`Index time: ${fmt(Math.round(amort.indexTimeMs))}ms for ${fmt(allFiles.length)} source files`);
            out.push(`Average query: ${amort.avgQueryMs.toFixed(1)}ms`);
            out.push(`Built-in comparison query: ${amort.avgBuiltinMs.toFixed(1)}ms`);
            out.push("");
        }
    }

    console.log(out.join("\n"));
}

main();
