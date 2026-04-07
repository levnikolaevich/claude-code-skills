#!/usr/bin/env node
/**
 * hex-graph-mcp — identity-first graph kernel MCP server.
 * Transport: stdio
 */

import { z } from "zod";
const version = typeof __HEX_VERSION__ !== "undefined" ? __HEX_VERSION__ // eslint-disable-line no-undef
  : (await import("node:module")).createRequire(import.meta.url)("./package.json").version;
import { createServerRuntime } from "@levnikolaevich/hex-common/runtime/mcp-bootstrap";
import { flexBool, flexNum } from "@levnikolaevich/hex-common/runtime/schema";
import { checkForUpdates } from "@levnikolaevich/hex-common/runtime/update-check";
import { tracePaths, getReferencesBySelector, findImplementationsBySelector } from "./lib/store.mjs";
import { closeAllStores } from "./lib/store.mjs";
import { CONFIDENCE_VALUES } from "./lib/confidence.mjs";
import { DEFAULT_FLOW_LIMIT, DEFAULT_FLOW_MAX_HOPS, FLOW_ANCHOR_KINDS } from "./lib/flow.mjs";
import { DEFAULT_PR_IMPACT_MAX_PATHS, DEFAULT_PR_IMPACT_MAX_SYMBOLS } from "./lib/pr-impact.mjs";
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
    runInspectSymbolUseCase,
    runTraceDataflowUseCase,
} from "./lib/use-cases.mjs";
import { ACTION, pruneEmpty, STATUS } from "./lib/output-contract.mjs";

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
    const payload = pruneEmpty({
        status: STATUS.ERROR,
        code: error.code,
        summary: error.message,
        next_action: graphNextAction(error.code),
        recovery: error.recovery,
    });
    return {
        content: [{ type: "text", text: JSON.stringify(payload) }],
        isError: true,
    };
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

function wrapResult(result, format = "json", verbosity = "full") {
    if (result?.error) {
        return graphError(result.error);
    }
    const payload = pruneForVerbosity(pruneEmpty({
        status: STATUS.OK,
        ...result,
    }) || {}, verbosity);
    const text = JSON.stringify(payload);
    return { content: [{ type: "text", text }] };
}

function unique(values) {
    return [...new Set((values || []).filter(Boolean))];
}

function withQuality(result, quality) {
    if (!quality || result?.error) return result;
    return { ...result, quality };
}

function referencesQuality(result) {
    return buildInlineQuality({
        queryFamily: "find_references",
        languages: [result?.result?.symbol?.language],
        frameworks: collectFrameworksFromOrigins(result?.result?.references?.map(reference => reference.origin)),
    });
}

function traceQuality(result) {
    return buildInlineQuality({
        queryFamily: "trace_paths",
        languages: unique(result?.result?.flatMap(path => path.nodes?.map(node => node.language) || [])),
        frameworks: collectFrameworksFromOrigins(result?.result?.flatMap(path => path.edges?.map(edge => edge.origin) || [])),
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
    description: "Scan and index a project into the graph kernel, including precise and framework-aware overlays when available.",
    inputSchema: z.object({
        path: z.string().describe("Project root directory"),
        languages: z.array(z.string()).optional().describe("Filter indexed languages"),
    }),
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
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
        }, "json", "full");
    } catch (e) {
        const message = e?.message || String(e);
        if (e?.code === "GRAPH_DB_UNREADABLE") {
            return graphError("GRAPH_DB_UNREADABLE", message, "Inspect the same-project graph DB files, ensure they are readable, then rerun index_project");
        }
        if (e?.code === "GRAPH_DB_BUSY" || e?.code === "EBUSY" || e?.code === "EPERM" || /busy or locked/i.test(message)) {
            return graphError("GRAPH_DB_BUSY", message, "Close the same-project graph DB in other hex-graph/editor sessions, wait for idle-close, then rerun index_project");
        }
        return graphError("PATH_NOT_FOUND", e.message, "Check path exists and is accessible");
    }
});

server.registerTool("install_graph_providers", {
    title: "Install Graph Providers",
    description: "Detect graph-specific providers and optional SCIP exporters for the current project, then return exact remediation steps or install them on demand. This never installs runtimes or project dependencies.",
    inputSchema: z.object({
        path: z.string().describe("Project root used for language detection and provider planning"),
        mode: z.enum(["check", "install"]).default("check").describe("`check` reports the plan and remediation steps only. `install` runs the provider install commands when they are available for the current platform."),
        include_optional_scip: z.boolean().default(true).describe("Include optional SCIP exporter checks alongside precise providers."),
        format: z.enum(["json", "text"]).default("json"),
    }),
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
}, async (rawParams) => {
    const { path, mode, include_optional_scip, format } = rawParams;
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
        }, format, "full");
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
        format: z.enum(["json", "text"]).default("json"),
    }),
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
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
        format,
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
        }, format, "full");
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
        format: z.enum(["json", "text"]).default("json"),
    }),
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
}, async (rawParams) => {
    const { path, artifact_path, replace_existing, format } = rawParams;
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
        }, format, "full");
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
        limit: flexNum().describe("Max candidate symbols to return (default: 5)"),
        path: z.string().describe("Indexed project root or a file/directory inside the indexed project"),
        format: z.enum(["json", "text"]).default("json"),
    }),
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
}, async (rawParams) => {
    const { query, kind, limit, path, format } = rawParams;
    const result = runFindSymbolsUseCase(query, { kind, limit: limit ?? 5, path });
    return wrapResult(result, format, "minimal");
});

server.registerTool("inspect_symbol", {
    title: "Inspect Symbol",
    description: "Return a symbol-centric briefing: canonical resolution, local context, incoming and outgoing relations, reference summary, and implementation summary.",
    inputSchema: z.object({
        ...selectorSchema(),
        min_confidence: confidenceSchema(),
        path: z.string().describe("Indexed project root or a file/directory inside the indexed project"),
        format: z.enum(["json", "text"]).default("json"),
    }),
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
}, async (rawParams) => {
    const { path, format, min_confidence, ...selector } = rawParams;
    const result = runInspectSymbolUseCase(selector, {
        path,
        minConfidence: min_confidence ?? null,
    });
    return wrapResult(withQuality(result, inspectQuality(result)), format, "compact");
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
        path: z.string().describe("Indexed project root or a file/directory inside the indexed project"),
        format: z.enum(["json", "text"]).default("json"),
    }),
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
}, async (rawParams) => {
    const { path, format, path_kind, direction, depth, limit, min_confidence, ...selector } = rawParams;
    const target = buildTargetSelector(selector);
    delete selector.to_symbol_id;
    delete selector.to_workspace_qualified_name;
    delete selector.to_qualified_name;
    delete selector.to_name;
    delete selector.to_file;
    const result = tracePaths(selector, {
        path_kind: path_kind ?? "calls",
        direction: direction ?? "reverse",
        depth: depth ?? 3,
        limit: limit ?? 10,
        min_confidence: min_confidence ?? null,
        path,
        target,
    });
    if (!result?.error) {
        const pathCount = result.result.length;
        result.summary = pathCount
            ? `Found ${pathCount} path(s) through ${path_kind ?? "calls"} edges.`
            : "No path matched the requested traversal.";
        result.warnings = unique([
            ...(result.warnings || []),
            ...(pathCount ? [] : [
                "No path matched the current selectors, direction, and depth.",
                "For module overview or broad dependency structure, inspect_symbol and analyze_architecture are usually more reliable than trace_paths from a coarse selector.",
            ]),
        ]);
        result.next_actions = unique(["inspect_symbol", ...(pathCount ? [] : ["adjust_query"])]);
    }
    return wrapResult(withQuality(result, traceQuality(result)), format, "compact");
});

server.registerTool("find_references", {
    title: "Find References",
    description: "Find semantic usages of a canonical symbol identity, including framework overlay wiring when present.",
    inputSchema: z.object({
        ...selectorSchema(),
        kind: z.enum(REFERENCE_KINDS).default("all").describe("Optional edge-kind filter. Includes semantic and framework kinds such as `route_to_handler`, `injects`, `registers`, `renders`, and `middleware_for`."),
        limit: flexNum().describe("Max references (default: 10)"),
        min_confidence: confidenceSchema(),
        path: z.string().describe("Indexed project root or a file/directory inside the indexed project"),
        format: z.enum(["json", "text"]).default("json"),
    }),
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
}, async (rawParams) => {
    const { path, format, kind, limit, min_confidence, ...selector } = rawParams;
    const result = getReferencesBySelector(selector, {
        kind: kind ?? "all",
        limit: limit ?? 10,
        min_confidence: min_confidence ?? null,
        path,
    });
    if (!result?.error) {
        result.summary = result.result.total
            ? `Found ${result.result.total} semantic reference(s).`
            : "No semantic reference matched the requested symbol.";
        result.warnings = unique([
            ...(result.warnings || []),
            ...(result.result.total ? [] : ["No reference matched the current symbol and filters."]),
        ]);
        result.next_actions = ["inspect_symbol", "trace_paths"];
    }
    return wrapResult(withQuality(result, referencesQuality(result)), format, "compact");
});

server.registerTool("find_implementations", {
    title: "Find Implementations",
    description: "Find implementations and overrides for a canonical symbol identity.",
    inputSchema: z.object({
        ...selectorSchema(),
        limit: flexNum().describe("Max implementation rows to return (default: 10)"),
        path: z.string().describe("Indexed project root or a file/directory inside the indexed project"),
        format: z.enum(["json", "text"]).default("json"),
    }),
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
}, async (rawParams) => {
    const { path, format, limit, ...selector } = rawParams;
    const result = findImplementationsBySelector(selector, { path, limit: limit ?? 10 });
    if (!result?.error) {
        result.summary = result.result.implementations.length
            ? `Found ${result.result.implementations.length} implementation or override relation(s).`
            : "No implementation or override relation matched the requested symbol.";
        result.warnings = result.result.implementations.length ? [] : ["No implementation relation matched the current symbol."];
        result.next_actions = ["inspect_symbol"];
    }
    return wrapResult(result, format, "compact");
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
        path: z.string().describe("Indexed project root or a file/directory inside the indexed project"),
        format: z.enum(["json", "text"]).default("json"),
    }),
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
}, async (rawParams) => {
    const { path, format, source, sink, flow_kind, max_hops, limit, min_confidence } = rawParams;
    const result = runTraceDataflowUseCase({
        source,
        sink,
        flow_kind: flow_kind ?? "value",
        max_hops: max_hops ?? DEFAULT_FLOW_MAX_HOPS,
        min_confidence: min_confidence ?? null,
    }, {
        limit: limit ?? 10,
        path,
    });
    return wrapResult(result, format, "compact");
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
        format: z.enum(["json", "text"]).default("json"),
    }),
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
}, async (rawParams) => {
    const { path, base_ref, head_ref, include_paths, max_symbols, max_paths, format } = rawParams;
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
        return wrapResult(withQuality(result, changesQuality(result)), format, "minimal");
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
        format: z.enum(["json", "text"]).default("json"),
    }),
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
}, async (rawParams) => {
    const { path, file, line_start, line_end, verbosity, format } = rawParams;
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
    return wrapResult(withQuality(result, editRegionQuality(result)), format, verbosity ?? "compact");
});

server.registerTool("analyze_architecture", {
    title: "Analyze Architecture",
    description: "Return a high-level architecture view with modules, dependency boundaries, cycles, coupling, framework surfaces, and top risks.",
    inputSchema: z.object({
        path: z.string().describe("Indexed project root"),
        scope: z.string().optional().describe("Optional file path prefix filter"),
        limit: flexNum().describe("Max module, cycle, coupling, and hotspot rows to surface (default: 5)"),
        verbosity: verbositySchema(),
        format: z.enum(["json", "text"]).default("json"),
    }),
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
}, async (rawParams) => {
    const { path, scope, limit, verbosity, format } = rawParams;
    const result = runAnalyzeArchitectureUseCase({
        path,
        scope: scope || null,
        limit: limit ?? 5,
        verbosity: verbosity ?? "minimal",
    });
    if (result?.error) {
        return graphError(result.error);
    }
    return wrapResult(withQuality(result, architectureQuality(result)), format, verbosity ?? "minimal");
});

server.registerTool("audit_workspace", {
    title: "Audit Workspace",
    description: "Audit the indexed workspace for cleanup and maintainability issues: unused exports, hotspots, and clone groups with a single review-oriented result.",
    inputSchema: z.object({
        path: z.string().describe("Indexed project root"),
        scope: z.string().optional().describe("Optional file path prefix filter"),
        verbosity: verbositySchema(),
        show_suppressed: flexBool().describe("Include suppressed unused exports in the visible result"),
        format: z.enum(["json", "text"]).default("json"),
    }),
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
}, async (rawParams) => {
    const { path, scope, verbosity, show_suppressed, format } = rawParams;
    const result = runAuditWorkspaceUseCase({
        path,
        scope: scope || null,
        verbosity: verbosity ?? "minimal",
        showSuppressed: show_suppressed ?? false,
    });
    if (result?.error) {
        return graphError(result.error);
    }
    return wrapResult(withQuality(result, auditQuality(result)), format, verbosity ?? "minimal");
});

const transport = new StdioServerTransport();
await server.connect(transport);
void checkForUpdates("@levnikolaevich/hex-graph-mcp", version);
