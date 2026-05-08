import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { indexProject } from "../lib/indexer.mjs";
import { getPrImpact } from "../lib/pr-impact.mjs";
import { resolveStore } from "../lib/store.mjs";

function git(cwd, args) {
    return execFileSync("git", args, { cwd, encoding: "utf8" }).replace(/\r\n/g, "\n");
}

function configureGitLf(cwd) {
    git(cwd, ["config", "core.autocrlf", "false"]);
    git(cwd, ["config", "core.eol", "lf"]);
    git(cwd, ["config", "core.safecrlf", "false"]);
}

describe("analyze_changes substrate", () => {
    it("summarizes changed symbols from git refs and preserves deleted symbol warnings", async () => {
        const dir = mkdtempSync(join(tmpdir(), "hex-pr-impact-"));
        try {
            git(dir, ["init"]);
            configureGitLf(dir);
            git(dir, ["config", "user.name", "hex-graph"]);
            git(dir, ["config", "user.email", "hex-graph@example.com"]);

            mkdirSync(join(dir, "src"), { recursive: true });
            writeFileSync(join(dir, "src", "util.ts"), [
                "export function stable(value: string) {",
                "  return value.toUpperCase();",
                "}",
                "",
                "export function removedApi(value: string) {",
                "  return stable(value);",
                "}",
                "",
            ].join("\n"), "utf8");
            writeFileSync(join(dir, "src", "consumer.ts"), [
                "import { stable, removedApi } from \"./util\";",
                "",
                "export function useStable(input: string) {",
                "  return stable(input);",
                "}",
                "",
                "export function useRemoved(input: string) {",
                "  return removedApi(input);",
                "}",
                "",
            ].join("\n"), "utf8");
            git(dir, ["add", "."]);
            git(dir, ["commit", "-m", "base"]);

            writeFileSync(join(dir, "src", "util.ts"), [
                "export function stable(value: string) {",
                "  return `${value.toUpperCase()}!`;",
                "}",
                "",
                "export function freshApi(value: string) {",
                "  return stable(value);",
                "}",
                "",
            ].join("\n"), "utf8");
            writeFileSync(join(dir, "src", "consumer.ts"), [
                "import { stable, freshApi } from \"./util\";",
                "",
                "export function useStable(input: string) {",
                "  return stable(input);",
                "}",
                "",
                "export function useFresh(input: string) {",
                "  return freshApi(input);",
                "}",
                "",
            ].join("\n"), "utf8");
            git(dir, ["add", "."]);
            git(dir, ["commit", "-m", "head"]);

            await indexProject(dir);
            const impact = await getPrImpact({
                path: dir,
                baseRef: "HEAD~1",
                headRef: "HEAD",
                includePaths: false,
                maxSymbols: 10,
                maxPaths: 5,
            });

            assert.equal(impact.reason, "git_ref_changed_symbols_with_graph_impact");
            assert.equal(impact.result.summary.changed_file_count, 2);
            assert.ok(impact.result.summary.deleted_symbol_count >= 1, "deleted API is surfaced");
            assert.ok(impact.result.deleted_symbols.some(symbol => symbol.name === "removedApi"), "deleted symbol warning retained");
            assert.ok(impact.result.symbols.some(symbol => symbol.name === "stable"), "modified live symbol resolved");
            assert.ok(impact.result.symbols.every(symbol => !("paths" in symbol)), "compact mode omits path drilldown");
            assert.ok(impact.result.summary.risk_counts.high >= 1, "high-risk entries are identified");
        } finally {
            resolveStore(dir)?.close();
            rmSync(dir, { recursive: true, force: true });
        }
    });
});
