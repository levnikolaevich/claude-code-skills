#!/usr/bin/env node
/**
 * hex-graph-mcp — identity-first graph kernel MCP server.
 * Transport: stdio
 */

import { z } from "zod";
const version = typeof __HEX_VERSION__ !== "undefined" ? __HEX_VERSION__ // eslint-disable-line no-undef
  : (await import("node:module")).createRequire(import.meta.url)("./package.json").version;
import { createServerRuntime } from "@levnikolaevich/hex-common/runtime/mcp-bootstrap";
import { classifyMcpFailure } from "@levnikolaevich/hex-common/runtime/error-classifier";
import { flexBool, flexNum } from "@levnikolaevich/hex-common/runtime/schema";
import { checkForUpdates } from "@levnikolaevich/hex-common/runtime/update-check";
import { closeAllStores } from "./lib/store.mjs";
import { CONFIDENCE_VALUES } from "./lib/confidence.mjs";
import { DEFAULT_FLOW_MAX_HOPS, FLOW_ANCHOR_KINDS } from "./lib/flow.mjs";
import { buildInlineQuality, collectFrameworksFromOrigins } from "./lib/quality.mjs";
import { installGraphProviders } from "./lib/providers/index.mjs";
import { exportScip } from "./lib/scip/export.mjs";
import { importScipOverlay } from "./lib/scip/import.mjs";
import { SCIP_EXPORT_LANGUAGES } from "./lib/scip/languages.mjs";
import {
    runAnalyzeArchitectureUseCase,
    runAnalyzeChangesUseCase,
    runAnalyzeEditRegionUseCase,
    runAuditWorkspaceUseCase,
    runFindSymbolsUseCase,
    runFindImplementationsUseCase,
    runFindReferencesUseCase,
    runInspectSymbolUseCase,
    runTracePathsUseCase,
    runTraceDataflowUseCase,
} from "./lib/use-cases.mjs";
import { ACTION, pruneEmpty, STATUS } from "./lib/output-contract.mjs";

// Local text-only MCP result helpers. Drops structuredContent mirror and
// outputSchema dependency (see PROTOCOL.md §MCP envelope policy).
const LARGE_RESULT_META = { "anthropic/maxResultSizeChars": 500_000 };


function textResult(text, { large = false } = {}) {
    const response = {
        content: [{ type: "text", text: typeof text === "string" ? text : String(text ?? "") }],
    };
    if (large) response._meta = LARGE_RESULT_META;
    return response;
}

function textErrorResult(text, { large = false } = {}) {
    const response = textResult(text, { large });
    response.isError = true;
    return response;
}

// Grammar body renderer — text-only MCP response per PROTOCOL.md.
// Produces: <status> <next_action> [kv...]  then #section / .row / >pointer / !code / ?debug lines.
function escapeValue(value) {
    if (value === null || value === undefined) return "";
    const str = String(value);
    return str.includes("\n") ? str.replace(/\n/g, " ") : str;
}

function kvString(kvs) {
    const parts = [];
    for (const [k, v] of kvs) {
        if (v === null || v === undefined || v === "") continue;
        parts.push(`${k}=${escapeValue(v)}`);
    }
    return parts.join(" ");
}

function pointerHasKey(pointer, key) {
    return new RegExp(`(?:^|\\s)${key}=`).test(pointer);
}

function appendPointerKv(pointer, key, value) {
    if (value === null || value === undefined || value === "" || pointerHasKey(pointer, key)) {
        return pointer;
    }
    return `${pointer} ${key}=${escapeValue(value)}`;
}

function canonicalSelectorForPointer(payload) {
    const symbol = payload?.result?.symbol || {};
    const query = payload?.query || {};
    if (symbol.symbol_id != null) return { symbol_id: symbol.symbol_id };
    if (symbol.workspace_qualified_name) return { workspace_qualified_name: symbol.workspace_qualified_name };
    if (symbol.qualified_name) return { qualified_name: symbol.qualified_name };
    if (query.symbol_id != null) return { symbol_id: query.symbol_id };
    if (query.workspace_qualified_name) return { workspace_qualified_name: query.workspace_qualified_name };
    if (query.qualified_name) return { qualified_name: query.qualified_name };
    const name = symbol.name || query.name;
    const file = symbol.file || query.file;
    return name && file ? { name, file } : {};
}

function pointerFromHint(hint, payload) {
    if (hint && typeof hint.pointer === "string" && hint.pointer.startsWith(">mcp__hex-graph__")) {
        let pointer = hint.pointer;
        pointer = appendPointerKv(pointer, "path", payload?.query?.path);
        const selector = canonicalSelectorForPointer(payload);
        for (const [key, value] of Object.entries(selector)) {
            pointer = appendPointerKv(pointer, key, value);
        }
        return pointer;
    }
    return null;
}

function buildActionLine(payload, toolName) {
    const status = (payload?.status || "ok").toLowerCase();
    const nextAction = String(payload?.next_action || "keep_using").toLowerCase();
    const kv = [];
    const rev = payload?.evidence?.rev || payload?.rev || payload?.query?.rev;
    if (rev) kv.push(["rev", rev]);
    const total = payload?.result?.total
        ?? payload?.result?.path_count
        ?? payload?.result?.candidate_count;
    if (total != null) kv.push(["total", total]);
    if (payload?.result?.shown_count != null && payload.result.shown_count !== total) {
        kv.push(["returned", payload.result.shown_count]);
    }
    if (payload?.result?.truncated || payload?.limits_applied?.truncated) {
        kv.push(["truncated", 1]);
    }
    if (payload?.confidence && payload.confidence !== "heuristic") {
        kv.push(["conf", payload.confidence]);
    }
    const sym = payload?.result?.symbol?.name || payload?.result?.symbol?.display_name;
    if (sym && toolName === "inspect_symbol") kv.push(["sym", sym]);
    const qpath = payload?.query?.path;
    if (qpath && (toolName === "audit_workspace" || toolName === "analyze_architecture" || toolName === "analyze_edit_region" || toolName === "index_project")) {
        kv.push(["path", qpath]);
    }
    const pattern = payload?.query?.query;
    if (pattern && toolName === "find_symbols") kv.push(["pattern", pattern]);
    const limit = payload?.limits_applied?.limit;
    if (limit != null) kv.push(["limit", limit]);
    const expandLimit = payload?.limits_applied?.expand_limit;
    if (expandLimit != null) kv.push(["expand_limit", expandLimit]);
    const kvStr = kvString(kv);
    return kvStr.length ? `${status} ${nextAction} ${kvStr}` : `${status} ${nextAction}`;
}

function tierKv(tiers) {
    if (!Array.isArray(tiers) || !tiers.length) return "";
    return tiers.map(t => `${t.value}=${t.count}`).join(" ");
}

function emitWarningsAndPointers(payload, lines) {
    const warnings = payload?.warnings || [];
    for (const warning of warnings) {
        if (typeof warning === "string" && warning.trim()) {
            lines.push(`!warning=${escapeValue(warning)}`);
        }
    }
    const hints = payload?.result?.expansion_hints || [];
    for (const hint of hints) {
        const ptr = pointerFromHint(hint, payload);
        if (ptr) lines.push(ptr);
    }
}

function renderFindSymbols(payload, lines) {
    const candidates = payload?.result?.candidates || [];
    for (const candidate of candidates) {
        const name = candidate.name || candidate.display_name || "?";
        const file = candidate.file || "?";
        const line = candidate.line_start ?? candidate.line ?? "?";
        const kind = candidate.kind || "?";
        const exported = candidate.is_exported ? 1 : 0;
        lines.push(`.${name} ${file}:${line} kind=${kind} exported=${exported}`);
    }
}

function renderInspectSymbol(payload, lines) {
    const result = payload?.result || {};
    const symbol = result.symbol || {};
    if (symbol.file) {
        const range = symbol.line_end ? `${symbol.line_start}-${symbol.line_end}` : `${symbol.line_start ?? "?"}`;
        const exported = symbol.is_exported ? 1 : 0;
        lines.push(`#location ${symbol.file}:${range} exported=${exported} kind=${symbol.kind || "?"}`);
    }
    const counts = result.counts || {};
    const refsTotal = result.references_summary?.total ?? counts.references;
    if (refsTotal != null) lines.push(`#refs total=${refsTotal}`);
    if (counts.incoming != null || counts.outgoing != null) {
        const parts = [];
        if (counts.incoming != null) parts.push(`in=${counts.incoming}`);
        if (counts.outgoing != null) parts.push(`out=${counts.outgoing}`);
        if (counts.siblings != null) parts.push(`siblings=${counts.siblings}`);
        if (counts.implementations != null) parts.push(`impls=${counts.implementations}`);
        lines.push(`#flow ${parts.join(" ")}`);
    }
    const prov = result.provenance_summary;
    if (prov && Array.isArray(prov.tiers) && prov.tiers.length) {
        lines.push(`#provenance ${tierKv(prov.tiers)}`);
    }
    const refPreview = result.references_summary?.preview || [];
    for (const ref of refPreview) {
        const f = ref.file || "?";
        const l = ref.line ?? "?";
        lines.push(`.ref ${f}:${l} kind=${ref.kind || "?"} conf=${ref.confidence || "?"} origin=${ref.origin || "?"}`);
    }
    const implPreview = result.implementations_summary?.preview || [];
    for (const impl of implPreview) {
        lines.push(`.impl kind=${impl.kind || "?"} conf=${impl.confidence || "?"} source=${impl.source || "?"}`);
    }
}

function renderFindReferences(payload, lines) {
    const result = payload?.result || {};
    const prov = result.provenance_summary;
    if (prov && Array.isArray(prov.tiers) && prov.tiers.length) {
        lines.push(`#evidence ${tierKv(prov.tiers)}`);
    }
    const rows = result.expanded?.references || result.preview || [];
    for (const ref of rows) {
        const f = ref.file || "?";
        const l = ref.line ?? "?";
        lines.push(`.ref ${f}:${l} kind=${ref.kind || "?"} conf=${ref.confidence || "?"} origin=${ref.origin || "?"}`);
    }
}

function renderFindImplementations(payload, lines) {
    const result = payload?.result || {};
    const prov = result.provenance_summary;
    if (prov && Array.isArray(prov.tiers) && prov.tiers.length) {
        lines.push(`#evidence ${tierKv(prov.tiers)}`);
    }
    const rows = result.expanded?.implementations || result.preview || [];
    for (const impl of rows) {
        lines.push(`.impl kind=${impl.kind || "?"} conf=${impl.confidence || "?"} source=${impl.source || "?"}`);
    }
}

function renderPathRow(path, kindHint) {
    const nodes = Array.isArray(path?.nodes) ? path.nodes : [];
    const names = nodes.map(node => node?.display_name || node?.name || "?");
    const arrow = names.length ? names.join("->") : "?";
    const depth = path?.depth ?? Math.max(0, (path?.edges?.length ?? path?.edge_count ?? 0));
    const start = path?.start;
    const anchor = start ? ` ${start.file || "?"}:${start.line ?? "?"}` : "";
    const kindPart = kindHint ? ` kind=${kindHint}` : "";
    return `.${arrow}${anchor} depth=${depth}${kindPart}`;
}

function renderTracePaths(payload, lines) {
    const result = payload?.result || {};
    const rows = result.expanded?.paths || result.path_previews || [];
    for (const path of rows) lines.push(renderPathRow(path, null));
    const prov = result.provenance_summary;
    if (prov && Array.isArray(prov.tiers) && prov.tiers.length) {
        lines.push(`#provenance ${tierKv(prov.tiers)}`);
    }
}

function renderTraceDataflow(payload, lines) {
    const result = payload?.result || {};
    const rows = result.expanded?.paths || result.path_previews || [];
    for (const path of rows) {
        const kind = path?.edges?.[0]?.kind || path?.hops?.[0]?.kind || null;
        lines.push(renderPathRow(path, kind));
    }
    const prov = result.provenance_summary;
    if (prov && Array.isArray(prov.tiers) && prov.tiers.length) {
        lines.push(`#provenance ${tierKv(prov.tiers)}`);
    }
}

function renderAnalyzeArchitecture(payload, lines) {
    const result = payload?.result || {};
    const modules = result.modules || [];
    for (const module of modules) {
        lines.push(`.module name=${module.module_name || module.module_key || "?"} files=${module.exported_symbols ?? "?"} imports=${module.imported_modules ?? "?"} instability=${module.instability ?? "?"}`);
    }
    const cycles = result.cycles || [];
    if (cycles.length) lines.push(`#cycles total=${cycles.length}`);
    const risks = result.top_risks || [];
    if (risks.length) {
        lines.push(`#hotspots total=${risks.length}`);
        for (const risk of risks) {
            lines.push(`.hotspot ${risk.file || "?"} symbol=${risk.symbol || "?"} reason=${risk.reason || "?"} rank=${risk.rank ?? "?"}`);
        }
    }
}

function renderAnalyzeChanges(payload, lines) {
    const result = payload?.result || {};
    const summary = result.diff_summary || {};
    const changedFiles = result.changed_files || [];
    for (const file of changedFiles) {
        const glyph = file.status === "added" ? "+" : file.status === "deleted" ? "-" : "~";
        lines.push(`.change ${glyph} file=${file.file}`);
    }
    const changedSymbols = result.changed_symbols || [];
    for (const sym of changedSymbols) {
        const risk = sym.risk_level || "?";
        lines.push(`.impact symbol=${sym.symbol || "?"} file=${sym.file || "?"} risk=${risk}`);
    }
    if (summary.changed_file_count != null || summary.changed_symbol_count != null) {
        const parts = [];
        if (summary.changed_file_count != null) parts.push(`changed=${summary.changed_file_count}`);
        if (summary.changed_symbol_count != null) parts.push(`impacted=${summary.changed_symbol_count}`);
        if (summary.risk_counts?.high != null) parts.push(`high=${summary.risk_counts.high}`);
        lines.push(`#summary ${parts.join(" ")}`);
    }
    const deleted = result.deleted_api_warnings || [];
    for (const del of deleted) {
        lines.push(`.deleted symbol=${del.symbol || "?"} file=${del.file || "?"} kind=${del.kind || "?"}`);
    }
}

function renderAnalyzeEditRegion(payload, lines) {
    const result = payload?.result || {};
    const range = result.range || {};
    if (result.file) {
        lines.push(`.region file=${result.file}:${range.line_start ?? "?"}-${range.line_end ?? "?"}`);
    }
    const impact = result.impact_summary || {};
    const parts = [];
    if (impact.external_callers != null) parts.push(`callers=${impact.external_callers}`);
    if (impact.downstream_flows != null) parts.push(`flows=${impact.downstream_flows}`);
    if (impact.clone_siblings != null) parts.push(`clones=${impact.clone_siblings}`);
    if (parts.length) lines.push(`#impact ${parts.join(" ")}`);
    const edited = result.edited_symbols || [];
    for (const sym of edited) {
        const file = sym.file || "?";
        const line = sym.line_start ?? sym.line ?? "?";
        lines.push(`.edited ${file}:${line} name=${sym.display_name || sym.name || "?"} kind=${sym.kind || "?"}`);
    }
}

function renderAuditWorkspace(payload, lines) {
    const result = payload?.result || {};
    const risk = result.risk_summary || {};
    const summaryParts = [];
    if (risk.unused_exports != null) summaryParts.push(`unused=${risk.unused_exports}`);
    if (risk.hotspots != null) summaryParts.push(`hotspots=${risk.hotspots}`);
    if (risk.clone_groups != null) summaryParts.push(`clone_groups=${risk.clone_groups}`);
    if (summaryParts.length) lines.push(`#summary ${summaryParts.join(" ")}`);
    const unused = result.unused_exports || [];
    for (const item of unused) {
        const file = item.file || "?";
        const line = item.line_start ?? item.line ?? "?";
        const exported = item.is_exported || item.exported ? 1 : 0;
        lines.push(`.unused ${file}:${line} fn=${item.name || "?"} exported=${exported}`);
    }
    const hotspots = result.hotspots || [];
    for (const item of hotspots) {
        const file = item.file || "?";
        const line = item.line_start ?? "?";
        const complexity = item.complexity ?? item.stmt_count ?? "?";
        const callers = item.callers ?? "?";
        lines.push(`.hotspot ${file}:${line} name=${item.name || "?"} complexity=${complexity} callers=${callers}`);
    }
    const clones = result.clones || [];
    for (const group of clones) {
        const id = group.id || "?";
        const members = group.members || [];
        const totalMembers = group.members_total ?? members.length;
        const omittedMembers = group.members_omitted ?? Math.max(0, totalMembers - members.length);
        lines.push(`.clone_group id=${id} type=${group.type || "?"} members=${totalMembers} shown=${members.length} impact=${group.impact || "?"}`);
        for (const member of members) {
            const linesPair = Array.isArray(member.lines) ? `${member.lines[0]}-${member.lines[1]}` : "?";
            lines.push(`.clone_member group=${id} file=${member.file || "?"} lines=${linesPair} name=${member.name || "?"} callers=${member.callers ?? "?"}`);
        }
        if (omittedMembers > 0) {
            lines.push(`.clone_members_more group=${id} omitted=${omittedMembers}`);
        }
    }
}

function renderExportScip(payload, lines) {
    const result = payload?.result || {};
    const path = result.output_path || result.outputPath || result.path || "?";
    const rev = result.rev || payload?.evidence?.rev || "?";
    lines.push(`#scip rev=${rev} path=${path}`);
}

function renderImportScipOverlay(payload, lines) {
    const result = payload?.result || {};
    const applied = result.applied ?? result.imported ?? result.edges_imported ?? 0;
    lines.push(`#overlay applied=${applied}`);
}

function renderInstallGraphProviders(payload, lines) {
    const result = payload?.result || {};
    const items = result.items || [];
    const summary = result.summary || {};
    for (const item of items) {
        const state = item.status === "ok" || item.status === "installed" ? "installed" : item.status === "skipped" ? "skipped" : "missing";
        lines.push(`.provider name=${item.id || "?"} state=${state} kind=${item.kind || "?"}`);
    }
    if (items.length || summary.missing_count != null) {
        lines.push(`#providers total=${items.length} installed=${summary.installed_count ?? 0} missing=${summary.missing_count ?? 0}`);
    }
}

function renderIndexProject(payload, lines) {
    const status = payload?.result?.status || {};
    const rev = status.rev || status.revision || "?";
    const files = status.files ?? status.file_count ?? "?";
    const symbols = status.symbols ?? status.node_count ?? "?";
    lines.push(`#index rev=${rev} files=${files} symbols=${symbols}`);
}

function renderQuality(payload, lines) {
    const quality = payload?.quality;
    if (!quality) return;
    const parts = [];
    if (quality.query_family) parts.push(`family=${quality.query_family}`);
    if (quality.support_tier) parts.push(`tier=${quality.support_tier}`);
    if (Array.isArray(quality.languages) && quality.languages.length) parts.push(`langs=${quality.languages.join(",")}`);
    if (Array.isArray(quality.frameworks) && quality.frameworks.length) parts.push(`frameworks=${quality.frameworks.join(",")}`);
    if (Array.isArray(quality.quality_basis) && quality.quality_basis.length) parts.push(`basis=${quality.quality_basis.join(",")}`);
    if (Array.isArray(quality.known_limitations) && quality.known_limitations.length) parts.push(`limitations=${quality.known_limitations.length}`);
    if (parts.length) lines.push(`#quality ${parts.join(" ")}`);
}

const TOOL_RENDERERS = {
    find_symbols: renderFindSymbols,
    inspect_symbol: renderInspectSymbol,
    find_references: renderFindReferences,
    find_implementations: renderFindImplementations,
    trace_paths: renderTracePaths,
    trace_dataflow: renderTraceDataflow,
    analyze_architecture: renderAnalyzeArchitecture,
    analyze_changes: renderAnalyzeChanges,
    analyze_edit_region: renderAnalyzeEditRegion,
    audit_workspace: renderAuditWorkspace,
    export_scip: renderExportScip,
    import_scip_overlay: renderImportScipOverlay,
    install_graph_providers: renderInstallGraphProviders,
    index_project: renderIndexProject,
};

function renderGrammar(payload, toolName) {
    const lines = [buildActionLine(payload, toolName)];
    try {
        const status = (payload?.status || "ok").toLowerCase();
        if (status === "error" || payload?.error) {
            const err = payload?.error || {};
            const code = err.code || payload?.code || "UNKNOWN";
            const message = err.message || payload?.summary || "";
            lines.push(`!code=${escapeValue(code)}`);
            if (payload?.failure_class) lines.push(`!failure_class=${escapeValue(payload.failure_class)}`);
            if (message) lines.push(`!message=${escapeValue(message)}`);
            const recovery = err.recovery || payload?.recovery;
            if (typeof recovery === "string" && recovery.startsWith(">mcp__hex-graph__")) {
                lines.push(recovery);
            }
            return lines.join("\n");
        }
        if (status === "not_found") lines.push(`!reason=${escapeValue(payload?.reason || "no_matches")}`);
        if (status === "stale") lines.push(`!reason=${escapeValue(payload?.reason || "stale_index")}`);
        const renderer = TOOL_RENDERERS[toolName];
        if (renderer) {
            renderer(payload, lines);
        } else {
            lines.push(`!code=RENDER_FALLBACK`);
            lines.push(`?debug=${escapeValue(JSON.stringify(payload).slice(0, 4000))}`);
        }
        renderQuality(payload, lines);
        emitWarningsAndPointers(payload, lines);
    } catch (err) {
        lines.push(`!code=RENDER_FALLBACK`);
        lines.push(`?debug=${escapeValue(String(err?.message || err).slice(0, 400))}`);
    }
    return lines.join("\n");
}


const REFERENCE_KINDS = [
    "ref_read",
    "ref_type",
    "calls",
    "reexports",
    "imports",
    "route_to_handler",
    "injects",
    "registers",
    "renders",
    "middleware_for",
    "all",
];

const { server, StdioServerTransport } = await createServerRuntime({
    name: "hex-graph-mcp",
    version,
});

let shutdownCleanupRan = false;
function runShutdownCleanup() {
    if (shutdownCleanupRan) return;
    shutdownCleanupRan = true;
    try { closeAllStores(); } catch { /* best-effort shutdown */ }
}

process.once("beforeExit", runShutdownCleanup);
process.once("exit", runShutdownCleanup);
process.once("SIGINT", () => {
    runShutdownCleanup();
    process.exit(130);
});
process.once("SIGTERM", () => {
    runShutdownCleanup();
    process.exit(143);
});

function graphNextAction(code) {
    switch (code) {
    case "NOT_INDEXED":
        return ACTION.INDEX_PROJECT;
    case "GRAPH_DB_BUSY":
        return ACTION.FIX_DB_LOCK;
    case "GRAPH_DB_UNREADABLE":
        return ACTION.FIX_DB_ACCESS;
    case "PATH_NOT_FOUND":
    case "FILE_OUTSIDE_PROJECT":
        return ACTION.FIX_PATH;
    case "GRAPH_PROVIDER_SETUP_FAILED":
        return ACTION.CHECK_PROVIDER_SETUP;
    case "SCIP_EXPORT_FAILED":
    case "SCIP_IMPORT_FAILED":
        return ACTION.CHECK_SCIP_INPUTS;
    default:
        return ACTION.ADJUST_QUERY;
    }
}

function graphError(codeOrError, message, recovery) {
    const errorCode = typeof codeOrError === "object" && codeOrError ? codeOrError.code : codeOrError;
    const fallbackRecovery = errorCode === "NOT_INDEXED"
        ? "Run index_project on the project root first; symbol/query tools then accept that root or a file/subdirectory inside it as path."
        : "Adjust selector or run find_symbols first";
    const error = typeof codeOrError === "object" && codeOrError
        ? {
            ...codeOrError,
            recovery: codeOrError.recovery || recovery || fallbackRecovery,
        }
        : {
            code: codeOrError,
            message,
            recovery: recovery || fallbackRecovery,
        };
    const classification = classifyMcpFailure(error);
    const payload = pruneEmpty({
        status: STATUS.ERROR,
        code: error.code,
        summary: error.message,
        next_action: graphNextAction(error.code),
        recovery: error.recovery,
        failure_class: classification.failure_class,
        error: { code: error.code, message: error.message, recovery: error.recovery },
    }) || { status: STATUS.ERROR };
    const text = renderGrammar(payload, null);
    return textErrorResult(text);
}

function selectorSchema() {
    return {
        symbol_id: flexNum().describe("Canonical symbol id"),
        workspace_qualified_name: z.string().optional().describe("Canonical workspace-qualified symbol name"),
        qualified_name: z.string().optional().describe("Canonical qualified symbol name"),
        name: z.string().optional().describe("Symbol name (must be paired with file)"),
        file: z.string().optional().describe("File path used with name to disambiguate symbol"),
    };
}

function targetSelectorSchema() {
    return {
        to_symbol_id: flexNum().describe("Optional target symbol id"),
        to_workspace_qualified_name: z.string().optional().describe("Optional target workspace-qualified symbol name"),
        to_qualified_name: z.string().optional().describe("Optional target qualified symbol name"),
        to_name: z.string().optional().describe("Optional target symbol name (must be paired with to_file)"),
        to_file: z.string().optional().describe("Optional target file used with to_name"),
    };
}

function buildTargetSelector(params) {
    const { to_symbol_id, to_workspace_qualified_name, to_qualified_name, to_name, to_file } = params;
    if (
        to_symbol_id === undefined &&
        to_workspace_qualified_name === undefined &&
        to_qualified_name === undefined &&
        to_name === undefined &&
        to_file === undefined
    ) {
        return null;
    }
    return {
        symbol_id: to_symbol_id,
        workspace_qualified_name: to_workspace_qualified_name,
        qualified_name: to_qualified_name,
        name: to_name,
        file: to_file,
    };
}

function confidenceSchema() {
    return z.enum(CONFIDENCE_VALUES).optional().describe("Filter out facts below this confidence tier");
}

function verbositySchema() {
    return z.enum(["minimal", "compact", "full"]).default("compact").describe("Response budget. `minimal` returns the shortest actionable answer, `compact` keeps key reasoning visible, and `full` includes supporting detail.");
}

function expandSchema() {
    return z.array(z.string()).optional().describe("Optional bounded expansion sections to materialize. Heavy tools return counts/previews by default and expand only the requested sections.");
}

function expandLimitSchema() {
    return flexNum().describe("Max rows to materialize for expanded sections (default: 10, capped at 25)");
}

function includeEvidenceSchema() {
    return flexBool().default(false).describe("Include supporting evidence in expanded rows. Defaults to false to keep payloads compact.");
}

function flowPointSchema() {
    return z.object({
        symbol: z.object(selectorSchema()).describe("Canonical selector for the symbol that owns this flow point"),
        anchor: z.object({
            kind: z.enum(FLOW_ANCHOR_KINDS),
            name: z.string().optional().describe("Anchor name for param/local/property"),
            access_path: z.array(z.string()).optional().describe("Bounded property path segments for property anchors"),
        }).describe("Anchor within the selected symbol"),
    });
}

function pruneForVerbosity(payload, verbosity = "full") {
    if (verbosity === "full") return payload;
    const next = { ...payload };
    delete next.quality;
    delete next.evidence;
    delete next.limits_applied;
    if (verbosity === "minimal") delete next.reason;
    return pruneEmpty(next) || {};
}

function previewCount(result) {
    if (!result || typeof result !== "object") return null;
    if (Array.isArray(result.candidates)) return result.candidates.length;
    if (Array.isArray(result.preview)) return result.preview.length;
    if (Array.isArray(result.path_previews)) return result.path_previews.length;
    return null;
}

function resultTotal(result) {
    if (!result || typeof result !== "object") return null;
    return result.total ?? result.path_count ?? result.candidate_count ?? null;
}

function isPartialPayload(payload) {
    const result = payload?.result || {};
    if (result.truncated || payload?.limits_applied?.truncated) return true;
    const total = resultTotal(result);
    const returned = result.shown_count ?? previewCount(result);
    return total != null && returned != null && total > returned;
}

function isNotFoundPayload(payload, toolName) {
    const result = payload?.result || {};
    if (toolName === "find_symbols") return result.candidate_count === 0;
    if (toolName === "find_references" || toolName === "find_implementations") return result.total === 0;
    if (toolName === "trace_paths" || toolName === "trace_dataflow") return result.path_count === 0;
    if (toolName === "analyze_edit_region") return Array.isArray(result.edited_symbols) && result.edited_symbols.length === 0;
    return false;
}

function deriveStatus(payload, toolName) {
    if (payload?.status && payload.status !== STATUS.OK) return payload.status;
    if (isNotFoundPayload(payload, toolName)) return STATUS.NOT_FOUND;
    if (isPartialPayload(payload)) return STATUS.PARTIAL;
    return STATUS.OK;
}

function selectNextAction(payload, toolName) {
    if (payload?.next_action) return payload.next_action;
    const actions = payload?.next_actions || [];
    const status = deriveStatus(payload, toolName);
    if (status === STATUS.PARTIAL) return "expand";
    if (status === STATUS.NOT_FOUND) {
        return actions.find(action => [ACTION.WIDEN_QUERY, ACTION.ADJUST_QUERY, ACTION.INDEX_PROJECT, ACTION.WIDEN_RANGE].includes(action))
            || ACTION.WIDEN_QUERY;
    }
    if (actions.length) return actions[0];
    return "keep_using";
}

function preparePayload(useCaseResult, toolName) {
    const payload = pruneEmpty({
        status: STATUS.OK,
        ...useCaseResult,
    }) || {};
    payload.status = deriveStatus(payload, toolName);
    payload.next_action = selectNextAction(payload, toolName);
    return payload;
}

function wrapResult(useCaseResult, toolName, verbosity = "full") {
    if (useCaseResult?.error) {
        return graphError(useCaseResult.error);
    }
    const payload = pruneForVerbosity(preparePayload(useCaseResult, toolName), verbosity);
    const text = renderGrammar(payload, toolName);
    const large = text.length > 50_000;
    return textResult(text, { large });
}

function unique(values) {
    return [...new Set((values || []).filter(Boolean))];
}

function withQuality(result, quality) {
    if (!quality || result?.error) return result;
    return { ...result, quality };
}

function referencesQuality(result) {
    const rows = result?.result?.expanded?.references || result?.result?.preview || result?.result?.references || [];
    return buildInlineQuality({
        queryFamily: "find_references",
        languages: [result?.result?.symbol?.language],
        frameworks: collectFrameworksFromOrigins(rows?.map(reference => reference.origin)),
    });
}

function traceQuality(result) {
    const paths = Array.isArray(result?.result) ? result.result : result?.result?.expanded?.paths || [];
    return buildInlineQuality({
        queryFamily: "trace_paths",
        languages: unique(paths.flatMap(path => path.nodes?.map(node => node.language) || [])),
        frameworks: collectFrameworksFromOrigins(paths.flatMap(path => (path.edges || path.hops || []).map(edge => edge.origin) || [])),
    });
}

function inspectQuality(result) {
    return buildInlineQuality({
        queryFamily: "find_references",
        languages: [result?.result?.symbol?.language],
        frameworks: result?.result?.framework_roles || [],
    });
}

function changesQuality(result) {
    return buildInlineQuality({
        queryFamily: "trace_paths",
        languages: unique(result?.result?.changed_symbols?.map(symbol => symbol.language)),
        frameworks: unique(result?.result?.changed_symbols?.flatMap(symbol => collectFrameworksFromOrigins(symbol.framework_origins || []))),
    });
}

function editRegionQuality(result) {
    return buildInlineQuality({
        queryFamily: "trace_paths",
        languages: result?.result?.languages || [],
        frameworks: [],
    });
}

function architectureQuality(result) {
    return buildInlineQuality({
        queryFamily: "analyze_architecture",
        languages: unique(result?.result?.modules?.map(module => module.language).filter(Boolean)),
        frameworks: collectFrameworksFromOrigins(result?.result?.framework_surfaces?.map(row => row.origin)),
    });
}

function auditQuality(result) {
    const suppressOrigins = result?.result?.suppressed_items
        ?.flatMap(item => item.suppress_evidence?.map(entry => entry.origin) || []) || [];
    const visibleFiles = [
        ...(result?.result?.unused_exports || []).map(item => item.file),
        ...(result?.result?.uncertain_unused_exports || []).map(item => item.file),
        ...(result?.result?.hotspots || []).map(item => item.file),
        ...(result?.result?.clones || []).flatMap(group => group.members?.map(member => member.file) || []),
    ];
    return buildInlineQuality({
        queryFamily: "audit_workspace",
        languages: unique(visibleFiles.map(file => {
            if (!file) return null;
            if (file.endsWith(".py")) return "python";
            if (file.endsWith(".php")) return "php";
            if (file.endsWith(".cs")) return "csharp";
            if (file.endsWith(".ts") || file.endsWith(".tsx")) return "typescript";
            if (file.endsWith(".js") || file.endsWith(".mjs") || file.endsWith(".cjs") || file.endsWith(".jsx")) return "javascript";
            return null;
        })),
        frameworks: collectFrameworksFromOrigins(suppressOrigins),
    });
}

server.registerTool("index_project", {
    title: "Index Project",
    description: "Scan and index a project into the graph kernel, honoring Git excludes by default and including precise/framework overlays when available.",
    inputSchema: z.object({
        path: z.string().describe("Project root directory"),
        languages: z.array(z.string()).optional().describe("Filter indexed languages"),
    }),
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
}, async (rawParams) => {
    const { path: projectPath, languages } = rawParams;
    try {
        const { indexProject } = await import("./lib/indexer.mjs");
        const result = await indexProject(projectPath, { languages });
        return wrapResult({
            query: { path: projectPath, languages: languages || null },
            result: { status: result },
            confidence: "exact",
            reason: "index_project_completed",
            evidence: {},
            limits_applied: {},
        }, "index_project", "full");
    } catch (e) {
        const message = e?.message || String(e);
        if (e?.code === "GRAPH_DB_UNREADABLE") {
            return graphError("GRAPH_DB_UNREADABLE", message, "Inspect the same-project graph DB files, ensure they are readable, then rerun index_project");
        }
        if (e?.code === "GRAPH_DB_BUSY" || e?.code === "EBUSY" || e?.code === "EPERM" || /busy or locked/i.test(message)) {
            return graphError("GRAPH_DB_BUSY", message, "Close the same-project graph DB in other hex-graph/editor sessions, wait for idle-close, then rerun index_project");
        }
        return graphError("PATH_NOT_FOUND", message, "Check path exists and is accessible");
    }
});

server.registerTool("install_graph_providers", {
    title: "Install Graph Providers",
    description: "Detect graph-specific providers and optional SCIP exporters for the current project, then return exact remediation steps or install them on demand. This never installs runtimes or project dependencies.",
    inputSchema: z.object({
        path: z.string().describe("Project root used for language detection and provider planning"),
        mode: z.enum(["check", "install"]).default("check").describe("`check` reports the plan and remediation steps only. `install` runs the provider install commands when they are available for the current platform."),
        include_optional_scip: z.boolean().default(true).describe("Include optional SCIP exporter checks alongside precise providers."),
    }),
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true },
}, async (rawParams) => {
    const { path, mode, include_optional_scip } = rawParams;
    try {
        const result = installGraphProviders({
            path,
            mode,
            includeOptionalScip: include_optional_scip,
        });
        return wrapResult({
            query: {
                path,
                mode,
                include_optional_scip,
            },
            result,
            confidence: "exact",
            reason: mode === "install" ? "graph_providers_install_attempted" : "graph_providers_checked",
            evidence: { layer: "environment", origin: "graph_provider_planner" },
            limits_applied: {},
        }, "install_graph_providers", "full");
    } catch (error) {
        return graphError("GRAPH_PROVIDER_SETUP_FAILED", error.message, "Verify the project path exists, then rerun install_graph_providers in `check` mode to inspect remediation steps.");
    }
});

server.registerTool("export_scip", {
    title: "Export SCIP",
    description: "Export indexed symbol facts to a binary SCIP artifact. TypeScript/JavaScript uses the native compiler lane; Python, PHP, and C# use their upstream SCIP indexers.",
    inputSchema: z.object({
        path: z.string().describe("Indexed project root"),
        output_path: z.string().describe("Destination `.scip` path. Relative paths resolve from the project root."),
        language: z.enum(SCIP_EXPORT_LANGUAGES).default("typescript").describe("SCIP export backend. `typescript` uses the native compiler lane; `python`, `php`, and `csharp` orchestrate official SCIP indexers."),
        include_external_symbols: z.boolean().default(true).describe("Include lightweight metadata for declaration-file symbols when available."),
        project_name: z.string().optional().describe("Python only: explicit SCIP project name. Defaults to pyproject/setup metadata or the project folder name."),
        project_namespace: z.string().optional().describe("Python only: optional namespace prefix for generated symbols."),
        target_only: z.string().optional().describe("Python only: optional subdirectory to index instead of the full project."),
        environment_path: z.string().optional().describe("Python only: optional path to a scip-python environment JSON file."),
        working_directory: z.string().optional().describe("C# only: optional working directory passed through to scip-dotnet."),
    }),
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true },
}, async (rawParams) => {
    const {
        path,
        output_path,
        language,
        include_external_symbols,
        project_name,
        project_namespace,
        target_only,
        environment_path,
        working_directory,
    } = rawParams;
    try {
        const result = await exportScip({
            path,
            outputPath: output_path,
            language,
            includeExternalSymbols: include_external_symbols,
            projectName: project_name,
            projectNamespace: project_namespace,
            targetOnly: target_only,
            environmentPath: environment_path,
            workingDirectory: working_directory,
        });
        return wrapResult({
            query: {
                path,
                output_path,
                language,
                include_external_symbols,
                project_name: project_name || null,
                project_namespace: project_namespace || null,
                target_only: target_only || null,
                environment_path: environment_path || null,
                working_directory: working_directory || null,
            },
            result,
            confidence: "exact",
            reason: "scip_export_completed",
            evidence: { layer: "interop", origin: "scip_export" },
            limits_applied: {},
        }, "export_scip", "full");
    } catch (error) {
        return graphError("SCIP_EXPORT_FAILED", error.message, "Run index_project first, verify the output path is writable, and install the required upstream SCIP indexer when using Python, PHP, or C#");
    }
});

server.registerTool("import_scip_overlay", {
    title: "Import SCIP Overlay",
    description: "Import a binary SCIP artifact into provenance-tagged overlay facts without replacing the native graph. The import lane is derived from the artifact documents.",
    inputSchema: z.object({
        path: z.string().describe("Indexed project root"),
        artifact_path: z.string().describe("Path to a `.scip` artifact. Relative paths resolve from the project root."),
        replace_existing: z.boolean().default(true).describe("Clear prior `scip_import` overlay edges before importing this artifact."),
    }),
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true },
}, async (rawParams) => {
    const { path, artifact_path, replace_existing } = rawParams;
    try {
        const result = await importScipOverlay({
            path,
            artifactPath: artifact_path,
            replaceExisting: replace_existing,
        });
        return wrapResult({
            query: { path, artifact_path, replace_existing },
            result,
            confidence: "exact",
            reason: "scip_import_completed",
            evidence: { layer: "interop", origin: "scip_import" },
            limits_applied: {},
        }, "import_scip_overlay", "full");
    } catch (error) {
        return graphError("SCIP_IMPORT_FAILED", error.message, "Run index_project first, verify the SCIP artifact path, and ensure the artifact contains supported document languages");
    }
});

server.registerTool("find_symbols", {
    title: "Find Symbols",
    description: "Find candidate symbols by name or partial name before selecting a canonical identity for deeper graph analysis.",
    inputSchema: z.object({
        query: z.string().describe("Symbol name or partial name"),
        kind: z.string().optional().describe("Optional kind filter"),
        limit: flexNum().describe("Max detailed candidate symbols to return (default: 8)"),
        path: z.string().describe("Indexed project root or a file/directory inside the indexed project"),
    }),
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
}, async (rawParams) => {
    const { query, kind, limit, path } = rawParams;
    const result = runFindSymbolsUseCase(query, { kind, limit: limit ?? 8, path });
    return wrapResult(result, "find_symbols", "minimal");
});

server.registerTool("inspect_symbol", {
    title: "Inspect Symbol",
    description: "Return a symbol-centric briefing: canonical resolution, local context, incoming and outgoing relations, reference summary, and implementation summary.",
    inputSchema: z.object({
        ...selectorSchema(),
        min_confidence: confidenceSchema(),
        verbosity: verbositySchema(),
        expand: expandSchema(),
        expand_limit: expandLimitSchema(),
        include_evidence: includeEvidenceSchema(),
        path: z.string().describe("Indexed project root or a file/directory inside the indexed project"),
    }),
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
}, async (rawParams) => {
    const { path, min_confidence, verbosity, expand, expand_limit, include_evidence, ...selector } = rawParams;
    const result = runInspectSymbolUseCase(selector, {
        path,
        minConfidence: min_confidence ?? null,
        verbosity: verbosity ?? "compact",
        expand,
        expandLimit: expand_limit ?? null,
        includeEvidence: include_evidence ?? false,
    });
    return wrapResult(withQuality(result, inspectQuality(result)), "inspect_symbol", verbosity ?? "compact");
});

server.registerTool("trace_paths", {
    title: "Trace Paths",
    description: "Trace graph paths from a canonical symbol through calls, references, imports, type, flow, or mixed edges. Mixed traces can include framework overlay hops.",
    inputSchema: z.object({
        ...selectorSchema(),
        ...targetSelectorSchema(),
        path_kind: z.enum(["calls", "references", "imports", "type", "flow", "mixed"]).default("calls").describe("Traversal edge set. `mixed` includes framework overlay hops when present."),
        direction: z.enum(["forward", "reverse", "both"]).default("reverse"),
        depth: flexNum().describe("Max traversal depth (default: 3)"),
        limit: flexNum().describe("Max paths (default: 10)"),
        min_confidence: confidenceSchema(),
        verbosity: verbositySchema(),
        expand: expandSchema(),
        expand_limit: expandLimitSchema(),
        include_evidence: includeEvidenceSchema(),
        path: z.string().describe("Indexed project root or a file/directory inside the indexed project"),
    }),
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
}, async (rawParams) => {
    const { path, path_kind, direction, depth, limit, min_confidence, verbosity, expand, expand_limit, include_evidence, ...selector } = rawParams;
    const target = buildTargetSelector(selector);
    delete selector.to_symbol_id;
    delete selector.to_workspace_qualified_name;
    delete selector.to_qualified_name;
    delete selector.to_name;
    delete selector.to_file;
    const result = runTracePathsUseCase(selector, {
        pathKind: path_kind ?? "calls",
        direction: direction ?? "reverse",
        depth: depth ?? 3,
        limit: limit ?? 10,
        minConfidence: min_confidence ?? null,
        path,
        target,
        verbosity: verbosity ?? "compact",
        expand,
        expandLimit: expand_limit ?? null,
        includeEvidence: include_evidence ?? false,
    });
    return wrapResult(withQuality(result, traceQuality(result)), "trace_paths", verbosity ?? "compact");
});

server.registerTool("find_references", {
    title: "Find References",
    description: "Find semantic usages of a canonical symbol identity, including framework overlay wiring when present.",
    inputSchema: z.object({
        ...selectorSchema(),
        kind: z.enum(REFERENCE_KINDS).default("all").describe("Optional edge-kind filter. Includes semantic and framework kinds such as `route_to_handler`, `injects`, `registers`, `renders`, and `middleware_for`."),
        limit: flexNum().describe("Max references (default: 10)"),
        min_confidence: confidenceSchema(),
        verbosity: verbositySchema(),
        expand: expandSchema(),
        expand_limit: expandLimitSchema(),
        include_evidence: includeEvidenceSchema(),
        path: z.string().describe("Indexed project root or a file/directory inside the indexed project"),
    }),
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
}, async (rawParams) => {
    const { path, kind, limit, min_confidence, verbosity, expand, expand_limit, include_evidence, ...selector } = rawParams;
    const result = runFindReferencesUseCase(selector, {
        kind: kind ?? "all",
        limit: limit ?? 10,
        minConfidence: min_confidence ?? null,
        path,
        verbosity: verbosity ?? "compact",
        expand,
        expandLimit: expand_limit ?? null,
        includeEvidence: include_evidence ?? false,
    });
    return wrapResult(withQuality(result, referencesQuality(result)), "find_references", verbosity ?? "compact");
});

server.registerTool("find_implementations", {
    title: "Find Implementations",
    description: "Find implementations and overrides for a canonical symbol identity.",
    inputSchema: z.object({
        ...selectorSchema(),
        limit: flexNum().describe("Max implementation rows to return (default: 10)"),
        verbosity: verbositySchema(),
        expand: expandSchema(),
        expand_limit: expandLimitSchema(),
        include_evidence: includeEvidenceSchema(),
        path: z.string().describe("Indexed project root or a file/directory inside the indexed project"),
    }),
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
}, async (rawParams) => {
    const { path, limit, verbosity, expand, expand_limit, include_evidence, ...selector } = rawParams;
    const result = runFindImplementationsUseCase(selector, {
        path,
        limit: limit ?? 10,
        verbosity: verbosity ?? "compact",
        expand,
        expandLimit: expand_limit ?? null,
        includeEvidence: include_evidence ?? false,
    });
    return wrapResult(result, "find_implementations", verbosity ?? "compact");
});

server.registerTool("trace_dataflow", {
    title: "Trace Dataflow",
    description: "Find deterministic source-to-sink dataflow paths between anchored flow points.",
    inputSchema: z.object({
        source: flowPointSchema(),
        sink: flowPointSchema().optional(),
        flow_kind: z.enum(["value", "taint"]).default("value"),
        max_hops: flexNum().describe(`Max flow propagation hops (default: ${DEFAULT_FLOW_MAX_HOPS})`),
        limit: flexNum().describe("Max flow paths (default: 10)"),
        min_confidence: confidenceSchema(),
        verbosity: verbositySchema(),
        expand: expandSchema(),
        expand_limit: expandLimitSchema(),
        include_evidence: includeEvidenceSchema(),
        path: z.string().describe("Indexed project root or a file/directory inside the indexed project"),
    }),
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
}, async (rawParams) => {
    const { path, source, sink, flow_kind, max_hops, limit, min_confidence, verbosity, expand, expand_limit, include_evidence } = rawParams;
    const result = runTraceDataflowUseCase({
        source,
        sink,
        flow_kind: flow_kind ?? "value",
        max_hops: max_hops ?? DEFAULT_FLOW_MAX_HOPS,
        min_confidence: min_confidence ?? null,
    }, {
        limit: limit ?? 10,
        path,
        verbosity: verbosity ?? "compact",
        expand,
        expandLimit: expand_limit ?? null,
        includeEvidence: include_evidence ?? false,
    });
    return wrapResult(result, "trace_dataflow", verbosity ?? "compact");
});

server.registerTool("analyze_changes", {
    title: "Analyze Changes",
    description: "Review a git diff, commit range, or worktree change set and return a compact semantic risk snapshot with changed symbols, deleted API warnings, and optional supporting paths.",
    inputSchema: z.object({
        path: z.string().describe("Indexed project root"),
        base_ref: z.string().describe("Git baseline ref used to compute the changed-symbol set"),
        head_ref: z.string().optional().describe("Optional git head ref. If omitted, the current checkout/worktree is compared to `base_ref`."),
        include_paths: z.boolean().default(false).describe("Include reverse mixed graph paths for the returned symbols. Default is false to keep the snapshot compact."),
        max_symbols: flexNum().describe("Maximum changed symbols to return after risk ranking (default: 10)"),
        max_paths: flexNum().describe("Maximum supporting paths per symbol when `include_paths` is true (default: 3)"),
    }),
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
}, async (rawParams) => {
    const { path, base_ref, head_ref, include_paths, max_symbols, max_paths } = rawParams;
    try {
        const result = await runAnalyzeChangesUseCase({
            path,
            baseRef: base_ref,
            headRef: head_ref || null,
            includePaths: include_paths,
            maxSymbols: max_symbols ?? 10,
            maxPaths: max_paths ?? 3,
        });
        if (result?.error) {
            return graphError(result.error);
        }
        return wrapResult(withQuality(result, changesQuality(result)), "analyze_changes", "minimal");
    } catch (error) {
        return graphError("ANALYZE_CHANGES_FAILED", error.message, "Run index_project first, then verify the git refs and project path.");
    }
});

server.registerTool("analyze_edit_region", {
    title: "Analyze Edit Region",
    description: "Inspect the semantic impact of editing a concrete file range: edited symbols, external callers, downstream flow, framework wiring, and duplicate/code-clone risk.",
    inputSchema: z.object({
        path: z.string().describe("Indexed project root"),
        file: z.string().describe("File path inside the indexed project. Absolute paths are accepted when they stay inside the project root."),
        line_start: flexNum().describe("1-based starting line of the edited region"),
        line_end: flexNum().describe("1-based ending line of the edited region"),
        verbosity: verbositySchema(),
    }),
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
}, async (rawParams) => {
    const { path, file, line_start, line_end, verbosity } = rawParams;
    const result = runAnalyzeEditRegionUseCase({
        path,
        file,
        lineStart: line_start,
        lineEnd: line_end,
        verbosity: verbosity ?? "compact",
    });
    if (result?.error) {
        return graphError(result.error);
    }
    return wrapResult(withQuality(result, editRegionQuality(result)), "analyze_edit_region", verbosity ?? "compact");
});

server.registerTool("analyze_architecture", {
    title: "Analyze Architecture",
    description: "Return a high-level architecture view with modules, dependency boundaries, cycles, coupling, framework surfaces, and top risks.",
    inputSchema: z.object({
        path: z.string().describe("Indexed project root"),
        scope: z.string().optional().describe("Optional file path prefix filter"),
        limit: flexNum().describe("Max module, cycle, coupling, and hotspot rows to surface (default: 5)"),
        verbosity: verbositySchema(),
    }),
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
}, async (rawParams) => {
    const { path, scope, limit, verbosity } = rawParams;
    const result = runAnalyzeArchitectureUseCase({
        path,
        scope: scope || null,
        limit: limit ?? 5,
        verbosity: verbosity ?? "minimal",
    });
    if (result?.error) {
        return graphError(result.error);
    }
    return wrapResult(withQuality(result, architectureQuality(result)), "analyze_architecture", verbosity ?? "minimal");
});

server.registerTool("audit_workspace", {
    title: "Audit Workspace",
    description: "Audit the indexed workspace for cleanup and maintainability issues: unused exports, hotspots, and clone groups with a single review-oriented result.",
    inputSchema: z.object({
        path: z.string().describe("Indexed project root"),
        scope: z.string().optional().describe("Optional file path prefix filter"),
        verbosity: verbositySchema(),
        limit: flexNum().describe("Max unused, hotspot, and clone group rows to surface (default: 5, capped at 25)"),
        clone_member_limit: flexNum().describe("Max clone members per group to surface (default: 3, or 10 with verbosity=full, capped at 25)"),
        show_suppressed: flexBool().describe("Include suppressed unused exports in the visible result"),
    }),
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
}, async (rawParams) => {
    const { path, scope, verbosity, show_suppressed, limit, clone_member_limit } = rawParams;
    const result = runAuditWorkspaceUseCase({
        path,
        scope: scope || null,
        verbosity: verbosity ?? "minimal",
        showSuppressed: show_suppressed ?? false,
        limit,
        cloneMemberLimit: clone_member_limit,
    });
    if (result?.error) {
        return graphError(result.error);
    }
    return wrapResult(withQuality(result, auditQuality(result)), "audit_workspace", verbosity ?? "minimal");
});

const transport = new StdioServerTransport();
await server.connect(transport);
void checkForUpdates("@levnikolaevich/hex-graph-mcp", version);
