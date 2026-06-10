import { isAbsolute, relative, resolve } from "node:path";

import { findClones } from "./clones.mjs";
import { findCycles } from "./cycles.mjs";
import { DEFAULT_PR_IMPACT_MAX_PATHS, DEFAULT_PR_IMPACT_MAX_SYMBOLS, getPrImpact } from "./pr-impact.mjs";
import {
    explainResolution,
    findDataflowsBySelector,
    findImplementationsBySelector,
    findSymbols,
    getArchitectureReport,
    getHotspots,
    getModuleMetricsReport,
    getReferencesBySelector,
    getSymbol,
    tracePaths,
    withResolvedStore,
} from "./store.mjs";
import { findUnusedExports } from "./unused.mjs";
import { ACTION, nextActions } from "./output-contract.mjs";
import { normalizeConfidence } from "./confidence.mjs";
import {
    collectApiImpact,
    collectProcessesForSymbols,
    diagnoseGraph,
    resolveSymbolIdForSelector,
} from "./graph-insights.mjs";

const QUERY_PATH_RECOVERY = "Run index_project on the project root first; symbol/query tools then accept that root or a file/subdirectory inside it as path";

function summarizeCount(count, singular, plural = `${singular}s`) {
    return `${count} ${count === 1 ? singular : plural}`;
}

function compactNode(node) {
    if (!node) return null;
    return {
        symbol_id: node.id,
        qualified_name: node.qualified_name || null,
        workspace_qualified_name: node.workspace_qualified_name || null,
        name: node.name,
        display_name: node.display_name || node.name,
        kind: node.kind,
        language: node.language || null,
        file: node.file,
        line_start: node.line_start,
        line_end: node.line_end,
        is_exported: !!node.is_exported,
        is_default_export: !!node.is_default_export,
        module_key: node.module_key || null,
        module_name: node.module_name || null,
        package_key: node.package_key || null,
        package_name: node.package_name || null,
    };
}

function compactProcess(process) {
    if (!process) return null;
    return {
        process_id: process.process_id,
        name: process.name,
        file: process.file,
        line_start: process.line_start,
        step_count: process.step_count,
        matched_step_count: process.matched_step_count,
        matched_steps: (process.matched_steps || []).slice(0, 4).map(step => ({
            kind: step.kind,
            file: step.file,
            line: step.line,
            target: step.target ? {
                symbol_id: step.target.symbol_id,
                name: step.target.name,
                kind: step.target.kind,
                file: step.target.file,
                line_start: step.target.line_start,
            } : null,
        })),
    };
}

function normalizeProjectFile(projectPath, filePath) {
    if (!filePath) return null;
    if (!projectPath) return filePath.replace(/\\/g, "/");
    const root = resolve(projectPath);
    const candidate = isAbsolute(filePath) ? resolve(filePath) : resolve(root, filePath);
    const rel = relative(root, candidate);
    if (rel.startsWith("..")) {
        return { error: { code: "FILE_OUTSIDE_PROJECT", message: "File is outside the indexed project root", recovery: "Pass a file path inside the indexed project root" } };
    }
    return rel.replace(/\\/g, "/");
}

function dedupeRows(rows, keyFn) {
    const seen = new Set();
    const items = [];
    for (const row of rows || []) {
        const key = keyFn(row);
        if (seen.has(key)) continue;
        seen.add(key);
        items.push(row);
    }
    return items;
}

function riskLevel(rank) {
    if (rank >= 3) return "high";
    if (rank >= 1) return "medium";
    return "low";
}

function summarizeEditedSymbol(symbol) {
    return {
        symbol: symbol.symbol,
        impact_counts: symbol.impact_counts,
        framework_origins: symbol.framework_origins,
        processes_summary: symbol.processes_summary,
        duplicate_risk: symbol.duplicate_risk,
        public_api_risk: symbol.public_api_risk,
        framework_entrypoint_risk: symbol.framework_entrypoint_risk,
    };
}

function trimForDetail(items, verbosity, limit = 10) {
    return verbosity === "full" ? items : items.slice(0, limit);
}

function mergeWarnings(...groups) {
    return [...new Set(groups.flat().filter(Boolean))];
}

function clampLimit(value, fallback, max = 25) {
    if (value == null || Number.isNaN(Number(value))) return fallback;
    return Math.max(1, Math.min(max, Number(value)));
}

function normalizeExpansions(expand, allowed = [], maxSections = 3) {
    const requested = Array.isArray(expand)
        ? expand
        : typeof expand === "string"
            ? [expand]
            : [];
    return [...new Set(
        requested
            .filter((entry) => typeof entry === "string")
            .map(entry => entry.trim())
            .filter(Boolean)
            .filter(entry => allowed.includes(entry)),
    )].slice(0, maxSections);
}

function compactReferenceRow(reference, includeEvidence = false) {
    if (!reference) return null;
    return {
        file: reference.file,
        line: reference.line,
        kind: reference.kind,
        confidence: reference.confidence,
        origin: reference.origin,
        ...(includeEvidence && reference.evidence ? { evidence: reference.evidence } : {}),
    };
}

function compactImplementationRow(match, includeEvidence = false) {
    if (!match) return null;
    return {
        kind: match.kind,
        confidence: match.confidence,
        source: match.source,
        ...(includeEvidence && match.evidence ? { evidence: match.evidence } : {}),
    };
}

function compactTraceEdge(edge, includeEvidence = false) {
    if (!edge) return null;
    return {
        kind: edge.kind,
        layer: edge.layer,
        confidence: edge.confidence,
        origin: edge.origin,
        ...(includeEvidence && edge.evidence ? { evidence: edge.evidence } : {}),
    };
}

function compactTracePath(path, includeEvidence = false) {
    if (!path) return null;
    if (path.hops) {
        return {
            depth: path.depth,
            nodes: path.nodes || [],
            hops: path.hops.map(hop => compactTraceEdge(hop, includeEvidence)),
        };
    }
    return {
        depth: path.depth,
        nodes: path.nodes?.map(node => compactNode(node)) || [],
        edges: path.edges?.map(edge => compactTraceEdge(edge, includeEvidence)) || [],
    };
}

function buildPathPreview(path) {
    const nodes = path?.nodes || [];
    const edges = path?.edges || path?.hops || [];
    const first = nodes[0];
    const last = nodes[nodes.length - 1];
    return {
        depth: path?.depth ?? Math.max(0, edges.length),
        node_count: nodes.length,
        edge_count: edges.length,
        edge_kinds: [...new Set(edges.map(edge => edge?.kind).filter(Boolean))],
        start: first ? {
            display_name: first.display_name || first.name || null,
            file: first.file || null,
            line: first.line_start || first.line || null,
        } : null,
        end: last ? {
            display_name: last.display_name || last.name || null,
            file: last.file || null,
            line: last.line_start || last.line || null,
        } : null,
    };
}

function buildExpansionHint({
    toolName,
    expansion,
    total,
    returnedByDefault,
    expandLimit,
    includeEvidence = false,
    extra = {},
}) {
    const remaining = Math.max(0, total - returnedByDefault);
    const limit = Math.min(expandLimit, Math.max(total, returnedByDefault, 1));
    const parts = [`>mcp__hex-graph__${toolName}`, `expand=${expansion}`, `expand_limit=${limit}`];
    if (includeEvidence) parts.push("include_evidence=1");
    for (const [key, value] of Object.entries(extra)) {
        if (value === null || value === undefined) continue;
        parts.push(`${key}=${value}`);
    }
    return {
        expansion,
        total,
        remaining,
        pointer: parts.join(" "),
    };
}

function incrementCount(map, key) {
    if (!key) return;
    map.set(key, (map.get(key) || 0) + 1);
}

function summarizeCounts(map, limit = 5) {
    return [...map.entries()]
        .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
        .slice(0, limit)
        .map(([value, count]) => ({ value, count }));
}

function classifyProvenanceTier(origin) {
    if (!origin) return "unknown";
    if (origin === "scip_import") return "scip_overlay";
    if (origin.startsWith("framework:")) return "framework_overlay";
    if (origin.startsWith("precise_") || ["typescript", "basedpyright", "csharp-ls", "phpactor"].includes(origin)) {
        return "precise_provider";
    }
    if (origin === "external" || origin === "unresolved") return "external_or_unresolved";
    return "parser_or_workspace";
}

function buildProvenanceSummary(rows, { originLimit = 5 } = {}) {
    const sourceRows = rows.filter(Boolean);
    const byOrigin = new Map();
    const byTier = new Map();
    const byConfidence = new Map();
    for (const row of sourceRows) {
        const confidence = normalizeConfidence(row.confidence);
        const tier = classifyProvenanceTier(row.origin);
        incrementCount(byOrigin, row.origin || "unknown");
        incrementCount(byTier, tier);
        incrementCount(byConfidence, confidence);
    }
    return {
        tiers: summarizeCounts(byTier, originLimit),
        confidences: summarizeCounts(byConfidence, originLimit),
        origins: summarizeCounts(byOrigin, originLimit),
    };
}

function selectorSpecificity(selectorKind) {
    switch (selectorKind) {
        case "symbol_id":
            return "exact_id";
        case "workspace_qualified_name":
            return "workspace_stable";
        case "qualified_name":
            return "file_scoped";
        case "name_file":
            return "name_file_match";
        default:
            return "unknown";
    }
}

function buildRecommendedSelectors(symbol) {
    if (!symbol) return {};
    return {
        symbol_id: symbol.symbol_id,
        workspace_qualified_name: symbol.workspace_qualified_name || null,
        qualified_name: symbol.qualified_name || null,
        name_file: symbol.file && symbol.name
            ? { name: symbol.name, file: symbol.file }
            : null,
    };
}

function buildResolutionPayload(resolution, symbol) {
    const providerStatus = resolution?.precise_provider_status || null;
    return {
        ...resolution,
        ownership: symbol ? {
            file: symbol.file,
            package_key: symbol.package_key || null,
            package_name: symbol.package_name || null,
            module_key: symbol.module_key || null,
            module_name: symbol.module_name || null,
        } : null,
        resolution_quality: {
            selector_specificity: selectorSpecificity(resolution?.selector_kind),
            candidate_count: resolution?.parsed_candidates?.length || 0,
            precise_provider_status: providerStatus?.status || "unknown",
            precise_provider_message: providerStatus?.message || null,
            precise_edge_counts: {
                incoming: resolution?.precise_results?.incoming_count || 0,
                outgoing: resolution?.precise_results?.outgoing_count || 0,
            },
        },
        selector_hints: {
            recommended_selectors: buildRecommendedSelectors(symbol),
            preferred_for_repeat_queries: symbol?.workspace_qualified_name ? "workspace_qualified_name" : "symbol_id",
        },
    };
}

function traceRowsForProvenance(paths) {
    return (paths || []).flatMap(path => [...(path.edges || []), ...(path.hops || [])]);
}

function classifyFindSymbolsQuery(query) {
    if (typeof query !== "string") return [];
    const trimmed = query.trim();
    if (!trimmed) return [];

    const warnings = [];
    if (/^[\w$]+\.[\w$]+(?:\([^)]*\))?$/.test(trimmed) || /\b[\w$]+\.[\w$]+\s*\(/.test(trimmed)) {
        warnings.push("find_symbols matches declared symbol names, not unresolved object member call sites such as server.tool() or app.get(). Use grep_search or framework-aware references for those patterns.");
    }
    if (/\b(import|export|function|class|const|let|var|return)\b/.test(trimmed) || /[(){};=]/.test(trimmed)) {
        warnings.push("find_symbols expects a symbol name or partial name, not a code fragment, keyword sequence, or regex-like pattern.");
    }
    return warnings;
}

function directoryBucket(file) {
    if (!file) return ".";
    const normalized = String(file).replace(/\\/g, "/");
    const segments = normalized.split("/").filter(Boolean);
    if (segments.length <= 1) return ".";
    return segments.slice(0, Math.min(2, segments.length - 1)).join("/");
}

function overflowGroups(candidates, shownCount, limit = 4) {
    const counts = new Map();
    for (const candidate of candidates.slice(shownCount)) {
        incrementCount(counts, directoryBucket(candidate.file));
    }
    return summarizeCounts(counts, limit)
        .map(({ key, count }) => ({ directory: key, count }));
}

function findSymbolsHints(candidates, query, totalCount, shownCount) {
    if (totalCount <= 1) return [];
    const hints = [];
    const sample = candidates.slice(0, Math.min(3, shownCount));
    if (sample[0]?.file) {
        hints.push(`Refine with name + file, for example { name: "${query}", file: "${sample[0].file}" }.`);
    }
    if (sample.some((candidate) => candidate.workspace_qualified_name)) {
        hints.push("Prefer workspace_qualified_name when the same name exists across packages or modules.");
    }
    if (totalCount > shownCount) {
        const grouped = overflowGroups(candidates, shownCount, 2);
        const top = grouped[0]?.directory;
        if (top && top !== ".") {
            hints.push(`Narrow path to ${top}/ before rerunning find_symbols on overloaded names.`);
        }
    }
    return hints;
}

export function runFindSymbolsUseCase(query, { kind, limit = 20, path } = {}) {
    const detailLimit = clampLimit(limit, 8, 25);
    const fetchLimit = Math.min(Math.max(detailLimit * 4, detailLimit + 8), 64);
    const base = findSymbols(query, { kind, limit: fetchLimit, path });
    if (base?.error) return base;
    const candidates = base.matches || [];
    const shownCandidates = candidates.slice(0, detailLimit);
    const queryWarnings = classifyFindSymbolsQuery(query);
    const genericQueryWarning = (
        candidates.length > detailLimit
        && /^[A-Za-z_$][\w$]*$/.test(String(query || "").trim())
    )
        ? [`"${query}" is a broad bare symbol query. Narrow path or refine with name + file before deeper graph inspection.`]
        : [];
    return {
        query: { ...base.query, path },
        result: {
            candidates: shownCandidates,
            candidate_count: candidates.length,
            shown_count: shownCandidates.length,
            truncated: candidates.length > shownCandidates.length,
            overflow_groups: candidates.length > shownCandidates.length
                ? overflowGroups(candidates, shownCandidates.length)
                : [],
            disambiguation_hints: findSymbolsHints(shownCandidates, query, candidates.length, shownCandidates.length),
        },
        warnings: mergeWarnings(
            base.warnings || [],
            candidates.length ? [] : ["No semantic symbol matched the requested query."],
            queryWarnings,
            genericQueryWarning,
        ),
        next_actions: nextActions([
            shownCandidates.length ? ACTION.INSPECT_SYMBOL : null,
            (queryWarnings.length || candidates.length > shownCandidates.length) ? ACTION.ADJUST_QUERY : null,
            !shownCandidates.length ? ACTION.WIDEN_QUERY : null,
            !shownCandidates.length ? ACTION.INDEX_PROJECT : null,
        ]),
        confidence: base.confidence,
        reason: base.reason,
        evidence: base.evidence,
        limits_applied: {
            ...(base.limits_applied || {}),
            candidate_fetch_limit: fetchLimit,
            candidate_detail_limit: detailLimit,
        },
    };
}

export function runInspectSymbolUseCase(selector, {
    minConfidence = null,
    path,
    verbosity = "compact",
    expand = [],
    expandLimit = null,
    includeEvidence = false,
    referenceLimit = 10,
    implementationLimit = 10,
} = {}) {
    const previewLimit = verbosity === "minimal" ? 3 : verbosity === "full" ? 8 : 5;
    const detailLimit = clampLimit(expandLimit, Math.max(referenceLimit, implementationLimit, 10));
    const expansions = normalizeExpansions(expand, ["siblings", "incoming", "outgoing", "references", "implementations"]);
    const referenceFetchLimit = Math.max(referenceLimit, previewLimit, expansions.includes("references") ? detailLimit : 0);
    const implementationFetchLimit = Math.max(implementationLimit, previewLimit, expansions.includes("implementations") ? detailLimit : 0);
    const symbolResult = getSymbol(selector, { min_confidence: minConfidence, path });
    if (symbolResult?.error) return symbolResult;
    const resolutionResult = explainResolution(selector, { path });
    if (resolutionResult?.error) return resolutionResult;
    const referencesResult = getReferencesBySelector(selector, {
        limit: referenceFetchLimit,
        min_confidence: minConfidence,
        path,
    });
    if (referencesResult?.error) return referencesResult;
    const implementationsResult = findImplementationsBySelector(selector, {
        limit: implementationFetchLimit,
        path,
    });
    if (implementationsResult?.error) return implementationsResult;

    const symbol = symbolResult.result.symbol;
    const siblings = symbolResult.result.siblings || [];
    const incoming = symbolResult.result.incoming || [];
    const outgoing = symbolResult.result.outgoing || [];
    const totalReferences = referencesResult.result.total || 0;
    const totalImplementations = implementationsResult.result.total || implementationsResult.result.implementations.length;
    const referencesPreview = referencesResult.result.references
        .slice(0, previewLimit)
        .map(reference => compactReferenceRow(reference, includeEvidence));
    const implementationsPreview = implementationsResult.result.implementations
        .slice(0, previewLimit)
        .map(match => compactImplementationRow(match, includeEvidence));
    const expanded = {};
    if (expansions.includes("siblings")) {
        expanded.siblings = siblings.slice(0, detailLimit).map(compactNode);
    }
    if (expansions.includes("incoming")) {
        expanded.incoming = incoming.slice(0, detailLimit);
    }
    if (expansions.includes("outgoing")) {
        expanded.outgoing = outgoing.slice(0, detailLimit);
    }
    if (expansions.includes("references")) {
        expanded.references = referencesResult.result.references
            .slice(0, detailLimit)
            .map(reference => compactReferenceRow(reference, includeEvidence));
    }
    if (expansions.includes("implementations")) {
        expanded.implementations = implementationsResult.result.implementations
            .slice(0, detailLimit)
            .map(match => compactImplementationRow(match, includeEvidence));
    }
    const frameworkOrigins = [...new Set(
        (referencesResult.result.references || [])
            .map(reference => reference.origin)
            .filter(origin => origin?.startsWith("framework:")),
    )];
    const processes = withResolvedStore(path, (store) => collectProcessesForSymbols(store, [symbol.symbol_id], { limit: detailLimit })) || [];
    return {
        query: {
            ...symbolResult.query,
            path,
            reference_limit: referenceLimit,
            implementation_limit: implementationLimit,
        },
        result: {
            symbol,
            resolution: buildResolutionPayload(resolutionResult.result, symbol),
            context: {
                module: symbolResult.result.module,
                provider_status: symbolResult.result.provider_status,
            },
            counts: {
                siblings: siblings.length,
                incoming: incoming.length,
                outgoing: outgoing.length,
                references: totalReferences,
                implementations: totalImplementations,
                processes: processes.length,
            },
            references_summary: {
                total: totalReferences,
                total_by_kind: referencesResult.result.total_by_kind,
                preview: referencesPreview,
            },
            implementations_summary: {
                total: totalImplementations,
                preview: implementationsPreview,
            },
            provenance_summary: buildProvenanceSummary([
                ...referencesResult.result.references,
                ...implementationsResult.result.implementations,
            ]),
            framework_roles: frameworkOrigins,
            processes_summary: {
                total: processes.length,
                preview: processes.slice(0, previewLimit).map(compactProcess),
            },
            expansion_hints: [
                buildExpansionHint({ toolName: "inspect_symbol", expansion: "siblings", total: siblings.length, returnedByDefault: 0, expandLimit: detailLimit, includeEvidence }),
                buildExpansionHint({ toolName: "inspect_symbol", expansion: "incoming", total: incoming.length, returnedByDefault: 0, expandLimit: detailLimit, includeEvidence }),
                buildExpansionHint({ toolName: "inspect_symbol", expansion: "outgoing", total: outgoing.length, returnedByDefault: 0, expandLimit: detailLimit, includeEvidence }),
                buildExpansionHint({ toolName: "find_references", expansion: "references", total: totalReferences, returnedByDefault: referencesPreview.length, expandLimit: detailLimit, includeEvidence }),
                buildExpansionHint({ toolName: "find_implementations", expansion: "implementations", total: totalImplementations, returnedByDefault: implementationsPreview.length, expandLimit: detailLimit, includeEvidence }),
            ],
            ...(Object.keys(expanded).length ? { expanded } : {}),
        },
        warnings: mergeWarnings(
            symbolResult.warnings || [],
            resolutionResult.warnings || [],
            referencesResult.warnings || [],
            implementationsResult.warnings || [],
        ),
        next_actions: nextActions([
            referencesResult.result.total ? ACTION.FIND_REFERENCES : null,
            implementationsResult.result.implementations.length ? ACTION.FIND_IMPLEMENTATIONS : null,
            processes.length ? ACTION.API_IMPACT : null,
            ACTION.TRACE_PATHS,
        ]),
        confidence: symbolResult.confidence,
        reason: symbolResult.reason,
        evidence: {
            ...symbolResult.evidence,
            reference_count: totalReferences,
            implementation_count: totalImplementations,
            process_count: processes.length,
        },
        limits_applied: {
            reference_limit: referenceFetchLimit,
            implementation_limit: implementationFetchLimit,
            expand_limit: detailLimit,
            expanded_sections: expansions,
        },
    };
}

export function runFindReferencesUseCase(selector, {
    kind = "all",
    limit = 10,
    minConfidence = null,
    path,
    verbosity = "compact",
    expand = [],
    expandLimit = null,
    includeEvidence = false,
} = {}) {
    const previewLimit = verbosity === "minimal" ? 3 : verbosity === "full" ? 8 : 5;
    const detailLimit = clampLimit(expandLimit, limit);
    const expansions = normalizeExpansions(expand, ["references"]);
    const fetchLimit = Math.max(limit, previewLimit, expansions.includes("references") ? detailLimit : 0);
    const base = getReferencesBySelector(selector, {
        kind,
        limit: fetchLimit,
        min_confidence: minConfidence,
        path,
    });
    if (base?.error) return base;
    const preview = base.result.references.slice(0, previewLimit).map(reference => compactReferenceRow(reference, includeEvidence));
    const expanded = expansions.includes("references")
        ? {
            references: base.result.references
                .slice(0, detailLimit)
                .map(reference => compactReferenceRow(reference, includeEvidence)),
        }
        : null;
    return {
        query: { ...base.query, path },
        result: {
            symbol: base.result.symbol,
            provider_status: base.result.provider_status,
            total: base.result.total,
            total_by_kind: base.result.total_by_kind,
            preview,
            provenance_summary: buildProvenanceSummary(base.result.references),
            expansion_hints: [
                buildExpansionHint({ toolName: "find_references", expansion: "references", total: base.result.total, returnedByDefault: preview.length, expandLimit: detailLimit, includeEvidence }),
            ],
            ...(expanded ? { expanded } : {}),
        },
        warnings: mergeWarnings(
            base.warnings || [],
            base.result.total ? [] : ["No reference matched the current symbol and filters."],
            base.result.total >= fetchLimit ? ["Result set was bounded. Use expand_limit or limit to inspect more rows."] : [],
        ),
        next_actions: nextActions([
            ACTION.INSPECT_SYMBOL,
            base.result.total ? ACTION.TRACE_PATHS : ACTION.ADJUST_QUERY,
        ]),
        confidence: base.confidence,
        reason: base.reason,
        evidence: base.evidence,
        limits_applied: {
            ...base.limits_applied,
            expand_limit: detailLimit,
            expanded_sections: expansions,
        },
    };
}

export function runFindImplementationsUseCase(selector, {
    limit = 10,
    path,
    verbosity = "compact",
    expand = [],
    expandLimit = null,
    includeEvidence = false,
} = {}) {
    const previewLimit = verbosity === "minimal" ? 3 : verbosity === "full" ? 8 : 5;
    const detailLimit = clampLimit(expandLimit, limit);
    const expansions = normalizeExpansions(expand, ["implementations"]);
    const fetchLimit = Math.max(limit, previewLimit, expansions.includes("implementations") ? detailLimit : 0);
    const base = findImplementationsBySelector(selector, { limit: fetchLimit, path });
    if (base?.error) return base;
    const preview = base.result.implementations.slice(0, previewLimit).map(match => compactImplementationRow(match, includeEvidence));
    const expanded = expansions.includes("implementations")
        ? {
            implementations: base.result.implementations
                .slice(0, detailLimit)
                .map(match => compactImplementationRow(match, includeEvidence)),
        }
        : null;
    return {
        query: { ...base.query, path, limit: fetchLimit },
        result: {
            symbol: base.result.symbol,
            total: base.result.total,
            preview,
            provenance_summary: buildProvenanceSummary(base.result.implementations),
            expansion_hints: [
                buildExpansionHint({ toolName: "find_implementations", expansion: "implementations", total: base.result.total, returnedByDefault: preview.length, expandLimit: detailLimit, includeEvidence }),
            ],
            ...(expanded ? { expanded } : {}),
        },
        warnings: mergeWarnings(
            base.warnings || [],
            base.result.total ? [] : ["No implementation relation matched the current symbol."],
            base.result.total >= fetchLimit ? ["Result set was bounded. Increase limit or use expand_limit for a deeper override list."] : [],
        ),
        next_actions: nextActions([
            ACTION.INSPECT_SYMBOL,
            base.result.total ? ACTION.TRACE_PATHS : null,
        ]),
        confidence: base.confidence,
        reason: base.reason,
        evidence: base.evidence,
        limits_applied: {
            ...base.limits_applied,
            expand_limit: detailLimit,
            expanded_sections: expansions,
        },
    };
}

export function runTracePathsUseCase(selector, {
    pathKind = "calls",
    direction = "reverse",
    depth = 3,
    limit = 10,
    minConfidence = null,
    path,
    target = null,
    verbosity = "compact",
    expand = [],
    expandLimit = null,
    includeEvidence = false,
} = {}) {
    const previewLimit = verbosity === "minimal" ? 3 : verbosity === "full" ? 8 : 5;
    const detailLimit = clampLimit(expandLimit, limit);
    const expansions = normalizeExpansions(expand, ["paths"]);
    const fetchLimit = Math.max(limit, previewLimit, expansions.includes("paths") ? detailLimit : 0);
    const base = tracePaths(selector, {
        path_kind: pathKind,
        direction,
        depth,
        limit: fetchLimit,
        min_confidence: minConfidence,
        path,
        target,
    });
    if (base?.error) return base;
    const pathRows = base.result || [];
    const pathPreviews = pathRows.slice(0, previewLimit).map(buildPathPreview);
    const processes = withResolvedStore(path, (store) => {
        const symbolId = resolveSymbolIdForSelector(store, selector);
        return symbolId ? collectProcessesForSymbols(store, [symbolId], { limit: detailLimit }) : [];
    }) || [];
    const expanded = expansions.includes("paths")
        ? {
            paths: pathRows.slice(0, detailLimit).map(pathRow => compactTracePath(pathRow, includeEvidence)),
        }
        : null;
    return {
        query: { ...base.query, path },
        result: {
            path_count: pathRows.length,
            target_found: target ? pathRows.length > 0 : null,
            path_previews: pathPreviews,
            processes_summary: {
                total: processes.length,
                preview: processes.slice(0, previewLimit).map(compactProcess),
            },
            provenance_summary: buildProvenanceSummary(traceRowsForProvenance(pathRows)),
            expansion_hints: [
                buildExpansionHint({
                    toolName: "trace_paths",
                    expansion: "paths",
                    total: pathRows.length,
                    returnedByDefault: pathPreviews.length,
                    expandLimit: detailLimit,
                    includeEvidence,
                    extra: { depth, limit: fetchLimit, path_kind: pathKind, direction },
                }),
            ],
            ...(expanded ? { expanded } : {}),
        },
        warnings: mergeWarnings(
            base.warnings || [],
            pathRows.length ? [] : [
                "No path matched the current selectors, direction, and depth.",
                "For module overview or broad dependency structure, inspect_symbol and analyze_architecture are usually more reliable than trace_paths from a coarse selector.",
            ],
            pathRows.length >= fetchLimit ? ["Returned path count hit the current limit. Increase limit or depth to continue the search."] : [],
        ),
        next_actions: nextActions([
            processes.length ? ACTION.API_IMPACT : null,
            ACTION.INSPECT_SYMBOL,
            pathRows.length ? null : ACTION.ADJUST_QUERY,
        ]),
        confidence: base.confidence,
        reason: base.reason,
        evidence: base.evidence,
        limits_applied: {
            ...base.limits_applied,
            expand_limit: detailLimit,
            expanded_sections: expansions,
        },
    };
}

export function runTraceDataflowUseCase(selector, {
    path,
    limit,
    depth,
    verbosity = "compact",
    expand = [],
    expandLimit = null,
    includeEvidence = false,
} = {}) {
    const previewLimit = verbosity === "minimal" ? 3 : verbosity === "full" ? 8 : 5;
    const detailLimit = clampLimit(expandLimit, limit ?? 10);
    const expansions = normalizeExpansions(expand, ["paths"]);
    const fetchLimit = Math.max(limit ?? 10, previewLimit, expansions.includes("paths") ? detailLimit : 0);
    const base = findDataflowsBySelector(selector, { path, limit: fetchLimit, depth });
    if (base?.error) return base;
    const flows = base.result?.paths || [];
    const expanded = expansions.includes("paths")
        ? {
            paths: flows.slice(0, detailLimit).map(flow => compactTracePath(flow, includeEvidence)),
        }
        : null;
    return {
        query: { ...base.query, path },
        result: {
            source: base.result?.source,
            sink: base.result?.sink,
            path_count: flows.length,
            target_found: base.evidence?.target_found ?? null,
            path_previews: flows.slice(0, previewLimit).map(buildPathPreview),
            provenance_summary: buildProvenanceSummary(traceRowsForProvenance(flows)),
            expansion_hints: [
                buildExpansionHint({
                    toolName: "trace_dataflow",
                    expansion: "paths",
                    total: flows.length,
                    returnedByDefault: Math.min(previewLimit, flows.length),
                    expandLimit: detailLimit,
                    includeEvidence,
                    extra: { max_hops: base.query?.max_hops, limit: fetchLimit, flow_kind: base.query?.flow_kind },
                }),
            ],
            anchors: {
                source: base.query.source,
                sink: base.query.sink || null,
            },
            ...(expanded ? { expanded } : {}),
        },
        warnings: mergeWarnings(
            flows.length ? [] : ["No deterministic flow fact matched the requested anchors."],
            flows.length >= fetchLimit ? ["Returned path count hit the current limit. Increase limit or max_hops to continue the search."] : [],
        ),
        next_actions: nextActions([
            flows.length ? ACTION.TRACE_PATHS : null,
        ]),
        confidence: base.confidence,
        reason: base.reason,
        evidence: base.evidence,
        limits_applied: base.limits_applied,
    };
}

export async function runAnalyzeChangesUseCase({
    path,
    baseRef,
    headRef = null,
    includePaths = false,
    maxSymbols = DEFAULT_PR_IMPACT_MAX_SYMBOLS,
    maxPaths = DEFAULT_PR_IMPACT_MAX_PATHS,
}) {
    const base = await getPrImpact({
        path,
        baseRef,
        headRef,
        includePaths,
        maxSymbols,
        maxPaths,
    });
    if (base?.error) return base;
    const summary = base.result.summary;
    const highRiskItems = (base.result.symbols || []).filter(symbol => symbol.risk_level === "high");
    const processesBySymbol = withResolvedStore(path, (store) => {
        const entries = new Map();
        for (const symbol of base.result.symbols || []) {
            if (!symbol.symbol_id) continue;
            entries.set(symbol.symbol_id, collectProcessesForSymbols(store, [symbol.symbol_id], { limit: 5 }));
        }
        return entries;
    }) || new Map();
    const impactSummary = (symbol) => {
        const processes = processesBySymbol.get(symbol.symbol_id) || [];
        return {
            callers: symbol.caller_count || 0,
            references: symbol.reference_count || 0,
            cross_file_files: symbol.cross_file_file_count || 0,
            framework_origins: symbol.framework_origins?.length || 0,
            processes: processes.length,
        };
    };
    return {
        query: { ...base.query, path },
        summary: [
            `${summarizeCount(summary.changed_file_count, "changed file")}`,
            `${summarizeCount(summary.changed_symbol_count, "changed symbol")}`,
            `${summarizeCount(summary.risk_counts.high, "high-risk item")}`,
        ].join(", "),
        result: {
            diff_summary: summary,
            changed_files: (base.result.diff.changed_files || []).map((file) => ({
                file: file.file,
                status: file.status,
            })),
            changed_symbols: (base.result.symbols || []).map((symbol) => ({
                symbol: symbol.symbol || symbol.name,
                risk_level: symbol.risk_level,
                impact_summary: impactSummary(symbol),
                file: symbol.file,
            })),
            high_risk_items: highRiskItems.map((symbol) => ({
                symbol: symbol.symbol || symbol.name,
                risk_level: symbol.risk_level,
                impact_summary: impactSummary(symbol),
                file: symbol.file,
            })),
            deleted_api_warnings: (base.result.deleted_symbols || []).map((symbol) => ({
                symbol: symbol.symbol,
                file: symbol.file,
                kind: symbol.kind,
            })),
            unresolved_symbols: base.result.unresolved_symbols,
            supporting_paths_included: includePaths,
        },
        warnings: base.result.unresolved_symbols.length
            ? [`${summarizeCount(base.result.unresolved_symbols.length, "changed symbol")} could not be mapped back to the current index.`]
            : [],
        next_actions: nextActions([
            [...processesBySymbol.values()].some(rows => rows.length) ? ACTION.API_IMPACT : null,
            highRiskItems.length ? ACTION.TRACE_PATHS : null,
            base.result.deleted_symbols.length ? ACTION.REVIEW_DELETED_API : null,
        ]),
        confidence: base.confidence,
        reason: base.reason,
        evidence: base.evidence,
        limits_applied: base.limits_applied,
    };
}

export function runAnalyzeArchitectureUseCase({
    path,
    scope = null,
    limit = 15,
    detailLevel = "compact",
    verbosity = null,
} = {}) {
    return withResolvedStore(path, (store) => {
        if (!store) {
            return { error: { code: "NOT_INDEXED", message: "No project indexed", recovery: QUERY_PATH_RECOVERY } };
        }
        const responseVerbosity = verbosity || detailLevel;
        const architecture = getArchitectureReport({ path, scopePath: scope, limit });
        if (architecture?.error) return architecture;
        const cycles = findCycles(store, { scopePath: scope });
        const metrics = getModuleMetricsReport({ path, scopePath: scope, minCoupling: 2, sort: "instability" });
        if (metrics?.error) return metrics;
        const compactCycles = trimForDetail(cycles.cycles || [], responseVerbosity, limit);
        const compactCoupling = trimForDetail(metrics.result || [], responseVerbosity, limit);
        const compactEdges = trimForDetail(architecture.result.cross_module_edges || [], responseVerbosity, limit);
        const compactHotspots = trimForDetail(architecture.result.hotspots || [], responseVerbosity, limit);
        const compactFramework = trimForDetail(architecture.result.framework || [], responseVerbosity, limit);
        const compactModules = trimForDetail(architecture.result.modules || [], responseVerbosity, limit).map((module) => ({
            module_key: module.module_key,
            module_name: module.module_name,
            package_key: module.package_key || null,
            exported_symbols: module.exported_symbols,
            imported_modules: module.imported_modules,
            instability: module.instability,
            language: module.language || null,
        }));
        const architectureResult = {
            workspace_summary: architecture.result.stats,
            modules: compactModules,
            cycles: compactCycles,
            top_risks: compactHotspots.map((risk) => ({
                file: risk.file,
                symbol: risk.symbol,
                reason: risk.reason,
                rank: risk.rank,
            })),
        };
        if (responseVerbosity !== "minimal") {
            architectureResult.module_boundaries = compactEdges.map((edge) => ({
                from_module: edge.from_module,
                to_module: edge.to_module,
                edge_kind: edge.edge_kind,
                count: edge.count,
            }));
            architectureResult.coupling = compactCoupling.map((row) => ({
                module_key: row.module_key,
                instability: row.instability,
                efferent_coupling: row.ce,
                afferent_coupling: row.ca,
            }));
            architectureResult.framework_surfaces = compactFramework.map((entry) => ({
                symbol: entry.symbol,
                origin: entry.origin,
                file: entry.file,
            }));
        }
        return {
            query: {
                path,
                scope,
                limit,
                verbosity: responseVerbosity,
            },
            summary: [
                `${summarizeCount(architecture.result.modules.length, "module")}`,
                `${summarizeCount(cycles.cycles.length, "cycle")}`,
                `${summarizeCount(compactHotspots.length, "top risk")}`,
            ].join(", "),
            result: architectureResult,
            warnings: mergeWarnings(
                cycles.cycles.length
                    ? [`${summarizeCount(cycles.cycles.length, "cycle")} detected across workspace modules.`]
                    : [],
                architecture.result.modules.length === 1
                    ? ["A single workspace module usually means mono-package grouping by the nearest package boundary. Use symbol-level traces or manual search for finer intra-package structure."]
                    : [],
            ),
            next_actions: nextActions([
                cycles.cycles.length ? ACTION.ANALYZE_CHANGES : null,
                ACTION.AUDIT_WORKSPACE,
            ]),
            confidence: architecture.confidence,
            reason: "architecture_review",
            evidence: {
                cycle_count: cycles.cycles.length,
                coupling_rows: metrics.result.length,
            },
            limits_applied: { limit, verbosity: responseVerbosity },
        };
    });
}

export function runAuditWorkspaceUseCase({
    path,
    scope = null,
    detailLevel = "compact",
    verbosity = null,
    showSuppressed = false,
    limit = null,
    cloneMemberLimit = null,
    cloneType = "all",
    cloneThreshold = 0.80,
    cloneMinStmts = null,
} = {}) {
    return withResolvedStore(path, (store) => {
        if (!store) {
            return { error: { code: "NOT_INDEXED", message: "No project indexed", recovery: QUERY_PATH_RECOVERY } };
        }
        const responseVerbosity = verbosity || detailLevel;
        const discoveryLimit = clampLimit(limit, 5, 25);
        const memberLimit = clampLimit(cloneMemberLimit, responseVerbosity === "full" ? 10 : 3, 25);
        const unused = findUnusedExports(store, { scopePath: scope, kind: "all" });
        const visibleUnused = showSuppressed ? unused.unused : unused.unused.filter(item => !item.suppressed);
        const hotspots = getHotspots({ path, scopePath: scope, minCallers: 2, minComplexity: 15, limit: 20 });
        const clones = findClones(store, {
            type: cloneType,
            threshold: cloneThreshold,
            minStmts: cloneMinStmts,
            kind: "all",
            scope,
            crossFile: true,
            format: "json",
            suppress: true,
        });
        const previewCloneGroup = (group) => {
            const members = Array.isArray(group.members) ? group.members : [];
            return {
                ...group,
                members: members.slice(0, memberLimit),
                members_total: members.length,
                members_shown: Math.min(members.length, memberLimit),
                members_omitted: Math.max(0, members.length - memberLimit),
            };
        };
        return {
            query: {
                path,
                scope,
                verbosity: responseVerbosity,
                show_suppressed: showSuppressed,
                limit: discoveryLimit,
                clone_member_limit: memberLimit,
                clone_type: cloneType,
            },
            summary: [
                `${summarizeCount(visibleUnused.length, "unused export")}`,
                `${summarizeCount(hotspots.length, "hotspot")}`,
                `${summarizeCount(clones.summary?.total_groups || 0, "clone group")}`,
            ].join(", "),
            result: {
                unused_exports: visibleUnused.slice(0, discoveryLimit),
                uncertain_unused_exports: responseVerbosity === "minimal"
                    ? []
                    : (unused.uncertain || []).slice(0, discoveryLimit),
                hotspots: hotspots.slice(0, discoveryLimit),
                clones: (clones.groups || []).slice(0, discoveryLimit).map(previewCloneGroup),
                risk_summary: {
                    unused_exports: visibleUnused.length,
                    uncertain_unused_exports: unused.uncertain.length,
                    hotspots: hotspots.length,
                    clone_groups: clones.summary?.total_groups || 0,
                },
                suppressed_items: showSuppressed && responseVerbosity !== "minimal"
                    ? unused.unused.filter(item => item.suppressed).slice(0, discoveryLimit)
                    : [],
            },
            warnings: nextActions([
                visibleUnused.length ? `${summarizeCount(visibleUnused.length, "unused export")} should be reviewed before public API cleanup.` : null,
                clones.summary?.total_groups ? `${summarizeCount(clones.summary.total_groups, "clone group")} may indicate duplicate logic.` : null,
            ]),
            next_actions: nextActions([
                visibleUnused.length ? ACTION.FIND_REFERENCES : null,
                hotspots.length ? ACTION.INSPECT_SYMBOL : null,
                clones.summary?.total_groups ? ACTION.ANALYZE_EDIT_REGION : null,
            ]),
            confidence: "heuristic",
            reason: "workspace_maintenance_audit",
            evidence: {
                total_exported: unused.total_exported,
                hotspot_count: hotspots.length,
                clone_group_count: clones.summary?.total_groups || 0,
            },
            limits_applied: { verbosity: responseVerbosity, limit: discoveryLimit, clone_member_limit: memberLimit },
        };
    });
}

export function runAnalyzeEditRegionUseCase({
    path,
    file,
    lineStart,
    lineEnd,
    detailLevel = "compact",
    verbosity = null,
} = {}) {
    return withResolvedStore(path, (store) => {
        if (!store) {
            return { error: { code: "NOT_INDEXED", message: "No project indexed", recovery: QUERY_PATH_RECOVERY } };
        }
        const responseVerbosity = verbosity || detailLevel;
        const normalizedFile = normalizeProjectFile(path, file);
        if (normalizedFile?.error) return normalizedFile;

    const editedRows = store.db.prepare(
        `SELECT
            symbol_node_id,
            display_name,
            file,
            line_start,
            line_end,
            external_callers_count,
            downstream_return_flow_count,
            downstream_property_flow_count,
            sink_reach_count,
            clone_sibling_count
         FROM hex_line_edit_impacts
         WHERE file = ?
           AND line_start <= ?
           AND line_end >= ?
         ORDER BY line_start`
    ).all(normalizedFile, lineEnd, lineStart);

    if (!editedRows.length) {
        return {
            query: { path, file: normalizedFile, line_start: lineStart, line_end: lineEnd, verbosity: responseVerbosity },
            summary: "No indexed symbol overlaps the requested edit region.",
            result: {
                file: normalizedFile,
                range: { line_start: lineStart, line_end: lineEnd },
                edited_symbols: [],
                impact_summary: {
                    edited_symbol_count: 0,
                    external_callers: 0,
                    downstream_flows: 0,
                    clone_siblings: 0,
                },
                external_callers: [],
                downstream_flow: [],
                clone_siblings: [],
                similar_symbols: [],
                duplicate_risk: { level: "low", reasons: [] },
                public_api_risk: { level: "low", symbols: [] },
                framework_entrypoint_risk: { level: "low", symbols: [] },
            },
            warnings: ["The selected lines do not intersect a symbol definition in the current graph index."],
            next_actions: [ACTION.WIDEN_RANGE, ACTION.INDEX_PROJECT],
            confidence: "exact",
            reason: "edit_region_no_symbols",
            evidence: {},
            limits_applied: {},
        };
    }

    const editedSymbols = editedRows.map((row) => {
        const node = store.getNodeById(row.symbol_node_id);
        const facts = store.db.prepare(
            `SELECT
                fact_kind,
                target_symbol_id,
                target_display_name,
                target_file,
                target_line,
                intermediate_symbol_id,
                intermediate_display_name,
                path_kind,
                flow_hops,
                source_anchor_kind,
                target_anchor_kind,
                access_path_json,
                confidence,
                origin
             FROM hex_line_edit_impact_facts
             WHERE edited_symbol_id = ?
             ORDER BY fact_kind, target_file, target_line`
        ).all(row.symbol_node_id);
        const frameworkRows = dedupeRows(
            store.frameworkIncomingEdges(row.symbol_node_id) || [],
            entry => `${entry.origin}|${entry.file}|${entry.line ?? ""}`,
        );
        const processRows = collectProcessesForSymbols(store, [row.symbol_node_id], { limit: 10 });
        const externalCallers = facts.filter(fact => fact.fact_kind === "external_caller");
        const downstreamFlow = facts.filter(fact => fact.fact_kind !== "external_caller" && fact.fact_kind !== "clone_sibling");
        const cloneSiblings = facts.filter(fact => fact.fact_kind === "clone_sibling");
        const similarSymbols = dedupeRows(
            (store.findByName(node?.name || row.display_name) || [])
                .filter(candidate => candidate.id !== row.symbol_node_id)
                .map(candidate => compactNode(candidate)),
            candidate => `${candidate.file}:${candidate.line_start}:${candidate.name}`,
        );
        const duplicateReasons = [];
        let duplicateRank = 0;
        if (cloneSiblings.length) {
            duplicateRank += 2;
            duplicateReasons.push(`${summarizeCount(cloneSiblings.length, "clone sibling")} already exists.`);
        }
        if (similarSymbols.some(candidate => candidate.kind === node?.kind)) {
            duplicateRank += 1;
            duplicateReasons.push("Same-name symbols already exist in the workspace.");
        }
        const publicApiSymbols = [];
        let publicApiRank = 0;
        if (node?.is_exported) {
            publicApiRank += 1;
            publicApiSymbols.push(node.display_name || node.name);
        }
        if (row.external_callers_count > 0) {
            publicApiRank += 2;
            publicApiSymbols.push(node.display_name || node.name);
        }
        const frameworkRank = frameworkRows.length ? 2 : 0;
        return {
            symbol: compactNode(node || {
                id: row.symbol_node_id,
                name: row.display_name,
                display_name: row.display_name,
                kind: "symbol",
                language: null,
                file: row.file,
                line_start: row.line_start,
                line_end: row.line_end,
            }),
            impact_counts: {
                external_callers: row.external_callers_count,
                downstream_return_flow: row.downstream_return_flow_count,
                downstream_property_flow: row.downstream_property_flow_count,
                sink_reach: row.sink_reach_count,
                clone_siblings: row.clone_sibling_count,
            },
            external_callers: trimForDetail(externalCallers, responseVerbosity, 10),
            downstream_flow: trimForDetail(downstreamFlow, responseVerbosity, 12),
            clone_siblings: trimForDetail(cloneSiblings, responseVerbosity, 10),
            similar_symbols: trimForDetail(similarSymbols, responseVerbosity, 10),
            framework_origins: frameworkRows.map(entry => entry.origin).filter(Boolean),
            processes: trimForDetail(processRows.map(compactProcess), responseVerbosity, 10),
            processes_summary: {
                total: processRows.length,
                preview: processRows.slice(0, 3).map(compactProcess),
            },
            duplicate_risk: {
                level: riskLevel(duplicateRank),
                reasons: duplicateReasons,
            },
            public_api_risk: {
                level: riskLevel(publicApiRank),
                reasons: publicApiRank ? ["Symbol is exported or has external callers."] : [],
            },
            framework_entrypoint_risk: {
                level: riskLevel(frameworkRank),
                reasons: frameworkRows.length ? ["Framework overlay edges target this symbol."] : [],
            },
        };
    });

    const aggregateExternalCallers = dedupeRows(
        editedSymbols.flatMap(symbol => symbol.external_callers || []),
        fact => `${fact.target_file}:${fact.target_line}:${fact.target_display_name}`,
    );
    const aggregateFlows = dedupeRows(
        editedSymbols.flatMap(symbol => symbol.downstream_flow || []),
        fact => `${fact.fact_kind}:${fact.target_file}:${fact.target_line}:${fact.target_display_name}:${fact.path_kind}:${fact.target_anchor_kind}`,
    );
    const aggregateClones = dedupeRows(
        editedSymbols.flatMap(symbol => symbol.clone_siblings || []),
        fact => `${fact.target_file}:${fact.target_line}:${fact.target_display_name}`,
    );
    const aggregateSimilar = dedupeRows(
        editedSymbols.flatMap(symbol => symbol.similar_symbols || []),
        candidate => `${candidate.file}:${candidate.line_start}:${candidate.name}`,
    );
    const aggregateProcesses = dedupeRows(
        editedSymbols.flatMap(symbol => symbol.processes || []),
        process => `${process.process_id}`,
    );
    const publicApiSymbols = editedSymbols
        .filter(symbol => symbol.public_api_risk.level !== "low")
        .map(symbol => symbol.symbol.display_name || symbol.symbol.name);
    const frameworkSymbols = editedSymbols
        .filter(symbol => symbol.framework_entrypoint_risk.level !== "low")
        .map(symbol => symbol.symbol.display_name || symbol.symbol.name);
    const duplicateLevel = editedSymbols.some(symbol => symbol.duplicate_risk.level === "high")
        ? "high"
        : editedSymbols.some(symbol => symbol.duplicate_risk.level === "medium")
            ? "medium"
            : "low";
    const editedLanguages = [...new Set(editedSymbols.map(symbol => symbol.symbol.language).filter(Boolean))];

        return {
        query: {
            path,
            file: normalizedFile,
            line_start: lineStart,
            line_end: lineEnd,
            verbosity: responseVerbosity,
        },
        summary: [
            `${summarizeCount(editedSymbols.length, "edited symbol")}`,
            `${summarizeCount(aggregateExternalCallers.length, "external caller")}`,
            `${summarizeCount(aggregateFlows.length, "downstream flow")}`,
            `duplicate risk ${duplicateLevel}`,
        ].join(", "),
        result: {
            file: normalizedFile,
            range: { line_start: lineStart, line_end: lineEnd },
            languages: editedLanguages,
            edited_symbols: trimForDetail(editedSymbols.map(summarizeEditedSymbol), responseVerbosity, 10),
            impact_summary: {
                edited_symbol_count: editedSymbols.length,
                external_callers: aggregateExternalCallers.length,
                downstream_flows: aggregateFlows.length,
                clone_siblings: aggregateClones.length,
                processes: aggregateProcesses.length,
            },
            external_callers: trimForDetail(aggregateExternalCallers, responseVerbosity, 12),
            downstream_flow: trimForDetail(aggregateFlows, responseVerbosity, 12),
            clone_siblings: trimForDetail(aggregateClones, responseVerbosity, 10),
            processes: trimForDetail(aggregateProcesses, responseVerbosity, 10),
            similar_symbols: trimForDetail(aggregateSimilar, responseVerbosity, 10),
            duplicate_risk: {
                level: duplicateLevel,
                reasons: editedSymbols.flatMap(symbol => symbol.duplicate_risk.reasons).slice(0, 6),
            },
            public_api_risk: {
                level: publicApiSymbols.length ? "high" : "low",
                symbols: publicApiSymbols,
            },
            framework_entrypoint_risk: {
                level: frameworkSymbols.length ? "high" : "low",
                symbols: frameworkSymbols,
            },
        },
        warnings: nextActions([
            publicApiSymbols.length ? `${summarizeCount(publicApiSymbols.length, "edited symbol")} is part of the public surface or has external callers.` : null,
            frameworkSymbols.length ? `${summarizeCount(frameworkSymbols.length, "edited symbol")} participates in framework wiring.` : null,
            aggregateProcesses.length ? `${summarizeCount(aggregateProcesses.length, "process")} includes the edited symbol.` : null,
        ]),
        next_actions: nextActions([
            aggregateProcesses.length ? ACTION.API_IMPACT : null,
            aggregateExternalCallers.length ? ACTION.FIND_REFERENCES : null,
            aggregateFlows.length ? ACTION.TRACE_DATAFLOW : null,
            duplicateLevel !== "low" ? ACTION.REVIEW_DUPLICATES : null,
        ]),
        confidence: "exact",
        reason: "edit_region_semantic_impact",
        evidence: {
            edited_symbol_count: editedSymbols.length,
            external_caller_count: aggregateExternalCallers.length,
            downstream_flow_count: aggregateFlows.length,
            process_count: aggregateProcesses.length,
        },
        limits_applied: { verbosity: responseVerbosity },
        };
    });
}

export function runApiImpactUseCase({
    path,
    route = null,
    file = null,
    selector = {},
    limit = 10,
    verbosity = "compact",
} = {}) {
    return withResolvedStore(path, (store) => {
        if (!store) {
            return { error: { code: "NOT_INDEXED", message: "No project indexed", recovery: QUERY_PATH_RECOVERY } };
        }
        const detailLimit = clampLimit(limit, 10, 25);
        const normalizedFile = file ? normalizeProjectFile(path, file) : null;
        if (normalizedFile?.error) return normalizedFile;
        const hasSelector = ["symbol_id", "workspace_qualified_name", "qualified_name", "name", "file"]
            .some(key => selector?.[key] !== undefined && selector?.[key] !== null);
        const symbolId = hasSelector ? resolveSymbolIdForSelector(store, selector) : null;
        if (hasSelector && !symbolId) {
            return {
                error: {
                    code: "SYMBOL_NOT_FOUND",
                    message: "API impact selector did not resolve to an indexed symbol",
                    recovery: "Run find_symbols first, then call api_impact with symbol_id or name+file.",
                },
            };
        }
        const impact = collectApiImpact(store, {
            route,
            file: normalizedFile,
            symbolId,
            limit: detailLimit,
        });
        const detailTruncated = Object.values(impact.truncated || {}).some(Boolean);
        const truncated = impact.total > impact.routes.length || detailTruncated;
        return {
            query: {
                path,
                route,
                file: normalizedFile,
                selector: hasSelector ? selector : null,
                limit: detailLimit,
                verbosity,
            },
            result: {
                ...impact,
                route_count: impact.routes.length,
                truncated,
            },
            warnings: mergeWarnings(
                impact.routes.length ? [] : ["No indexed API route matched the requested route, file, or symbol selector."],
                impact.mismatches.length ? [`${summarizeCount(impact.mismatches.length, "consumer key")} was not found in inferred response shapes.`] : [],
                detailTruncated ? ["Some API impact detail sections were truncated; increase limit or narrow the selector."] : [],
            ),
            next_actions: nextActions([
                impact.mismatches.length ? ACTION.INSPECT_SYMBOL : null,
                impact.processes.length ? ACTION.TRACE_PATHS : null,
                impact.routes.length ? ACTION.ANALYZE_EDIT_REGION : null,
                impact.routes.length ? null : ACTION.DIAGNOSE_GRAPH,
            ]),
            confidence: "inferred",
            reason: "api_impact",
            evidence: {
                route_count: impact.routes.length,
                response_shape_count: impact.response_shapes.length,
                consumer_count: impact.consumers.length,
                mismatch_count: impact.mismatches.length,
                process_count: impact.processes.length,
            },
            limits_applied: {
                limit: detailLimit,
                truncated,
                detail_truncated: impact.truncated,
            },
        };
    });
}

export function runDiagnoseGraphUseCase({ path } = {}) {
    return withResolvedStore(path, (store) => {
        if (!store) {
            return { error: { code: "NOT_INDEXED", message: "No project indexed", recovery: QUERY_PATH_RECOVERY } };
        }
        const diagnostics = diagnoseGraph(store);
        return {
            query: { path },
            result: {
                ...diagnostics,
                total: diagnostics.checks.length,
            },
            warnings: diagnostics.warnings,
            next_actions: nextActions([
                diagnostics.stats.files ? null : ACTION.INDEX_PROJECT,
                diagnostics.counts.routes ? ACTION.API_IMPACT : null,
            ]),
            confidence: "exact",
            reason: "graph_diagnostics",
            evidence: diagnostics.counts,
            limits_applied: {},
        };
    });
}
