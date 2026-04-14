/**
 * Graph enrichment for hex-line tools.
 *
 * Reads .hex-skills/codegraph/index.db (created by hex-graph-mcp) in readonly mode
 * via an explainable, fact-oriented contract:
 * - hex_line_symbols
 * - hex_line_line_facts
 * - hex_line_edit_impacts
 * - hex_line_edit_impact_facts
 * - hex_line_clone_siblings
 *
 * Graceful fallback: if better-sqlite3, required views, or DB are missing,
 * enrichment is disabled silently for that project.
 */

import { existsSync, statSync } from "node:fs";
import { join, dirname, relative } from "node:path";
import { createRequire } from "node:module";

const REQUIRED_VIEWS = [
    "hex_line_symbols",
    "hex_line_line_facts",
    "hex_line_edit_impacts",
    "hex_line_edit_impact_facts",
    "hex_line_clone_siblings",
];

const FACT_PRIORITY = new Map([
    ["public_api", 0],
    ["framework_entrypoint", 1],
    ["definition", 2],
    ["through_flow", 3],
    ["outgoing_flow", 4],
    ["incoming_flow", 5],
    ["callee", 6],
    ["caller", 7],
    ["clone", 8],
    ["hotspot", 9],
]);

const _dbs = new Map();
let _driverUnavailable = false;
let _reindexUnavailable = false;
let _reindexLoader = null;
const _pendingRefreshes = new Map();
const _pendingProjectRefreshes = new Map();
const _freshnessCache = new Map();
const _projectRefreshWindows = new Map();
const _graphRefreshStats = {
    staleSuppressions: 0,
    fileRefreshScheduled: 0,
    fileRefreshCompleted: 0,
    projectRefreshThresholdHits: 0,
    projectRefreshScheduled: 0,
    projectRefreshCompleted: 0,
};
// Safety cap for parent-directory traversal while resolving the nearest project boundary.
const MAX_PROJECT_ROOT_ASCENT = 25;
const PROJECT_BOUNDARY_MARKERS = [
    "package.json",
    "pyproject.toml",
    "go.mod",
    "Cargo.toml",
    "composer.json",
    "Gemfile",
    "deno.json",
    "deno.jsonc",
    ".git",
];
const FRESHNESS_TOLERANCE_MS = 1;
const FRESHNESS_CACHE_TTL_MS = 1_000;
const PROJECT_REFRESH_THRESHOLD = 3;
const PROJECT_REFRESH_WINDOW_MS = 2_000;

export function getGraphDB(filePath, { allowStale = false } = {}) {
    if (_driverUnavailable) return null;

    try {
        const projectRoot = findProjectRoot(filePath);
        if (!projectRoot) return null;

        const dbPath = join(projectRoot, ".hex-skills/codegraph", "index.db");
        if (!existsSync(dbPath)) return null;
        if (_dbs.has(dbPath)) {
            const cached = _dbs.get(dbPath);
            if (isFilePathFresh(cached, projectRoot, filePath)) return cached;
            if (allowStale) return cached;
            _graphRefreshStats.staleSuppressions++;
            return null;
        }

        const require = createRequire(import.meta.url);
        const Database = require("better-sqlite3");
        const db = new Database(dbPath, { readonly: true });
        if (!validateContract(db)) {
            db.close();
            return null;
        }
        _dbs.set(dbPath, db);
        if (isFilePathFresh(db, projectRoot, filePath)) return db;
        if (allowStale) return db;
        _graphRefreshStats.staleSuppressions++;
        return null;
    } catch {
        _driverUnavailable = true;
        return null;
    }
}

function diagnoseFreshness(db, projectRoot, filePath) {
    try {
        const stat = statSync(filePath);
        if (!stat.isFile()) return "ok";
        const relativeFile = normalizeRelativeFile(projectRoot, filePath);
        if (!relativeFile) return "ok";
        const indexedMtime = lookupIndexedMtime(db, relativeFile);
        if (indexedMtime == null) return "file_not_indexed";
        if (Math.abs(indexedMtime - stat.mtimeMs) < FRESHNESS_TOLERANCE_MS) return "ok";
        return "stale";
    } catch {
        return "ok";
    }
}

export function diagnoseGraph(filePath) {
    if (_driverUnavailable) return { reason: "driver_missing" };
    try {
        const projectRoot = findProjectRoot(filePath);
        if (!projectRoot) return { reason: "no_project_root" };
        const dbPath = join(projectRoot, ".hex-skills/codegraph", "index.db");
        if (!existsSync(dbPath)) return { reason: "index_missing", projectRoot };
        if (_dbs.has(dbPath)) {
            const cached = _dbs.get(dbPath);
            return { reason: diagnoseFreshness(cached, projectRoot, filePath), projectRoot };
        }
        const require = createRequire(import.meta.url);
        const Database = require("better-sqlite3");
        const db = new Database(dbPath, { readonly: true });
        if (!validateContract(db)) {
            db.close();
            return { reason: "contract_mismatch", projectRoot };
        }
        _dbs.set(dbPath, db);
        return { reason: diagnoseFreshness(db, projectRoot, filePath), projectRoot };
    } catch {
        _driverUnavailable = true;
        return { reason: "driver_missing" };
    }
}

export function diagnoseGraphForProject(directoryPath) {
    if (_driverUnavailable) return { reason: "driver_missing" };
    try {
        if (!directoryPath) return { reason: "no_project_root" };
        const projectRoot = findProjectRoot(join(directoryPath, "__hex-line_probe__"));
        if (!projectRoot) return { reason: "no_project_root" };
        const dbPath = join(projectRoot, ".hex-skills/codegraph", "index.db");
        if (!existsSync(dbPath)) return { reason: "index_missing", projectRoot };
        if (_dbs.has(dbPath)) {
            return { reason: "ok", projectRoot };
        }
        const require = createRequire(import.meta.url);
        const Database = require("better-sqlite3");
        const db = new Database(dbPath, { readonly: true });
        if (!validateContract(db)) {
            db.close();
            return { reason: "contract_mismatch", projectRoot };
        }
        _dbs.set(dbPath, db);
        return { reason: "ok", projectRoot };
    } catch {
        _driverUnavailable = true;
        return { reason: "driver_missing" };
    }
}

export function getGraphDBForProject(directoryPath) {
    const { reason, projectRoot } = diagnoseGraphForProject(directoryPath);
    if (reason !== "ok" || !projectRoot) return null;
    const dbPath = join(projectRoot, ".hex-skills/codegraph", "index.db");
    return _dbs.get(dbPath) || null;
}

export function graphUnavailableHint(filePath) {
    const { reason, projectRoot } = diagnoseGraph(filePath);
    if (reason === "ok" || reason === "file_not_indexed") return [];
    const at = projectRoot ? ` at ${projectRoot.replace(/\\/g, "/")}` : "";
    switch (reason) {
    case "driver_missing":
        return ["graph_enrichment: unavailable", "graph_fix: install better-sqlite3 in hex-line-mcp package"];
    case "no_project_root":
        return ["graph_enrichment: unavailable", "graph_fix: file is outside any project root (no package.json / pyproject.toml / .git marker)"];
    case "index_missing":
        return ["graph_enrichment: unavailable", `graph_fix: run mcp__hex-graph__index_project${at}`];
    case "contract_mismatch":
        return ["graph_enrichment: unavailable", `graph_fix: index built by incompatible hex-graph version; re-run mcp__hex-graph__index_project${at}`];
    case "stale":
        return ["graph_enrichment: unavailable", `graph_fix: file modified after last index; re-run mcp__hex-graph__index_project${at} or wait for background refresh`];
    default:
        return ["graph_enrichment: unavailable"];
    }
}

export function graphUnavailableHintForProject(projectRoot) {
    const { reason } = diagnoseGraphForProject(projectRoot);
    if (reason === "ok") return [];
    const at = projectRoot ? ` at ${projectRoot.replace(/\\/g, "/")}` : "";
    switch (reason) {
    case "driver_missing":
        return ["graph_enrichment: unavailable", "graph_fix: install better-sqlite3 in hex-line-mcp package"];
    case "no_project_root":
        return ["graph_enrichment: unavailable", "graph_fix: directory is outside any project root"];
    case "index_missing":
        return ["graph_enrichment: unavailable", `graph_fix: run mcp__hex-graph__index_project${at}`];
    case "contract_mismatch":
        return ["graph_enrichment: unavailable", `graph_fix: index built by incompatible hex-graph version; re-run mcp__hex-graph__index_project${at}`];
    default:
        return ["graph_enrichment: unavailable"];
    }
}

export function _resetGraphDBCache() {
    for (const db of _dbs.values()) {
        try { db.close(); } catch { /* ignore */ }
    }
    _dbs.clear();
    _freshnessCache.clear();
    _pendingRefreshes.clear();
    _pendingProjectRefreshes.clear();
    _projectRefreshWindows.clear();
    _driverUnavailable = false;
    _reindexUnavailable = false;
    _reindexLoader = null;
}

export function _resetGraphRefreshStats() {
    _graphRefreshStats.staleSuppressions = 0;
    _graphRefreshStats.fileRefreshScheduled = 0;
    _graphRefreshStats.fileRefreshCompleted = 0;
    _graphRefreshStats.projectRefreshThresholdHits = 0;
    _graphRefreshStats.projectRefreshScheduled = 0;
    _graphRefreshStats.projectRefreshCompleted = 0;
}

export async function _waitForPendingGraphRefreshes() {
    await Promise.allSettled([
        ..._pendingRefreshes.values(),
        ..._pendingProjectRefreshes.values(),
    ]);
}

export function _graphRefreshDebugState() {
    return {
        fileRefreshCount: _pendingRefreshes.size,
        projectRefreshCount: _pendingProjectRefreshes.size,
        staleProjectCount: _projectRefreshWindows.size,
        stats: { ..._graphRefreshStats },
    };
}

function validateContract(db) {
    try {
        for (const viewName of REQUIRED_VIEWS) {
            const row = db.prepare(
                "SELECT name FROM sqlite_master WHERE type = 'view' AND name = ? LIMIT 1"
            ).get(viewName);
            if (!row) return false;
        }
        db.prepare("SELECT node_id, file, line_start, line_end, display_name, kind, is_exported, framework_incoming_count FROM hex_line_symbols LIMIT 1").all();
        db.prepare("SELECT fact_kind, related_display_name, confidence, origin FROM hex_line_line_facts LIMIT 1").all();
        db.prepare("SELECT symbol_node_id, external_callers_count, downstream_return_flow_count, downstream_property_flow_count, sink_reach_count, clone_sibling_count, public_api_count, framework_entrypoint_count, same_name_symbol_count FROM hex_line_edit_impacts LIMIT 1").all();
        db.prepare("SELECT edited_symbol_id, fact_kind, target_display_name, path_kind, flow_hops FROM hex_line_edit_impact_facts LIMIT 1").all();
        return true;
    } catch {
        return false;
    }
}

function shortKind(kind) {
    return { function: "fn", class: "cls", method: "mtd", variable: "var" }[kind] || kind;
}

function compactSymbolCounts(node) {
    const parts = [];
    if (node.is_exported) parts.push(node.is_default_export ? "default api" : "api");
    if ((node.framework_incoming_count || 0) > 0) {
        parts.push(node.framework_incoming_count === 1 ? "entrypoint" : `entrypoint ${node.framework_incoming_count}`);
    }
    if ((node.callees_exact || 0) > 0 || (node.callers_exact || 0) > 0) {
        parts.push(`${node.callees_exact}\u2193 ${node.callers_exact}\u2191`);
    }
    const flowParts = [];
    if ((node.incoming_flow_count || 0) > 0) flowParts.push(`${node.incoming_flow_count}in`);
    if ((node.outgoing_flow_count || 0) > 0) flowParts.push(`${node.outgoing_flow_count}out`);
    if ((node.through_flow_count || 0) > 0) flowParts.push(`${node.through_flow_count}thru`);
    if (flowParts.length > 0) parts.push(`flow ${flowParts.join(" ")}`);
    if ((node.clone_sibling_count || 0) > 0) parts.push(`clone ${node.clone_sibling_count}`);
    return parts;
}

function lineFactLabel(fact) {
    switch (fact.fact_kind) {
    case "public_api":
        return "api";
    case "framework_entrypoint":
        return fact.related_display_name ? `entry:${fact.related_display_name}` : "entry";
    case "definition":
        return shortKind(fact.kind);
    case "callee":
        return fact.related_display_name ? `callee:${fact.related_display_name}` : "callee";
    case "caller":
        return fact.related_display_name ? `caller:${fact.related_display_name}` : "caller";
    case "outgoing_flow":
        return `flow-out:${fact.target_anchor_kind || "?"}`;
    case "incoming_flow":
        return `flow-in:${fact.target_anchor_kind || "?"}`;
    case "through_flow":
        return "flow-through";
    case "clone":
        return "clone";
    case "hotspot":
        return "hotspot";
    default:
        return fact.fact_kind;
    }
}

function formatLineFact(fact, { includeCounts = true } = {}) {
    const countParts = includeCounts ? compactSymbolCounts(fact) : [];
    const suffix = countParts.length > 0 ? ` | ${countParts.join(" | ")}` : "";
    return `[${lineFactLabel(fact)}${suffix}]`;
}

export function symbolAnnotation(db, file, name) {
    try {
        const node = db.prepare(
            `SELECT display_name, kind, callers_exact, callees_exact, incoming_flow_count, outgoing_flow_count, through_flow_count, clone_sibling_count
                    , is_exported, is_default_export, framework_incoming_count
             FROM hex_line_symbols
             WHERE file = ? AND name = ?
             LIMIT 1`
        ).get(file, name);
        if (!node) return null;
        const parts = compactSymbolCounts(node);
        const prefix = shortKind(node.kind);
        return parts.length > 0 ? `[${prefix} ${parts.join(" | ")}]` : `[${prefix}]`;
    } catch {
        return null;
    }
}

export function ensureGraphFreshForFile(db, absoluteFilePath) {
    if (!db) return false;
    try {
        const projectRoot = findProjectRoot(absoluteFilePath);
        if (!projectRoot) return true;
        const fresh = isFilePathFresh(db, projectRoot, absoluteFilePath);
        if (!fresh) _graphRefreshStats.staleSuppressions++;
        return fresh;
    } catch {
        return true;
    }
}

export function isGraphFreshAtMtime(db, absoluteFilePath, mtimeMs) {
    if (!db) return false;
    try {
        const projectRoot = findProjectRoot(absoluteFilePath);
        if (!projectRoot) return true;
        const relativeFile = normalizeRelativeFile(projectRoot, absoluteFilePath);
        if (!relativeFile) return true;
        const indexedMtime = lookupIndexedMtime(db, relativeFile);
        if (indexedMtime == null) return false;
        return mtimeMs <= indexedMtime + FRESHNESS_TOLERANCE_MS;
    } catch {
        return true;
    }
}

export function fileAnnotations(db, file, { startLine = null, endLine = null, limit = 8 } = {}) {
    try {
        const hasRange = Number.isInteger(startLine) && Number.isInteger(endLine);
        const nodes = hasRange
            ? db.prepare(
                `SELECT display_name, kind, callers_exact, callees_exact, incoming_flow_count, outgoing_flow_count, through_flow_count, clone_sibling_count,
                        is_exported, is_default_export, framework_incoming_count, line_start
                 FROM hex_line_symbols
                 WHERE file = ?
                   AND line_start <= ?
                   AND line_end >= ?
                 ORDER BY line_start
                 LIMIT ?`
            ).all(file, endLine, startLine, limit)
            : db.prepare(
                `SELECT display_name, kind, callers_exact, callees_exact, incoming_flow_count, outgoing_flow_count, through_flow_count, clone_sibling_count,
                        is_exported, is_default_export, framework_incoming_count, line_start
                 FROM hex_line_symbols
                 WHERE file = ?
                 ORDER BY line_start
                 LIMIT ?`
            ).all(file, limit);

        return nodes.map(node => ({
            name: node.display_name,
            kind: node.kind,
            callers_exact: node.callers_exact,
            callees_exact: node.callees_exact,
            incoming_flow_count: node.incoming_flow_count,
            outgoing_flow_count: node.outgoing_flow_count,
            through_flow_count: node.through_flow_count,
            clone_sibling_count: node.clone_sibling_count,
            is_exported: !!node.is_exported,
            is_default_export: !!node.is_default_export,
            framework_incoming_count: node.framework_incoming_count,
            line_start: node.line_start,
        }));
    } catch {
        return [];
    }
}

function priorityForFact(factKind) {
    return FACT_PRIORITY.get(factKind) ?? 99;
}

export function matchAnnotation(db, file, line) {
    try {
        const facts = db.prepare(
            `SELECT
                lf.display_name,
                lf.kind,
                lf.fact_kind,
                lf.related_display_name,
                lf.source_anchor_kind,
                lf.target_anchor_kind,
                hs.callers_exact,
                hs.callees_exact,
                hs.incoming_flow_count,
                hs.outgoing_flow_count,
                hs.through_flow_count,
                hs.clone_sibling_count
             FROM hex_line_line_facts lf
             LEFT JOIN hex_line_symbols hs ON hs.node_id = lf.symbol_node_id
             WHERE lf.file = ? AND lf.line_start <= ? AND lf.line_end >= ?
             ORDER BY lf.line_start DESC`
        ).all(file, line, line);
        if (facts.length === 0) return null;
        facts.sort((left, right) => priorityForFact(left.fact_kind) - priorityForFact(right.fact_kind));
        const labels = [];
        const seenKinds = new Set();
        const seenCountKeys = new Set();
        for (const fact of facts) {
            if (seenKinds.has(fact.fact_kind)) continue;
            seenKinds.add(fact.fact_kind);
            const countKey = compactSymbolCounts(fact).join("|");
            const includeCounts = countKey.length > 0 && !seenCountKeys.has(countKey);
            if (includeCounts) seenCountKeys.add(countKey);
            labels.push(formatLineFact(fact, { includeCounts }));
            if (labels.length >= 3) break;
        }
        return labels.join(" ");
    } catch {
        return null;
    }
}

export function cloneWarning(db, file, startLine, endLine) {
    try {
        const modified = db.prepare(
            `SELECT node_id
             FROM hex_line_symbols
             WHERE file = ?
               AND line_start <= ?
               AND line_end >= ?`
        ).all(file, endLine, startLine);

        if (modified.length === 0) return [];

        const clones = [];
        const seen = new Set();
        for (const node of modified) {
            const siblings = db.prepare(
                `SELECT clone_peer_name, clone_peer_file, clone_peer_line, clone_type
                 FROM hex_line_clone_siblings
                 WHERE node_id = ?`
            ).all(node.node_id);
            for (const sibling of siblings) {
                const key = `${sibling.clone_peer_file}:${sibling.clone_peer_name}:${sibling.clone_peer_line}`;
                if (seen.has(key)) continue;
                seen.add(key);
                clones.push({
                    name: sibling.clone_peer_name,
                    file: sibling.clone_peer_file,
                    line: sibling.clone_peer_line,
                    cloneType: sibling.clone_type,
                });
            }
        }
        return clones.slice(0, 10);
    } catch {
        return [];
    }
}

export function semanticImpact(db, file, startLine, endLine) {
    try {
        const modified = db.prepare(
            `SELECT symbol_node_id, display_name, external_callers_count, downstream_return_flow_count, downstream_property_flow_count, sink_reach_count,
                    clone_sibling_count, public_api_count, framework_entrypoint_count, same_name_symbol_count
             FROM hex_line_edit_impacts
             WHERE file = ?
               AND line_start <= ?
               AND line_end >= ?`
        ).all(file, endLine, startLine);

        if (modified.length === 0) return [];

        return modified.map(item => {
            const facts = db.prepare(
                `SELECT fact_kind, target_display_name, target_file, target_line, intermediate_display_name, path_kind, flow_hops, source_anchor_kind, target_anchor_kind, access_path_json
                 FROM hex_line_edit_impact_facts
                 WHERE edited_symbol_id = ?
                 ORDER BY
                    CASE fact_kind
                        WHEN 'external_caller' THEN 0
                        WHEN 'return_flow_to_symbol' THEN 1
                        WHEN 'property_flow_to_symbol' THEN 2
                        WHEN 'flow_reaches_terminal_anchor' THEN 3
                        WHEN 'clone_sibling' THEN 4
                        ELSE 9
                    END,
                    target_file,
                    target_line`
            ).all(item.symbol_node_id);
            const seen = new Set();
            const dedupedFacts = facts.filter(fact => {
                const key = [
                    fact.fact_kind,
                    fact.target_display_name || "",
                    fact.target_file || "",
                    fact.target_line || "",
                    fact.path_kind || "",
                    fact.flow_hops || "",
                    fact.source_anchor_kind || "",
                    fact.target_anchor_kind || "",
                    fact.access_path_json || "",
                ].join("|");
                if (seen.has(key)) return false;
                seen.add(key);
                return true;
            });
            return {
                symbol: item.display_name,
                counts: {
                    externalCallers: item.external_callers_count,
                    downstreamReturnFlow: item.downstream_return_flow_count,
                    downstreamPropertyFlow: item.downstream_property_flow_count,
                    sinkReach: item.sink_reach_count,
                    cloneSiblings: item.clone_sibling_count,
                    publicApi: item.public_api_count,
                    frameworkEntrypoints: item.framework_entrypoint_count,
                    sameNameSymbols: item.same_name_symbol_count,
                },
                facts: dedupedFacts,
            };
        });
    } catch {
        return [];
    }
}

export function getRelativePath(filePath) {
    const root = findProjectRoot(filePath);
    if (!root) return null;
    return relative(root, filePath).replace(/\\/g, "/");
}

function findProjectRoot(filePath) {
    let dir = dirname(filePath);
    for (let i = 0; i < MAX_PROJECT_ROOT_ASCENT; i++) {
        if (existsSync(join(dir, ".hex-skills/codegraph", "index.db"))) return dir;
        if (PROJECT_BOUNDARY_MARKERS.some((marker) => existsSync(join(dir, marker)))) return dir;
        const parent = dirname(dir);
        if (parent === dir) break;
        dir = parent;
    }
    return null;
}

function freshnessCacheKey(projectRoot, relativeFile) {
    return `${projectRoot}:${relativeFile}`;
}

function normalizeRelativeFile(projectRoot, filePath) {
    const relFile = relative(projectRoot, filePath).replace(/\\/g, "/");
    if (!relFile || relFile.startsWith("..")) return null;
    return relFile;
}

function lookupIndexedMtime(db, relativeFile) {
    try {
        const row = db.prepare("SELECT mtime FROM files WHERE path = ? LIMIT 1").get(relativeFile);
        return row?.mtime ?? null;
    } catch {
        return null;
    }
}

function isFilePathFresh(db, projectRoot, filePath) {
    let stat;
    try {
        stat = statSync(filePath);
    } catch {
        return false;
    }
    if (!stat.isFile()) return true;

    const relativeFile = normalizeRelativeFile(projectRoot, filePath);
    if (!relativeFile) return true;

    const cacheKey = freshnessCacheKey(projectRoot, relativeFile);
    const cached = _freshnessCache.get(cacheKey);
    if (
        cached
        && (Date.now() - cached.checkedAt) < FRESHNESS_CACHE_TTL_MS
        && Math.abs(cached.actualMtime - stat.mtimeMs) < FRESHNESS_TOLERANCE_MS
    ) {
        return cached.fresh;
    }

    const indexedMtime = lookupIndexedMtime(db, relativeFile);
    const fresh = indexedMtime !== null && Math.abs(indexedMtime - stat.mtimeMs) < FRESHNESS_TOLERANCE_MS;
    _freshnessCache.set(cacheKey, {
        checkedAt: Date.now(),
        actualMtime: stat.mtimeMs,
        indexedMtime,
        fresh,
    });
    if (!fresh) scheduleGraphRefresh(projectRoot, relativeFile, cacheKey);
    return fresh;
}

function scheduleGraphRefresh(projectRoot, relativeFile, cacheKey) {
    if (_reindexUnavailable || _pendingRefreshes.has(cacheKey)) return;
    const triggeredProjectRefresh = recordStaleFile(projectRoot, relativeFile);
    if (triggeredProjectRefresh) {
        _graphRefreshStats.projectRefreshThresholdHits++;
        scheduleProjectGraphRefresh(projectRoot);
    }
    if (_pendingProjectRefreshes.has(projectRoot) && !triggeredProjectRefresh) return;
    const refresh = (async () => {
        const indexer = await loadGraphIndexer();
        if (!indexer?.reindexFile) return;
        try {
            await indexer.reindexFile(projectRoot, relativeFile);
        } catch {
            // Best-effort only: stale graph must never block hex-line.
        } finally {
            clearProjectDBCache(projectRoot);
            _freshnessCache.delete(cacheKey);
            _graphRefreshStats.fileRefreshCompleted++;
        }
    })();
    _graphRefreshStats.fileRefreshScheduled++;
    _pendingRefreshes.set(cacheKey, refresh);
    void refresh.finally(() => {
        _pendingRefreshes.delete(cacheKey);
    });
}

function recordStaleFile(projectRoot, relativeFile) {
    const now = Date.now();
    let windowState = _projectRefreshWindows.get(projectRoot);
    if (!windowState || (now - windowState.startedAt) > PROJECT_REFRESH_WINDOW_MS) {
        windowState = { startedAt: now, files: new Set() };
        _projectRefreshWindows.set(projectRoot, windowState);
    }
    windowState.files.add(relativeFile);
    return windowState.files.size >= PROJECT_REFRESH_THRESHOLD;
}

function clearProjectFreshness(projectRoot) {
    const prefix = `${projectRoot}::`;
    for (const key of _freshnessCache.keys()) {
        if (key.startsWith(prefix)) _freshnessCache.delete(key);
    }
}

function clearProjectDBCache(projectRoot) {
    const dbPath = join(projectRoot, ".hex-skills/codegraph", "index.db");
    const db = _dbs.get(dbPath);
    if (!db) return;
    try { db.close(); } catch { /* ignore */ }
    _dbs.delete(dbPath);
}

function scheduleProjectGraphRefresh(projectRoot) {
    if (_reindexUnavailable || _pendingProjectRefreshes.has(projectRoot)) return;
    const refresh = (async () => {
        const indexer = await loadGraphIndexer();
        if (!indexer?.indexProject) return;
        try {
            await indexer.indexProject(projectRoot);
        } catch {
            // Best-effort only: stale graph must never block hex-line.
        } finally {
            clearProjectDBCache(projectRoot);
            clearProjectFreshness(projectRoot);
            _projectRefreshWindows.delete(projectRoot);
            _graphRefreshStats.projectRefreshCompleted++;
        }
    })();
    _graphRefreshStats.projectRefreshScheduled++;
    _pendingProjectRefreshes.set(projectRoot, refresh);
    void refresh.finally(() => {
        _pendingProjectRefreshes.delete(projectRoot);
    });
}

async function loadGraphIndexer() {
    if (_reindexUnavailable) return null;
    if (_reindexLoader) return _reindexLoader;
    _reindexLoader = (async () => {
        try {
            const mod = await import(new URL("../../hex-graph-mcp/lib/indexer.mjs", import.meta.url));
            const reindexFile = typeof mod.reindexFile === "function" ? mod.reindexFile : null;
            const indexProject = typeof mod.indexProject === "function" ? mod.indexProject : null;
            if (reindexFile || indexProject) return { reindexFile, indexProject };
        } catch {
            // Fallback below.
        }
        _reindexUnavailable = true;
        return null;
    })();
    return _reindexLoader;
}
