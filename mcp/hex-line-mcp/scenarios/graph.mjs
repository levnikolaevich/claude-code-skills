/**
 * TEST 16-18: Graph enrichment benchmarks (--with-graph only).
 *
 * Both sides use hex-line; difference is whether .hex-skills/codegraph/index.db exists.
 * Requires hex-graph index_project to have been run first.
 */

import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { readFile } from "../lib/read.mjs";
import { editFile } from "../lib/edit.mjs";
import { grepSearch } from "../lib/search.mjs";
import { fnv1a, lineTag } from "@levnikolaevich/hex-common/text-protocol/hash";
import { getFileLines, fmt } from "../lib/scenario-helpers.mjs";

function formatOverhead(baseChars, enrichedChars) {
    const delta = enrichedChars - baseChars;
    if (baseChars <= 0) return `${fmt(delta)} chars`;
    const pct = ((delta / baseChars) * 100).toFixed(1);
    return `${delta >= 0 ? "+" : ""}${fmt(delta)} chars (${delta >= 0 ? "+" : ""}${pct}%)`;
}

/**
 * Run TEST 16-18 graph enrichment benchmarks.
 *
 * @param {object} config
 * @param {string[]} config.allFiles - All discovered code files
 * @param {string[]} config.largeFiles - Top 3 largest code files
 * @param {string} config.repoRoot - Repository root path
 * @returns {Promise<string[]>} Array of pre-formatted table row strings
 */
export async function runGraph(config) {
    const { allFiles, largeFiles, repoRoot } = config;
    const graphRows = [];

    const {
        getGraphDB,
        _graphRefreshDebugState,
        _resetGraphDBCache,
        _resetGraphRefreshStats,
        _waitForPendingGraphRefreshes,
    } = await import("../lib/graph-enrich.mjs");
    const db = getGraphDB(resolve(repoRoot, "server.mjs"));
    if (!db) {
        console.error("--with-graph: .hex-skills/codegraph/index.db not found. Run hex-graph index_project first.");
        return [];
    }

    const graphFile = largeFiles[0] || allFiles[0];
    const graphLines = getFileLines(graphFile);

    if (!graphLines) return [];

    // TEST 16: Read with/without Graph header
    {
        const withGraphResult = readFile(graphFile);
        const noGraphResult = withGraphResult.replace(/\nGraph:.*\n/, "\n");
        graphRows.push(`| 16 | Graph: Read (${graphLines.length}L) | ${fmt(noGraphResult.length)} chars | ${fmt(withGraphResult.length)} chars | ${formatOverhead(noGraphResult.length, withGraphResult.length)} | 2 | 1 |`);
    }

    // TEST 17: Edit with/without semantic impact
    {
        const editRepo = mkdtempSync(join(tmpdir(), "hex-graph-edit-"));
        try {
            const { indexProject } = await import("../../hex-graph-mcp/lib/indexer.mjs");
            writeFileSync(join(editRepo, "package.json"), "{\n  \"name\": \"hex-graph-edit-probe\"\n}\n", "utf-8");
            writeFileSync(join(editRepo, "a.mjs"), "export function foo() {\n  return 1;\n}\n", "utf-8");
            writeFileSync(join(editRepo, "b.mjs"), "import { foo } from \"./a.mjs\";\nexport function run() {\n  return foo();\n}\n", "utf-8");
            await indexProject(editRepo);
            _resetGraphDBCache();
            const anchor = `${lineTag(fnv1a("  return 1;"))}.2`;
            const editResult = editFile(join(editRepo, "a.mjs"), [{ set_line: { anchor, new_text: "  return 2;" } }]);
            const noBlastOut = editResult
                .replace(/\ngraph_enrichment:.*$/m, "\ngraph_enrichment: unavailable")
                .replace(/\nsemantic_impact_count:.*$/m, "\nsemantic_impact_count: 0")
                .replace(/\nsemantic_fact_count:.*$/m, "\nsemantic_fact_count: 0")
                .replace(/\nclone_warning_count:.*$/m, "\nclone_warning_count: 0")
                .replace(/\n\n⚠ Semantic impact:\n[\s\S]*$/m, "");
            graphRows.push(`| 17 | Graph: Edit + semantic impact | ${fmt(noBlastOut.length)} chars | ${fmt(editResult.length)} chars | ${formatOverhead(noBlastOut.length, editResult.length)} | 2 | 1 |`);
        } catch {
            graphRows.push(`| 17 | Graph: Edit + semantic impact | \u2014 | \u2014 | \u2014 | | |`);
        } finally {
            _resetGraphDBCache();
            rmSync(editRepo, { recursive: true, force: true });
        }
    }

    // TEST 18: Grep with/without annotations
    {
        const grepRepo = mkdtempSync(join(tmpdir(), "hex-graph-grep-"));
        try {
            const { indexProject } = await import("../../hex-graph-mcp/lib/indexer.mjs");
            writeFileSync(join(grepRepo, "package.json"), "{\n  \"name\": \"hex-graph-grep-probe\"\n}\n", "utf-8");
            writeFileSync(join(grepRepo, "a.mjs"), "export function foo() {\n  return 1;\n}\n", "utf-8");
            writeFileSync(join(grepRepo, "b.mjs"), "import { foo } from \"./a.mjs\";\nexport function run() {\n  return foo();\n}\n", "utf-8");
            await indexProject(grepRepo);
            _resetGraphDBCache();
            const grepResult = await grepSearch("export function foo", {
                path: join(grepRepo, "a.mjs"),
                output: "content",
                editReady: true,
            });
            const noAnnoResult = grepResult.replace(/\s+\[[^\]]+\]/g, "");
            const annoCount = (grepResult.match(/\[[^\]]+\]/g) || []).length;
            graphRows.push(`| 18 | Graph: Grep + ${annoCount} annotations | ${fmt(noAnnoResult.length)} chars | ${fmt(grepResult.length)} chars | ${formatOverhead(noAnnoResult.length, grepResult.length)} | 6 | 1 |`);
        } catch {
            graphRows.push(`| 18 | Graph: Grep + context | \u2014 | \u2014 | \u2014 | | |`);
        } finally {
            _resetGraphDBCache();
            rmSync(grepRepo, { recursive: true, force: true });
        }
    }

    {
        const { indexProject } = await import("../../hex-graph-mcp/lib/indexer.mjs");
        const probeRepo = mkdtempSync(join(tmpdir(), "hex-graph-refresh-"));
        try {
            writeFileSync(join(probeRepo, "package.json"), "{\n  \"name\": \"hex-graph-refresh-probe\"\n}\n", "utf-8");
            writeFileSync(join(probeRepo, "a.mjs"), "export function alpha() {\n  return 1;\n}\n", "utf-8");
            writeFileSync(join(probeRepo, "b.mjs"), "export function beta() {\n  return 2;\n}\n", "utf-8");
            writeFileSync(join(probeRepo, "c.mjs"), "export function gamma() {\n  return 3;\n}\n", "utf-8");

            await indexProject(probeRepo);
            _resetGraphDBCache();
            _resetGraphRefreshStats();

            readFile(join(probeRepo, "a.mjs"));
            await new Promise((resolveDelay) => setTimeout(resolveDelay, 20));

            writeFileSync(join(probeRepo, "a.mjs"), "export function alpha() {\n  return 10;\n}\n", "utf-8");
            writeFileSync(join(probeRepo, "b.mjs"), "export function beta() {\n  return 20;\n}\n", "utf-8");
            writeFileSync(join(probeRepo, "c.mjs"), "export function gamma() {\n  return 30;\n}\n", "utf-8");

            readFile(join(probeRepo, "a.mjs"));
            readFile(join(probeRepo, "b.mjs"));
            readFile(join(probeRepo, "c.mjs"));
            await _waitForPendingGraphRefreshes();

            const stats = _graphRefreshDebugState().stats;
            return [
                "| # | Scenario | Base chars | Enriched chars | Payload overhead | Baseline ops | Graph ops |",
                "|---|----------|------------|----------------|------------------|--------------|-----------|",
                ...graphRows,
                "",
                `Auto-refresh probe: suppressions=${stats.staleSuppressions}, file_refresh=${stats.fileRefreshScheduled}/${stats.fileRefreshCompleted}, project_refresh=${stats.projectRefreshScheduled}/${stats.projectRefreshCompleted}, threshold_hits=${stats.projectRefreshThresholdHits}`,
            ];
        } finally {
            _resetGraphDBCache();
            _resetGraphRefreshStats();
            rmSync(probeRepo, { recursive: true, force: true });
        }
    }
}
