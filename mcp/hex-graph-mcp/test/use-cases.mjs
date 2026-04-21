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
    runFindImplementationsUseCase,
    runFindReferencesUseCase,
    runInspectSymbolUseCase,
    runTraceDataflowUseCase,
    runTracePathsUseCase,
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
            const inspect = runInspectSymbolUseCase({ symbol_id: symbol.symbol_id }, { path: dir, verbosity: "compact" });
            assert.equal(inspect.result.symbol.name, "stable");
            assert.ok(inspect.result.references_summary.total >= 1);
            assert.ok(inspect.result.counts.references >= 1);
            assert.ok(Array.isArray(inspect.result.references_summary.preview));
            assert.ok(Array.isArray(inspect.result.expansion_hints));
            assert.ok(inspect.result.expansion_hints.every(hint => typeof hint.pointer === "string" && hint.pointer.startsWith(">mcp__hex-graph__")));
            assert.equal(inspect.result.resolution.ownership.file, "src/util.ts");
            assert.equal(inspect.result.resolution.resolution_quality.selector_specificity, "exact_id");
            assert.ok(Array.isArray(inspect.result.provenance_summary.tiers));
            assert.equal("siblings" in inspect.result.context, false);
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

    it("truncates ambiguous find_symbols results and surfaces overflow guidance", async () => {
        const dir = makeTempDir();
        try {
            mkdirSync(join(dir, "src"), { recursive: true });
            for (let idx = 0; idx < 10; idx++) {
                writeFileSync(join(dir, "src", `mod-${idx + 1}.ts`), [
                    `export function stable(value${idx}) {`,
                    `  return value${idx};`,
                    "}",
                    "",
                ].join("\n"), "utf8");
            }
            await indexProject(dir);

            const result = runFindSymbolsUseCase("stable", { path: dir, limit: 3 });
            assert.equal(result.result.candidate_count, 10);
            assert.equal(result.result.shown_count, 3);
            assert.equal(result.result.candidates.length, 3);
            assert.equal(result.result.truncated, true);
            assert.ok(result.result.overflow_groups.length >= 1);
            assert.ok(
                result.result.disambiguation_hints.some((hint) => hint.includes("name + file")),
                "name+file refine hint is returned",
            );
            assert.ok(result.next_actions.includes("inspect_symbol"));
            assert.ok(result.next_actions.includes("adjust_query"));
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
            for (let idx = 3; idx <= 7; idx++) {
                writeFileSync(join(dir, "src", `dup-${idx}.js`), [
                    `export function duplicateExtra${idx}(input) {`,
                    "  const trimmed = input.trim();",
                    "  if (!trimmed) return null;",
                    "  return trimmed.toUpperCase();",
                    "}",
                    "",
                ].join("\n"), "utf8");
            }
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
            assert.ok(audit.result.clones.length <= 5, "minimal audit bounds clone groups");
            assert.ok(
                audit.result.clones.every(group => (group.members || []).length <= 3),
                "minimal audit bounds clone members per group",
            );
            assert.ok(
                audit.result.clones.some(group => group.members_omitted > 0),
                "large clone groups report omitted member counts",
            );
            assert.deepEqual(audit.result.uncertain_unused_exports, [], "minimal audit omits uncertain exports");
            assert.deepEqual(audit.result.suppressed_items, [], "minimal audit omits suppressed detail");
            assert.equal(audit.query.verbosity, "minimal");
            assert.equal(audit.query.limit, 5);
            assert.equal(audit.query.clone_member_limit, 3);
            assert.equal(audit.limits_applied.limit, 5);
            assert.equal(audit.limits_applied.clone_member_limit, 3);
        } finally {
            resolveStore(dir)?.close();
            rmSync(dir, { recursive: true, force: true });
        }
    });

    it("returns bounded expansion hints and explicit drill-down payloads for heavy symbol tools", async () => {
        const dir = makeTempDir();
        try {
            mkdirSync(join(dir, "src"), { recursive: true });
            writeFileSync(join(dir, "src", "util.ts"), [
                "export function stable(value: string) {",
                "  return value.toUpperCase();",
                "}",
                "",
            ].join("\n"), "utf8");
            writeFileSync(join(dir, "src", "consumer-a.ts"), [
                "import { stable } from \"./util\";",
                "export const a = stable(\"a\");",
                "",
            ].join("\n"), "utf8");
            writeFileSync(join(dir, "src", "consumer-b.ts"), [
                "import { stable } from \"./util\";",
                "export const b = stable(\"b\");",
                "",
            ].join("\n"), "utf8");
            await indexProject(dir);

            const symbol = runFindSymbolsUseCase("stable", { path: dir }).result.candidates[0];
            const inspect = runInspectSymbolUseCase(
                { symbol_id: symbol.symbol_id },
                { path: dir, verbosity: "compact", expand: ["references"], expandLimit: 2 },
            );
            assert.ok(inspect.result.expansion_hints.some((hint) => hint.expansion === "references"));
            assert.ok(Array.isArray(inspect.result.expanded.references));
            assert.ok(inspect.result.expanded.references.length <= 2);

            const references = runFindReferencesUseCase(
                { symbol_id: symbol.symbol_id },
                { path: dir, verbosity: "compact", expand: ["references"], expandLimit: 2 },
            );
            assert.ok(references.result.total >= 2);
            assert.ok(Array.isArray(references.result.preview));
            assert.ok(Array.isArray(references.result.expanded.references));
            assert.ok(references.result.expanded.references.length <= 2);
            assert.ok(Array.isArray(references.result.provenance_summary.tiers));

            const implementations = runFindImplementationsUseCase(
                { symbol_id: symbol.symbol_id },
                { path: dir, verbosity: "compact", expand: ["implementations"], expandLimit: 2 },
            );
            assert.ok(Array.isArray(implementations.result.preview));
            assert.ok(Array.isArray(implementations.result.expansion_hints));
            assert.ok(Array.isArray(implementations.result.provenance_summary.tiers));
        } finally {
            resolveStore(dir)?.close();
            rmSync(dir, { recursive: true, force: true });
        }
    });

    it("returns bounded previews and path expansion guidance for trace tools", async () => {
        const dir = makeTempDir();
        try {
            mkdirSync(join(dir, "src"), { recursive: true });
            writeFileSync(join(dir, "src", "util.ts"), [
                "export function stable(value: string) {",
                "  return value.toUpperCase();",
                "}",
                "",
                "export function relay(value: string) {",
                "  return stable(value);",
                "}",
                "",
            ].join("\n"), "utf8");
            writeFileSync(join(dir, "src", "consumer.ts"), [
                "import { relay } from \"./util\";",
                "export function useRelay(input: string) {",
                "  return relay(input);",
                "}",
                "",
            ].join("\n"), "utf8");
            await indexProject(dir);

            const stable = runFindSymbolsUseCase("stable", { path: dir }).result.candidates[0];
            const trace = runTracePathsUseCase(
                { symbol_id: stable.symbol_id },
                { path: dir, pathKind: "calls", direction: "reverse", expand: ["paths"], expandLimit: 2 },
            );
            assert.ok(trace.result.path_count >= 1);
            assert.ok(Array.isArray(trace.result.path_previews));
            assert.ok(Array.isArray(trace.result.expanded.paths));
            assert.ok(trace.result.expanded.paths.length <= 2);
            assert.ok(Array.isArray(trace.result.provenance_summary.tiers));

            const dataflow = runTraceDataflowUseCase({
                source: {
                    symbol: { symbol_id: stable.symbol_id },
                    anchor: { kind: "return" },
                },
            }, {
                path: dir,
                expand: ["paths"],
                expandLimit: 2,
            });
            assert.ok(Array.isArray(dataflow.result.path_previews));
            assert.ok(Array.isArray(dataflow.result.expansion_hints));
            assert.ok("provenance_summary" in dataflow.result);
        } finally {
            resolveStore(dir)?.close();
            rmSync(dir, { recursive: true, force: true });
        }
    });
});
