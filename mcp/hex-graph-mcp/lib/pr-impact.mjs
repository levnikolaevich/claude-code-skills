import { semanticGitDiff } from "@levnikolaevich/hex-common/git/semantic-diff";
import { resolveStore, tracePaths } from "./store.mjs";

export const DEFAULT_PR_IMPACT_MAX_SYMBOLS = 25;
export const DEFAULT_PR_IMPACT_MAX_PATHS = 10;

const IMPACT_EDGE_KINDS = new Set([
    "calls",
    "ref_read",
    "ref_type",
    "imports",
    "reexports",
    "route_to_handler",
    "injects",
    "registers",
    "renders",
    "middleware_for",
]);

function uniqueBy(rows, keyFn) {
    const seen = new Set();
    const items = [];
    for (const row of rows) {
        const key = keyFn(row);
        if (seen.has(key)) continue;
        seen.add(key);
        items.push(row);
    }
    return items;
}

function matchesRange(node, symbol) {
    const start = node.line_start ?? 0;
    const end = node.line_end ?? node.line_start ?? 0;
    return start <= symbol.end && end >= symbol.start;
}

function resolveChangedNode(store, filePath, symbol) {
    const sameFile = store.nodesByFile(filePath)
        .filter(node => node.kind !== "module" && node.name === symbol.name);
    if (sameFile.length === 0) return null;
    return sameFile.find(node => matchesRange(node, symbol)) || sameFile[0];
}

function apiSurfaceHint(language, symbol) {
    if (language === "javascript" || language === "typescript") {
        return /\bexport\b/.test(symbol.text);
    }
    if (language === "csharp" || language === "php") {
        return /\bpublic\b/.test(symbol.text);
    }
    if (language === "python") {
        return !symbol.name.startsWith("_");
    }
    return false;
}

function compactNode(node) {
    return {
        symbol_id: node.id,
        qualified_name: node.qualified_name || null,
        name: node.name,
        kind: node.kind,
        language: node.language || null,
        file: node.file,
        line_start: node.line_start,
        line_end: node.line_end,
        is_exported: !!node.is_exported,
        is_default_export: !!node.is_default_export,
    };
}

function edgeMetrics(store, node) {
    const incoming = uniqueBy(
        store.edgesTo(node.id).filter(edge => IMPACT_EDGE_KINDS.has(edge.kind)),
        edge => `${edge.source_id}|${edge.kind}|${edge.file}|${edge.line ?? ""}`,
    );
    const callers = uniqueBy(
        incoming.filter(edge => edge.kind === "calls"),
        edge => `${edge.source_id}`,
    );
    const crossFileFiles = new Set(
        incoming
            .map(edge => edge.source_file || edge.file)
            .filter(file => file && file !== node.file),
    );
    const framework = uniqueBy(
        store.frameworkIncomingEdges(node.id),
        row => `${row.origin}|${row.file}|${row.line ?? ""}`,
    );
    return {
        incoming,
        caller_count: callers.length,
        reference_count: incoming.length,
        cross_file_file_count: crossFileFiles.size,
        framework_origins: [...new Set(framework.map(row => row.origin).filter(Boolean))],
    };
}

function scoreRisk({ changeKind, exported, apiHint, metrics }) {
    let score = 0;
    const reasons = [];

    if (changeKind === "deleted") {
        score += apiHint ? 4 : 2;
        reasons.push(apiHint ? "deleted symbol with public/API hint" : "deleted symbol removed from current graph");
    }
    if (exported) {
        score += 2;
        reasons.push("exported/public symbol");
    }
    if (metrics.framework_origins.length) {
        score += 3;
        reasons.push(`framework entrypoint: ${metrics.framework_origins.join(", ")}`);
    }
    if (metrics.caller_count >= 3) {
        score += 2;
        reasons.push(`${metrics.caller_count} direct callers`);
    } else if (metrics.caller_count > 0) {
        score += 1;
        reasons.push(`${metrics.caller_count} direct callers`);
    }
    if (metrics.cross_file_file_count >= 3) {
        score += 2;
        reasons.push(`${metrics.cross_file_file_count} cross-file dependents`);
    } else if (metrics.cross_file_file_count > 0) {
        score += 1;
        reasons.push(`${metrics.cross_file_file_count} cross-file dependents`);
    }
    if (metrics.reference_count >= 10) {
        score += 1;
        reasons.push(`${metrics.reference_count} semantic references`);
    }

    const risk_level = score >= 5 ? "high" : score >= 2 ? "medium" : "low";
    return { score, risk_level, reasons };
}

function riskSummary(rows) {
    return rows.reduce((acc, row) => {
        acc[row.risk_level] += 1;
        return acc;
    }, { high: 0, medium: 0, low: 0 });
}

function fileSummary(diff) {
    return diff.changed_files.map(file => ({
        path: file.path,
        old_path: file.old_path || null,
        status: file.status,
        language: file.language,
        semantic_supported: file.semantic_supported,
        symbol_changes: {
            added: file.added_symbols.length,
            removed: file.removed_symbols.length,
            modified: file.modified_symbols.length,
        },
    }));
}

export async function getPrImpact({
    path,
    baseRef,
    headRef = null,
    includePaths = false,
    maxSymbols = DEFAULT_PR_IMPACT_MAX_SYMBOLS,
    maxPaths = DEFAULT_PR_IMPACT_MAX_PATHS,
}) {
    const store = resolveStore(path);
    if (!store) {
        return {
            error: {
                code: "NOT_INDEXED",
                message: "No project indexed",
                recovery: "Run index_project on the project root first; symbol/query tools then accept that root or a file/subdirectory inside it as path",
            },
        };
    }

    const diff = await semanticGitDiff(path, { baseRef, headRef });
    const symbols = [];
    const deleted_symbols = [];
    const unresolved_symbols = [];

    for (const file of diff.changed_files) {
        if (!file.semantic_supported) continue;

        for (const removed of file.removed_symbols) {
            const apiHint = apiSurfaceHint(file.language, removed);
            const deleted = {
                name: removed.name,
                file: file.path,
                status: file.status,
                change_kind: "deleted",
                language: file.language,
                api_surface_hint: apiHint,
                risk_level: apiHint ? "high" : "medium",
                reasons: [apiHint ? "deleted symbol with public/API hint" : "deleted symbol removed from current checkout"],
                snippet: removed.text,
                line_start: removed.start,
                line_end: removed.end,
            };
            deleted_symbols.push(deleted);
            symbols.push({
                ...deleted,
                exported: apiHint,
                caller_count: 0,
                reference_count: 0,
                cross_file_file_count: 0,
                framework_origins: [],
            });
        }

        for (const changeKind of ["added", "modified"]) {
            const entries = changeKind === "added" ? file.added_symbols : file.modified_symbols;
            for (const entry of entries) {
                const node = resolveChangedNode(store, file.path, entry);
                if (!node) {
                    unresolved_symbols.push({
                        name: entry.name,
                        file: file.path,
                        status: file.status,
                        change_kind: changeKind,
                        language: file.language,
                        line_start: entry.start,
                        line_end: entry.end,
                        snippet: entry.text,
                    });
                    continue;
                }
                const metrics = edgeMetrics(store, node);
                const scored = scoreRisk({
                    changeKind,
                    exported: !!node.is_exported,
                    apiHint: apiSurfaceHint(file.language, entry),
                    metrics,
                });
                const item = {
                    ...compactNode(node),
                    status: file.status,
                    change_kind: changeKind,
                    snippet: entry.text,
                    caller_count: metrics.caller_count,
                    reference_count: metrics.reference_count,
                    cross_file_file_count: metrics.cross_file_file_count,
                    framework_origins: metrics.framework_origins,
                    risk_level: scored.risk_level,
                    risk_score: scored.score,
                    reasons: scored.reasons,
                };
                if (includePaths) {
                    const pathsResult = tracePaths({ symbol_id: node.id }, {
                        path,
                        path_kind: "mixed",
                        direction: "reverse",
                        depth: 2,
                        limit: maxPaths,
                    });
                    item.paths = pathsResult.result || [];
                }
                symbols.push(item);
            }
        }
    }

    const sorted = symbols
        .sort((a, b) => {
            const risk = (b.risk_score || 0) - (a.risk_score || 0);
            if (risk !== 0) return risk;
            const refs = (b.reference_count || 0) - (a.reference_count || 0);
            if (refs !== 0) return refs;
            return (b.caller_count || 0) - (a.caller_count || 0);
        })
        .slice(0, maxSymbols)
        .map(({ risk_score: _risk_score, ...item }) => item);

    const allRisks = riskSummary(symbols);

    return {
        query: {
            path,
            base_ref: baseRef,
            head_ref: headRef,
            include_paths: includePaths,
            max_symbols: maxSymbols,
            max_paths: maxPaths,
        },
        result: {
            diff: {
                repo_root: diff.repo_root,
                scope_path: diff.scope_path,
                baseline_ref: diff.baseline_ref,
                changed_files: fileSummary(diff),
                unsupported_files: diff.changed_files.filter(file => !file.semantic_supported).map(file => file.path),
            },
            summary: {
                ...diff.summary,
                unresolved_symbol_count: unresolved_symbols.length,
                deleted_symbol_count: deleted_symbols.length,
                risk_counts: allRisks,
            },
            symbols: sorted,
            deleted_symbols,
            unresolved_symbols,
        },
        confidence: "exact",
        reason: "git_ref_changed_symbols_with_graph_impact",
        evidence: {
            changed_file_count: diff.summary.changed_file_count,
            analyzed_symbol_count: symbols.length,
        },
        limits_applied: {
            max_symbols: maxSymbols,
            max_paths: includePaths ? maxPaths : 0,
        },
    };
}
