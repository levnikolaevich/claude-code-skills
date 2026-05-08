import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
    assertExactCoverage,
    compareOrWrite as compareOrWriteArtifact,
    readJson,
    stableJson,
    textStats,
    writeJson,
} from "@levnikolaevich/hex-common/quality/artifacts";
import { researchResult } from "../lib/result.mjs";
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
    traceGoalTree,
    traceLineage,
    verifyIndex,
} from "../lib/tools.mjs";
import { TOOL_NAMES } from "../lib/constants.mjs";
import { cleanup, copyFixture } from "../test/helpers.mjs";

export const __dirname = dirname(fileURLToPath(import.meta.url));
export const PACKAGE_ROOT = resolve(__dirname, "..");
export const FIXTURE_ROOT = join(PACKAGE_ROOT, "test", "fixtures", "project");
export const QUALITY_DIR = join(PACKAGE_ROOT, "quality");
export const EVALS_DIR = join(PACKAGE_ROOT, "evals");
export const BENCHMARK_DIR = join(PACKAGE_ROOT, "benchmark");
export const README_PATH = join(PACKAGE_ROOT, "README.md");
export const QUALITY_SUMMARY_PATH = join(QUALITY_DIR, "quality-summary.md");
export const QUALITY_REPORT_PATH = join(QUALITY_DIR, "quality-report.json");
export const TOOL_MANIFEST_PATH = join(QUALITY_DIR, "tool-manifest.json");
export const EVAL_REPORT_PATH = join(EVALS_DIR, "report.json");
export const BENCHMARK_REPORT_PATH = join(BENCHMARK_DIR, "report.json");
export const BENCHMARK_MARKDOWN_PATH = join(BENCHMARK_DIR, "report.md");

export const TOOL_HANDLERS = {
    index_hypotheses: indexHypotheses,
    verify_index: verifyIndex,
    find_hypotheses: findHypotheses,
    inspect_hypothesis: inspectHypothesis,
    find_evidence: findEvidence,
    find_runs: findRuns,
    trace_lineage: traceLineage,
    analyze_topology: analyzeTopology,
    audit_orphans: auditOrphans,
    analyze_progress: analyzeProgress,
    analyze_proposed: analyzeProposed,
    inspect_goal: inspectGoal,
    trace_goal_tree: traceGoalTree,
    audit_goal_alignment: auditGoalAlignment,
    export_canvas: exportCanvas,
    export_research_map: exportResearchMap,
};

export function ensureDirs() {
    for (const dir of [QUALITY_DIR, EVALS_DIR, BENCHMARK_DIR]) {
        mkdirSync(dir, { recursive: true });
    }
}

export { readJson, stableJson, textStats, writeJson };

export function compareOrWrite(path, content, options = {}) {
    return compareOrWriteArtifact(path, content, { root: PACKAGE_ROOT, ...options });
}

export function assertToolCoverage(names) {
    assertExactCoverage(names, TOOL_NAMES, "tool matrix must cover exactly TOOL_NAMES");
}

export function callTool(name, params = {}) {
    const handler = TOOL_HANDLERS[name];
    assert.ok(handler, `unknown tool ${name}`);
    const structured = handler(params);
    const indexError = name === "index_hypotheses" && ["INVALID", "UNSUPPORTED", "ERROR"].includes(structured.status);
    const result = researchResult(structured, { isError: indexError ? true : false });
    assert.equal(result.content[0].text, JSON.stringify(result.structuredContent), `${name} text mirror`);
    assert.deepEqual(JSON.parse(result.content[0].text), JSON.parse(JSON.stringify(result.structuredContent)), `${name} JSON mirror`);
    return result;
}

export function withFixture(name, run) {
    const dir = copyFixture(name);
    try {
        return run(dir);
    } finally {
        cleanup(dir);
    }
}

export function setupGitRepo(root) {
    execFileSync("git", ["init"], { cwd: root, stdio: "ignore" });
    execFileSync("git", ["config", "user.email", "hex-research@example.invalid"], { cwd: root });
    execFileSync("git", ["config", "user.name", "Hex Research Eval"], { cwd: root });
    execFileSync("git", ["config", "core.autocrlf", "false"], { cwd: root });
    execFileSync("git", ["config", "core.eol", "lf"], { cwd: root });
    execFileSync("git", ["config", "core.safecrlf", "false"], { cwd: root });
    execFileSync("git", ["add", "."], { cwd: root });
    execFileSync("git", ["commit", "-m", "fixture baseline"], { cwd: root, stdio: "ignore" });
    const changedFile = join(root, "docs", "hypotheses", "H01.md");
    writeFileSync(changedFile, `${readFileSync(changedFile, "utf8")}\n<!-- eval change -->\n`, "utf8");
}

export function fixtureResearchFiles(root = FIXTURE_ROOT) {
    const files = [];
    function walk(dir) {
        for (const entry of readdirSync(dir)) {
            if (entry === ".git" || entry === ".hex-skills") continue;
            const path = join(dir, entry);
            const stat = statSync(path);
            if (stat.isDirectory()) {
                walk(path);
                continue;
            }
            if (/\.(md|ya?ml|json)$/i.test(entry)) files.push(path);
        }
    }
    walk(root);
    return files.sort();
}

export function baselineCorpusStats(root = FIXTURE_ROOT) {
    const files = fixtureResearchFiles(root);
    const chars = files.reduce((sum, path) => sum + readFileSync(path, "utf8").length, 0);
    return {
        files: files.map(path => relative(root, path).replaceAll("\\", "/")),
        file_count: files.length,
        chars,
        estimated_tokens: Math.ceil(chars / 4),
        method: "All Markdown, YAML, and JSON fixture research files; token estimate is ceil(chars / 4).",
    };
}

export function cleanupReportStores() {
    rmSync(join(FIXTURE_ROOT, ".hex-skills"), { recursive: true, force: true });
}
