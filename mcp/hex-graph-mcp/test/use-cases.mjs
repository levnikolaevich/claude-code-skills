import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { indexProject } from "../lib/indexer.mjs";
import { resolveStore } from "../lib/store.mjs";
import {
    runAnalyzeArchitectureUseCase,
    runAnalyzeEditRegionUseCase,
    runAuditWorkspaceUseCase,
    runFindSymbolsUseCase,
    runInspectSymbolUseCase,
} from "../lib/use-cases.mjs";

function makeTempDir() {
    return mkdtempSync(join(tmpdir(), "hex-graph-use-cases-"));
}

describe("use-case wrappers", () => {
    it("aggregates symbol discovery and inspection into richer responses", async () => {
        const dir = makeTempDir();
        try {
            mkdirSync(join(dir, "src"), { recursive: true });
            writeFileSync(join(dir, "src", "util.ts"), [
                "export function stable(value: string) {",
                "  return value.toUpperCase();",
                "}",
                "",
            ].join("\n"), "utf8");
            writeFileSync(join(dir, "src", "consumer.ts"), [
                "import { stable } from \"./util\";",
                "",
                "export function useStable(input: string) {",
                "  return stable(input);",
                "}",
                "",
            ].join("\n"), "utf8");
            await indexProject(dir);

            const candidates = runFindSymbolsUseCase("stable", { path: dir });
            assert.ok(candidates.result.candidates.length >= 1);
            assert.deepEqual(candidates.next_actions, ["inspect_symbol"]);

            const symbol = candidates.result.candidates.find((candidate) => candidate.kind === "function")
                || candidates.result.candidates[0];
            const inspect = runInspectSymbolUseCase({ symbol_id: symbol.symbol_id }, { path: dir });
            assert.equal(inspect.result.symbol.name, "stable");
            assert.ok(inspect.result.references_summary.total >= 1);
            assert.ok(inspect.summary.includes("reference"));
            assert.ok(inspect.next_actions.includes("find_references"));
            assert.ok(inspect.next_actions.includes("trace_paths"));
        } finally {
            resolveStore(dir)?.close();
            rmSync(dir, { recursive: true, force: true });
        }
    });

    it("surfaces query-boundary warnings for member-call patterns and mono-package architecture", async () => {
        const dir = makeTempDir();
        try {
            mkdirSync(join(dir, "src"), { recursive: true });
            writeFileSync(join(dir, "src", "server.ts"), [
                "export function registerTool(name: string) {",
                "  return name;",
                "}",
                "",
                "export function boot(server: { tool(name: string): string }) {",
                "  return server.tool(\"demo\");",
                "}",
                "",
            ].join("\n"), "utf8");
            await indexProject(dir);

            const candidates = runFindSymbolsUseCase("server.tool()", { path: dir });
            assert.equal(candidates.result.candidates.length, 0);
            assert.ok(
                candidates.warnings.some((warning) => warning.includes("object member call sites")),
                "member-call warning is returned",
            );
            assert.ok(candidates.next_actions.includes("adjust_query"));

            const architecture = runAnalyzeArchitectureUseCase({ path: dir, detailLevel: "compact" });
            assert.equal(architecture.result.modules.length, 1);
            assert.ok(
                architecture.warnings.some((warning) => warning.includes("single workspace module")),
                "mono-package warning is returned",
            );
        } finally {
            resolveStore(dir)?.close();
            rmSync(dir, { recursive: true, force: true });
        }
    });

    it("covers edit impact, architecture, and workspace audit use cases", async () => {
        const dir = makeTempDir();
        try {
            mkdirSync(join(dir, "src"), { recursive: true });
            writeFileSync(join(dir, "src", "a.ts"), [
                "import { b } from \"./b\";",
                "export function a() {",
                "  return b();",
                "}",
                "",
            ].join("\n"), "utf8");
            writeFileSync(join(dir, "src", "b.ts"), [
                "import { a } from \"./a\";",
                "export function b() {",
                "  return 1;",
                "}",
                "",
                "export function deadExport() {",
                "  return a();",
                "}",
                "",
            ].join("\n"), "utf8");
            const duplicateBody = [
                "export function duplicateThing(input) {",
                "  const trimmed = input.trim();",
                "  if (!trimmed) return null;",
                "  return trimmed.toUpperCase();",
                "}",
                "",
            ].join("\n");
            writeFileSync(join(dir, "src", "dup-one.js"), duplicateBody, "utf8");
            writeFileSync(join(dir, "src", "dup-two.js"), duplicateBody.replaceAll("duplicateThing", "duplicateOther"), "utf8");
            writeFileSync(join(dir, "src", "consumer.ts"), [
                "import { deadExport } from \"./b\";",
                "export function useDead() {",
                "  return deadExport();",
                "}",
                "",
            ].join("\n"), "utf8");

            await indexProject(dir);

            const editRegion = runAnalyzeEditRegionUseCase({
                path: dir,
                file: "src/b.ts",
                lineStart: 2,
                lineEnd: 8,
                detailLevel: "compact",
            });
            assert.ok(editRegion.result.edited_symbols.length >= 1);
            assert.ok(editRegion.result.impact_summary.external_callers >= 1);
            assert.ok(editRegion.next_actions.includes("find_references"));
            assert.ok(editRegion.next_actions.includes("trace_dataflow"));

            const architecture = runAnalyzeArchitectureUseCase({ path: dir, detailLevel: "compact" });
            assert.ok(architecture.result.modules.length >= 1, "modules are reported");
            assert.ok(Array.isArray(architecture.result.module_boundaries), "module boundaries section is present");
            assert.ok(architecture.summary.includes("module"));
            assert.ok(architecture.next_actions.includes("audit_workspace"));

            const audit = runAuditWorkspaceUseCase({ path: dir, detailLevel: "compact" });
            assert.ok(audit.result.clones.length >= 1, "clone group is reported");
            assert.ok(audit.summary.includes("clone group"));
            assert.ok(audit.next_actions.includes("analyze_edit_region"));
        } finally {
            resolveStore(dir)?.close();
            rmSync(dir, { recursive: true, force: true });
        }
    });

    it("supports minimal progressive-disclosure payloads for architecture and workspace audit", async () => {
        const dir = makeTempDir();
        try {
            mkdirSync(join(dir, "src"), { recursive: true });
            writeFileSync(join(dir, "src", "a.ts"), [
                "import { b } from \"./b\";",
                "export function a() {",
                "  return b();",
                "}",
                "",
            ].join("\n"), "utf8");
            writeFileSync(join(dir, "src", "b.ts"), [
                "import { a } from \"./a\";",
                "export function b() {",
                "  return 1;",
                "}",
                "",
                "export function deadExport() {",
                "  return a();",
                "}",
                "",
            ].join("\n"), "utf8");
            writeFileSync(join(dir, "src", "dup-one.js"), [
                "export function duplicateThing(input) {",
                "  const trimmed = input.trim();",
                "  if (!trimmed) return null;",
                "  return trimmed.toUpperCase();",
                "}",
                "",
            ].join("\n"), "utf8");
            writeFileSync(join(dir, "src", "dup-two.js"), [
                "export function duplicateOther(input) {",
                "  const trimmed = input.trim();",
                "  if (!trimmed) return null;",
                "  return trimmed.toUpperCase();",
                "}",
                "",
            ].join("\n"), "utf8");
            await indexProject(dir);

            const architecture = runAnalyzeArchitectureUseCase({ path: dir, verbosity: "minimal", limit: 3 });
            assert.ok(Array.isArray(architecture.result.modules), "minimal architecture still returns module horizon");
            assert.ok(Array.isArray(architecture.result.cycles), "minimal architecture still returns cycles");
            assert.ok(Array.isArray(architecture.result.top_risks), "minimal architecture still returns top risks");
            assert.equal("module_boundaries" in architecture.result, false, "minimal architecture omits boundaries");
            assert.equal("coupling" in architecture.result, false, "minimal architecture omits coupling");
            assert.equal("framework_surfaces" in architecture.result, false, "minimal architecture omits framework surfaces");
            assert.equal(architecture.query.verbosity, "minimal");

            const audit = runAuditWorkspaceUseCase({ path: dir, verbosity: "minimal", showSuppressed: true });
            assert.ok(Array.isArray(audit.result.unused_exports), "minimal audit still returns visible cleanup targets");
            assert.ok(Array.isArray(audit.result.hotspots), "minimal audit still returns hotspots");
            assert.ok(Array.isArray(audit.result.clones), "minimal audit still returns clone groups");
            assert.deepEqual(audit.result.uncertain_unused_exports, [], "minimal audit omits uncertain exports");
            assert.deepEqual(audit.result.suppressed_items, [], "minimal audit omits suppressed detail");
            assert.equal(audit.query.verbosity, "minimal");
        } finally {
            resolveStore(dir)?.close();
            rmSync(dir, { recursive: true, force: true });
        }
    });
});
