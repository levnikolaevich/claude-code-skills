/**
 * SQLite graph store for code knowledge graph.
 *
 * Schema: files -> nodes -> edges, with FTS5 search and CTE traversal.
 * ON DELETE CASCADE: removing a file auto-cleans nodes + edges.
 * WAL mode: concurrent reads during watcher writes.
 * Singleton per DB path.
 */

import Database from "better-sqlite3";
import { createHash } from "node:crypto";
import { dirname, join, resolve } from "node:path";
import { existsSync, mkdirSync, rmSync } from "node:fs";
import { confidenceAtLeast, dedupeStrongest } from "./confidence.mjs";
import { normalizeProviderRun } from "./precise/provider-status.mjs";
import { anchorKey, anchorsEqual, DEFAULT_FLOW_LIMIT, DEFAULT_FLOW_MAX_HOPS, normalizeAnchor } from "./flow.mjs";

const SCHEMA_VERSION = 8;
export const CODEGRAPH_DIR = ".hex-skills/codegraph";
export const QUERY_STORE_IDLE_MS = 1_500;
const SQLITE_BUSY_TIMEOUT_MS = 2_000;
const EXTERNAL_FILE_PREFIX = "[[external]]/";
const NODE_SELECT_COLUMNS = `
    id,
    name,
    qualified_name,
    workspace_qualified_name,
    kind,
    language,
    file,
    line_start,
    line_end,
    column_start,
    column_end,
    signature,
    is_exported,
    is_default_export,
    package_id,
    workspace_module_id
`;

/**
 * User-facing display name for a node. Hides internal synthetic names.
 */
function displayName(node) {
    if (node.name === "__default_export__") return "default export";
    if (node.kind === "reexport") return `${node.name} (re-export)`;
    if (node.kind === "module") return `<${node.name}>`;
    if (node.kind === "external_module") return `${node.name} (external module)`;
    if (node.kind === "external_symbol") {
        const source = node.file?.startsWith(EXTERNAL_FILE_PREFIX) ? node.file.slice(EXTERNAL_FILE_PREFIX.length) : null;
        if (node.name === "default") return source ? `default from ${source}` : "default external symbol";
        return source ? `${node.name} (external symbol from ${source})` : `${node.name} (external symbol)`;
    }
    return node.name;
}

// --- Singleton ---

const _writeStores = new Map();
const _queryStores = new Map();

function dbDirFor(projectPath) {
    return join(projectPath, CODEGRAPH_DIR);
}

function dbPathFor(projectPath) {
    return join(dbDirFor(projectPath), "index.db");
}

function dbSidecarPaths(projectPath) {
    const dbPath = dbPathFor(projectPath);
    return [dbPath, `${dbPath}-wal`, `${dbPath}-shm`];
}

function isBusyError(error) {
    const message = error?.message || "";
    return error?.code === "EBUSY" || error?.code === "EPERM" || /busy or locked/i.test(message);
}

function graphStoreError(code, message, cause = null) {
    const error = new Error(message);
    error.code = code;
    if (cause) error.cause = cause;
    return error;
}

function probeSchemaState(dbPath) {
    try {
        const probe = new Database(dbPath, { readonly: true, fileMustExist: true });
        const ver = probe.pragma("user_version", { simple: true });
        probe.close();
        return ver === SCHEMA_VERSION
            ? { state: "current" }
            : { state: "stale", version: ver };
    } catch (error) {
        if (isBusyError(error)) {
            return { state: "busy", error };
        }
        return { state: "unreadable", error };
    }
}

function clearEntryTimer(entry) {
    if (entry?.idleTimer) {
        clearTimeout(entry.idleTimer);
        entry.idleTimer = null;
    }
}

function buildStoreEntry(registry, projectPath, mode, idleMs) {
    return {
        registry,
        projectPath,
        mode,
        idleMs,
        idleTimer: null,
        store: null,
    };
}

function closeStoreEntry(entry) {
    if (!entry?.store) return;
    clearEntryTimer(entry);
    const { store } = entry;
    entry.store = null;
    store.close();
}

function closeLocalStores(projectPath) {
    closeStoreEntry(_queryStores.get(projectPath));
    closeStoreEntry(_writeStores.get(projectPath));
}

function ensureWriterDbReady(projectPath) {
    const dbDir = dbDirFor(projectPath);
    if (!existsSync(dbDir)) mkdirSync(dbDir, { recursive: true });
    const dbPath = dbPathFor(projectPath);
    if (!existsSync(dbPath)) return;

    const probe = probeSchemaState(dbPath);
    if (probe.state === "current") return;
    if (probe.state === "busy") {
        throw graphStoreError("GRAPH_DB_BUSY", probe.error?.message || `Graph DB is busy: ${dbPath}`, probe.error);
    }

    closeLocalStores(projectPath);
    try {
        for (const filePath of dbSidecarPaths(projectPath)) {
            if (existsSync(filePath)) rmSync(filePath, { force: true });
        }
    } catch (error) {
        if (isBusyError(error)) {
            throw graphStoreError("GRAPH_DB_BUSY", error.message, error);
        }
        throw graphStoreError("GRAPH_DB_UNREADABLE", error.message, error);
    }
}

function createStore(projectPath, { mode = "write", idleMs = QUERY_STORE_IDLE_MS } = {}) {
    const registry = mode === "query" ? _queryStores : _writeStores;
    const entry = buildStoreEntry(registry, projectPath, mode, idleMs);
    const store = new Store(projectPath, entry);
    entry.store = store;
    registry.set(projectPath, entry);
    if (mode === "query") store.touch();
    return store;
}

/**
 * Get or create store for a project.
 * @param {string} projectPath - project root directory
 * @param {{mode?: "write"|"query", idleMs?: number}} [options]
 * @returns {Store}
 */
export function getStore(projectPath, options = {}) {
    const absPath = resolve(projectPath);
    const mode = options.mode === "query" ? "query" : "write";
    const registry = mode === "query" ? _queryStores : _writeStores;
    const existing = registry.get(absPath)?.store;
    if (existing) {
        if (mode === "query") existing.touch(options.idleMs);
        return existing;
    }

    if (mode === "write") {
        ensureWriterDbReady(absPath);
    }
    return createStore(absPath, { mode, idleMs: options.idleMs });
}

function hasCurrentSchema(dbPath) {
    return probeSchemaState(dbPath).state === "current";
}

function resolvePersistedProjectRoot(path) {
    let current = resolve(path);

    while (true) {
        const dbPath = join(current, CODEGRAPH_DIR, "index.db");
        if (existsSync(dbPath)) {
            return hasCurrentSchema(dbPath) ? current : null;
        }
        const parent = dirname(current);
        if (parent === current) return null;
        current = parent;
    }
}

// --- Store class ---

class Store {
    constructor(projectPath, entry) {
        this.projectPath = projectPath;
        this.mode = entry?.mode || "write";
        this.readonly = this.mode === "query";
        this._entry = entry || null;
        const dbDir = dbDirFor(projectPath);
        if (!existsSync(dbDir)) mkdirSync(dbDir, { recursive: true });
        const dbPath = dbPathFor(projectPath);
        this.db = new Database(dbPath, this.readonly ? { readonly: true, fileMustExist: true } : {});
        this.db.pragma(`busy_timeout = ${SQLITE_BUSY_TIMEOUT_MS}`);
        if (!this.readonly) {
            this.db.pragma("journal_mode = WAL");
            this.db.pragma("foreign_keys = ON");
            this._initSchema();
        }
        this._prepareStatements();
    }

    touch(idleMs = this._entry?.idleMs ?? QUERY_STORE_IDLE_MS) {
        if (this.mode !== "query" || !this._entry) return;
        this._entry.idleMs = idleMs;
        clearEntryTimer(this._entry);
        this._entry.idleTimer = setTimeout(() => {
            if (this._entry?.store === this) {
                this.close();
            }
        }, idleMs);
        if (typeof this._entry.idleTimer.unref === "function") {
            this._entry.idleTimer.unref();
        }
    }

    checkpoint() {
        if (!this.readonly) this.db.checkpoint();
    }

    _initSchema() {
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS packages (
                id INTEGER PRIMARY KEY,
                package_key TEXT NOT NULL UNIQUE,
                name TEXT NOT NULL,
                language TEXT NOT NULL,
                root_path TEXT NOT NULL,
                is_external INTEGER NOT NULL DEFAULT 0
            );

            CREATE TABLE IF NOT EXISTS workspace_modules (
                id INTEGER PRIMARY KEY,
                module_key TEXT NOT NULL UNIQUE,
                name TEXT NOT NULL,
                package_id INTEGER REFERENCES packages(id) ON DELETE CASCADE,
                language TEXT NOT NULL,
                root_path TEXT NOT NULL,
                is_external INTEGER NOT NULL DEFAULT 0
            );

            CREATE TABLE IF NOT EXISTS files (
                path TEXT PRIMARY KEY,
                mtime REAL NOT NULL,
                hash TEXT NOT NULL,
                node_count INTEGER DEFAULT 0,
                package_id INTEGER REFERENCES packages(id) ON DELETE SET NULL,
                workspace_module_id INTEGER REFERENCES workspace_modules(id) ON DELETE SET NULL
            );

            CREATE TABLE IF NOT EXISTS nodes (
                id INTEGER PRIMARY KEY,
                name TEXT NOT NULL,
                qualified_name TEXT,
                workspace_qualified_name TEXT,
                kind TEXT NOT NULL,
                language TEXT NOT NULL,
                file TEXT NOT NULL REFERENCES files(path) ON DELETE CASCADE,
                package_id INTEGER REFERENCES packages(id) ON DELETE SET NULL,
                workspace_module_id INTEGER REFERENCES workspace_modules(id) ON DELETE SET NULL,
                line_start INTEGER,
                line_end INTEGER,
                column_start INTEGER,
                column_end INTEGER,
                parent_id INTEGER REFERENCES nodes(id) ON DELETE SET NULL,
                signature TEXT,
                is_exported INTEGER NOT NULL DEFAULT 0,
                is_default_export INTEGER NOT NULL DEFAULT 0
            );

            CREATE TABLE IF NOT EXISTS edges (
                id INTEGER PRIMARY KEY,
                source_id INTEGER NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
                target_id INTEGER NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
                layer TEXT NOT NULL DEFAULT 'syntax',
                kind TEXT NOT NULL,
                confidence TEXT DEFAULT 'exact',
                origin TEXT NOT NULL DEFAULT 'parsed',
                evidence_json TEXT,
                file TEXT NOT NULL,
                line INTEGER,
                edge_hash TEXT
            );

            CREATE TABLE IF NOT EXISTS provider_runs (
                id INTEGER PRIMARY KEY,
                provider TEXT NOT NULL,
                language TEXT NOT NULL,
                status TEXT NOT NULL,
                version TEXT,
                detail TEXT,
                indexed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(provider, language)
            );

            CREATE INDEX IF NOT EXISTS idx_packages_key ON packages(package_key);
            CREATE INDEX IF NOT EXISTS idx_workspace_modules_key ON workspace_modules(module_key);
            CREATE INDEX IF NOT EXISTS idx_files_package_id ON files(package_id);
            CREATE INDEX IF NOT EXISTS idx_files_workspace_module_id ON files(workspace_module_id);
            CREATE INDEX IF NOT EXISTS idx_nodes_name ON nodes(name);
            CREATE INDEX IF NOT EXISTS idx_nodes_file ON nodes(file);
            CREATE INDEX IF NOT EXISTS idx_nodes_qualified ON nodes(qualified_name);
            CREATE INDEX IF NOT EXISTS idx_nodes_workspace_qualified ON nodes(workspace_qualified_name);
            CREATE INDEX IF NOT EXISTS idx_nodes_kind ON nodes(kind);
            CREATE INDEX IF NOT EXISTS idx_nodes_package_id ON nodes(package_id);
            CREATE INDEX IF NOT EXISTS idx_nodes_workspace_module_id ON nodes(workspace_module_id);
            CREATE INDEX IF NOT EXISTS idx_edges_source ON edges(source_id);
            CREATE INDEX IF NOT EXISTS idx_edges_target ON edges(target_id);
            CREATE INDEX IF NOT EXISTS idx_edges_kind ON edges(kind, source_id);
            CREATE INDEX IF NOT EXISTS idx_edges_kind_target ON edges(kind, target_id);
            CREATE INDEX IF NOT EXISTS idx_edges_layer_kind_source ON edges(layer, kind, source_id);
            CREATE INDEX IF NOT EXISTS idx_edges_layer_kind_target ON edges(layer, kind, target_id);
            CREATE INDEX IF NOT EXISTS idx_provider_runs_language ON provider_runs(language);
            CREATE INDEX IF NOT EXISTS idx_nodes_exported ON nodes(is_exported) WHERE is_exported = 1;
        `);

        // Clone detection tables (non-destructive migration)
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS clone_blocks (
                node_id INTEGER PRIMARY KEY REFERENCES nodes(id) ON DELETE CASCADE,
                raw_hash TEXT NOT NULL,
                norm_hash TEXT NOT NULL,
                fingerprint BLOB,
                stmt_count INTEGER NOT NULL,
                token_count INTEGER NOT NULL
            );

            CREATE INDEX IF NOT EXISTS idx_clone_raw ON clone_blocks(raw_hash);
            CREATE INDEX IF NOT EXISTS idx_clone_norm ON clone_blocks(norm_hash);
            CREATE INDEX IF NOT EXISTS idx_clone_stmts ON clone_blocks(stmt_count);

            CREATE TABLE IF NOT EXISTS clone_lsh (
                band_id INTEGER NOT NULL,
                bucket_hash TEXT NOT NULL,
                node_id INTEGER NOT NULL REFERENCES clone_blocks(node_id) ON DELETE CASCADE,
                PRIMARY KEY (band_id, bucket_hash, node_id)
            );

            CREATE INDEX IF NOT EXISTS idx_lsh_lookup ON clone_lsh(band_id, bucket_hash);
        `);

        this.db.exec(`
            CREATE TABLE IF NOT EXISTS flow_summaries (
                id INTEGER PRIMARY KEY,
                owner_id INTEGER NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
                kind TEXT NOT NULL,
                source_name TEXT NOT NULL,
                target_name TEXT NOT NULL,
                related_symbol_id INTEGER REFERENCES nodes(id) ON DELETE SET NULL,
                file TEXT NOT NULL,
                line INTEGER,
                confidence TEXT NOT NULL DEFAULT 'exact',
                summary_hash TEXT NOT NULL UNIQUE
            );

            CREATE INDEX IF NOT EXISTS idx_flow_owner ON flow_summaries(owner_id);
            CREATE INDEX IF NOT EXISTS idx_flow_related ON flow_summaries(related_symbol_id);
        `);

        this.db.exec(`
            CREATE TABLE IF NOT EXISTS flow_facts (
                id INTEGER PRIMARY KEY,
                source_symbol_id INTEGER NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
                source_anchor_kind TEXT NOT NULL,
                source_anchor_name TEXT NOT NULL,
                source_access_path_json TEXT,
                target_symbol_id INTEGER NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
                target_anchor_kind TEXT NOT NULL,
                target_anchor_name TEXT NOT NULL,
                target_access_path_json TEXT,
                flow_kind TEXT NOT NULL DEFAULT 'value',
                file TEXT NOT NULL,
                line INTEGER,
                confidence TEXT NOT NULL DEFAULT 'exact',
                origin TEXT NOT NULL DEFAULT 'parser_fact',
                evidence_json TEXT,
                fact_hash TEXT NOT NULL UNIQUE
            );

            CREATE INDEX IF NOT EXISTS idx_flow_facts_source_symbol ON flow_facts(source_symbol_id);
            CREATE INDEX IF NOT EXISTS idx_flow_facts_target_symbol ON flow_facts(target_symbol_id);
            CREATE INDEX IF NOT EXISTS idx_flow_facts_source_anchor ON flow_facts(source_symbol_id, source_anchor_kind, source_anchor_name);
            CREATE INDEX IF NOT EXISTS idx_flow_facts_target_anchor ON flow_facts(target_symbol_id, target_anchor_kind, target_anchor_name);
            CREATE INDEX IF NOT EXISTS idx_flow_facts_kind ON flow_facts(flow_kind);
        `);

        this.db.exec(`
            DROP VIEW IF EXISTS hex_line_contract;
            DROP VIEW IF EXISTS hex_line_symbol_annotations;
            DROP VIEW IF EXISTS hex_line_call_edges;
            DROP VIEW IF EXISTS hex_line_clone_siblings;
            DROP VIEW IF EXISTS hex_line_symbols;
            DROP VIEW IF EXISTS hex_line_line_facts;
            DROP VIEW IF EXISTS hex_line_edit_impacts;
            DROP VIEW IF EXISTS hex_line_edit_impact_facts;

            CREATE VIEW hex_line_symbols AS
            WITH flow_in AS (
                SELECT target_symbol_id AS node_id, COUNT(*) AS incoming_flow_count
                FROM flow_facts
                GROUP BY target_symbol_id
            ),
            flow_out AS (
                SELECT source_symbol_id AS node_id, COUNT(*) AS outgoing_flow_count
                FROM flow_facts
                GROUP BY source_symbol_id
            ),
            through_points AS (
                SELECT src.source_symbol_id AS node_id, COUNT(*) AS through_flow_count
                FROM flow_facts src
                JOIN flow_facts dst
                  ON dst.source_symbol_id = src.target_symbol_id
                 AND dst.source_anchor_kind = src.target_anchor_kind
                 AND dst.source_anchor_name = src.target_anchor_name
                 AND COALESCE(dst.source_access_path_json, '') = COALESCE(src.target_access_path_json, '')
                GROUP BY src.source_symbol_id
            ),
            framework_in AS (
                SELECT target_id AS node_id, COUNT(DISTINCT source_id || '|' || kind || '|' || COALESCE(file, '') || '|' || COALESCE(line, 0)) AS framework_incoming_count
                FROM edges
                WHERE layer = 'framework'
                GROUP BY target_id
            ),
            clone_counts AS (
                SELECT a.node_id AS node_id, COUNT(DISTINCT b.node_id) AS clone_sibling_count
                FROM clone_blocks a
                JOIN clone_blocks b
                  ON b.norm_hash = a.norm_hash
                 AND b.node_id != a.node_id
                GROUP BY a.node_id
            )
            SELECT
                n.id AS node_id,
                n.file AS file,
                n.line_start AS line_start,
                n.line_end AS line_end,
                n.name AS name,
                CASE
                    WHEN n.name = '__default_export__' THEN 'default export'
                    ELSE n.name
                END AS display_name,
                n.kind AS kind,
                (
                    SELECT COUNT(DISTINCT e.source_id)
                    FROM edges e
                    WHERE e.target_id = n.id
                      AND e.kind = 'calls'
                      AND e.confidence IN ('exact', 'precise')
                ) AS callers_exact,
                (
                    SELECT COUNT(DISTINCT e.target_id)
                    FROM edges e
                    WHERE e.source_id = n.id
                      AND e.kind = 'calls'
                      AND e.confidence IN ('exact', 'precise')
                ) AS callees_exact,
                COALESCE(flow_in.incoming_flow_count, 0) AS incoming_flow_count,
                COALESCE(flow_out.outgoing_flow_count, 0) AS outgoing_flow_count,
                COALESCE(through_points.through_flow_count, 0) AS through_flow_count,
                COALESCE(clone_counts.clone_sibling_count, 0) AS clone_sibling_count,
                COALESCE(framework_in.framework_incoming_count, 0) AS framework_incoming_count,
                n.is_exported AS is_exported,
                n.is_default_export AS is_default_export
            FROM nodes n
            LEFT JOIN flow_in ON flow_in.node_id = n.id
            LEFT JOIN flow_out ON flow_out.node_id = n.id
            LEFT JOIN through_points ON through_points.node_id = n.id
            LEFT JOIN clone_counts ON clone_counts.node_id = n.id
            LEFT JOIN framework_in ON framework_in.node_id = n.id
            WHERE n.kind NOT IN ('import', 'import_stmt', 'module', 'namespace_binding', 'reexport', 'external_module', 'external_symbol');

            CREATE VIEW hex_line_line_facts AS
            SELECT
                n.file AS file,
                n.line_start AS line_start,
                n.line_end AS line_end,
                n.id AS symbol_node_id,
                CASE
                    WHEN n.name = '__default_export__' THEN 'default export'
                    ELSE n.name
                END AS display_name,
                n.kind AS kind,
                'definition' AS fact_kind,
                NULL AS related_symbol_id,
                NULL AS related_display_name,
                NULL AS related_file,
                NULL AS related_line,
                NULL AS source_anchor_kind,
                NULL AS source_anchor_name,
                NULL AS target_anchor_kind,
                NULL AS target_anchor_name,
                NULL AS access_path_json,
                'exact' AS confidence,
                'graph_symbol' AS origin
            FROM nodes n
            WHERE n.kind NOT IN ('import', 'import_stmt', 'module', 'namespace_binding', 'reexport', 'external_module', 'external_symbol')

            UNION ALL

            SELECT
                n.file AS file,
                n.line_start AS line_start,
                n.line_end AS line_end,
                n.id AS symbol_node_id,
                CASE
                    WHEN n.name = '__default_export__' THEN 'default export'
                    ELSE n.name
                END AS display_name,
                n.kind AS kind,
                'public_api' AS fact_kind,
                NULL AS related_symbol_id,
                CASE
                    WHEN n.is_default_export = 1 THEN 'default export'
                    ELSE 'exported symbol'
                END AS related_display_name,
                NULL AS related_file,
                NULL AS related_line,
                NULL AS source_anchor_kind,
                NULL AS source_anchor_name,
                NULL AS target_anchor_kind,
                NULL AS target_anchor_name,
                NULL AS access_path_json,
                'exact' AS confidence,
                'export_index' AS origin
            FROM nodes n
            WHERE n.is_exported = 1
              AND n.kind NOT IN ('import', 'import_stmt', 'module', 'namespace_binding', 'reexport', 'external_module', 'external_symbol')

            UNION ALL

            SELECT
                tgt.file AS file,
                tgt.line_start AS line_start,
                tgt.line_end AS line_end,
                tgt.id AS symbol_node_id,
                CASE WHEN tgt.name = '__default_export__' THEN 'default export' ELSE tgt.name END AS display_name,
                tgt.kind AS kind,
                'framework_entrypoint' AS fact_kind,
                src.id AS related_symbol_id,
                e.kind AS related_display_name,
                src.file AS related_file,
                src.line_start AS related_line,
                NULL AS source_anchor_kind,
                NULL AS source_anchor_name,
                NULL AS target_anchor_kind,
                NULL AS target_anchor_name,
                NULL AS access_path_json,
                e.confidence AS confidence,
                e.origin AS origin
            FROM edges e
            JOIN nodes src ON src.id = e.source_id
            JOIN nodes tgt ON tgt.id = e.target_id
            WHERE e.layer = 'framework'
              AND tgt.kind NOT IN ('import', 'import_stmt', 'module', 'namespace_binding', 'reexport', 'external_module', 'external_symbol')

            UNION ALL

            SELECT
                e.file AS file,
                e.line AS line_start,
                e.line AS line_end,
                src.id AS symbol_node_id,
                CASE WHEN src.name = '__default_export__' THEN 'default export' ELSE src.name END AS display_name,
                src.kind AS kind,
                'callee' AS fact_kind,
                tgt.id AS related_symbol_id,
                CASE WHEN tgt.name = '__default_export__' THEN 'default export' ELSE tgt.name END AS related_display_name,
                tgt.file AS related_file,
                tgt.line_start AS related_line,
                NULL AS source_anchor_kind,
                NULL AS source_anchor_name,
                NULL AS target_anchor_kind,
                NULL AS target_anchor_name,
                NULL AS access_path_json,
                e.confidence AS confidence,
                e.origin AS origin
            FROM edges e
            JOIN nodes src ON src.id = e.source_id
            JOIN nodes tgt ON tgt.id = e.target_id
            WHERE e.kind = 'calls'
              AND src.kind NOT IN ('import', 'import_stmt', 'module', 'namespace_binding', 'reexport', 'external_module', 'external_symbol')
              AND tgt.kind NOT IN ('import', 'import_stmt', 'module', 'namespace_binding', 'reexport', 'external_module', 'external_symbol')

            UNION ALL

            SELECT
                e.file AS file,
                e.line AS line_start,
                e.line AS line_end,
                tgt.id AS symbol_node_id,
                CASE WHEN tgt.name = '__default_export__' THEN 'default export' ELSE tgt.name END AS display_name,
                tgt.kind AS kind,
                'caller' AS fact_kind,
                src.id AS related_symbol_id,
                CASE WHEN src.name = '__default_export__' THEN 'default export' ELSE src.name END AS related_display_name,
                src.file AS related_file,
                src.line_start AS related_line,
                NULL AS source_anchor_kind,
                NULL AS source_anchor_name,
                NULL AS target_anchor_kind,
                NULL AS target_anchor_name,
                NULL AS access_path_json,
                e.confidence AS confidence,
                e.origin AS origin
            FROM edges e
            JOIN nodes src ON src.id = e.source_id
            JOIN nodes tgt ON tgt.id = e.target_id
            WHERE e.kind = 'calls'
              AND src.kind NOT IN ('import', 'import_stmt', 'module', 'namespace_binding', 'reexport', 'external_module', 'external_symbol')
              AND tgt.kind NOT IN ('import', 'import_stmt', 'module', 'namespace_binding', 'reexport', 'external_module', 'external_symbol')

            UNION ALL

            SELECT
                ff.file AS file,
                ff.line AS line_start,
                ff.line AS line_end,
                src.id AS symbol_node_id,
                CASE WHEN src.name = '__default_export__' THEN 'default export' ELSE src.name END AS display_name,
                src.kind AS kind,
                'outgoing_flow' AS fact_kind,
                tgt.id AS related_symbol_id,
                CASE WHEN tgt.name = '__default_export__' THEN 'default export' ELSE tgt.name END AS related_display_name,
                tgt.file AS related_file,
                tgt.line_start AS related_line,
                ff.source_anchor_kind AS source_anchor_kind,
                ff.source_anchor_name AS source_anchor_name,
                ff.target_anchor_kind AS target_anchor_kind,
                ff.target_anchor_name AS target_anchor_name,
                ff.target_access_path_json AS access_path_json,
                ff.confidence AS confidence,
                ff.origin AS origin
            FROM flow_facts ff
            JOIN nodes src ON src.id = ff.source_symbol_id
            JOIN nodes tgt ON tgt.id = ff.target_symbol_id
            WHERE src.kind NOT IN ('import', 'import_stmt', 'module', 'namespace_binding', 'reexport', 'external_module', 'external_symbol')
              AND tgt.kind NOT IN ('import', 'import_stmt', 'module', 'namespace_binding', 'reexport', 'external_module', 'external_symbol')

            UNION ALL

            SELECT
                ff.file AS file,
                ff.line AS line_start,
                ff.line AS line_end,
                tgt.id AS symbol_node_id,
                CASE WHEN tgt.name = '__default_export__' THEN 'default export' ELSE tgt.name END AS display_name,
                tgt.kind AS kind,
                'incoming_flow' AS fact_kind,
                src.id AS related_symbol_id,
                CASE WHEN src.name = '__default_export__' THEN 'default export' ELSE src.name END AS related_display_name,
                src.file AS related_file,
                src.line_start AS related_line,
                ff.source_anchor_kind AS source_anchor_kind,
                ff.source_anchor_name AS source_anchor_name,
                ff.target_anchor_kind AS target_anchor_kind,
                ff.target_anchor_name AS target_anchor_name,
                ff.target_access_path_json AS access_path_json,
                ff.confidence AS confidence,
                ff.origin AS origin
            FROM flow_facts ff
            JOIN nodes src ON src.id = ff.source_symbol_id
            JOIN nodes tgt ON tgt.id = ff.target_symbol_id
            WHERE src.kind NOT IN ('import', 'import_stmt', 'module', 'namespace_binding', 'reexport', 'external_module', 'external_symbol')
              AND tgt.kind NOT IN ('import', 'import_stmt', 'module', 'namespace_binding', 'reexport', 'external_module', 'external_symbol')

            UNION ALL

            SELECT
                ff.file AS file,
                ff.line AS line_start,
                ff.line AS line_end,
                mid.id AS symbol_node_id,
                CASE WHEN mid.name = '__default_export__' THEN 'default export' ELSE mid.name END AS display_name,
                mid.kind AS kind,
                'through_flow' AS fact_kind,
                nxt.id AS related_symbol_id,
                CASE WHEN nxt.name = '__default_export__' THEN 'default export' ELSE nxt.name END AS related_display_name,
                nxt.file AS related_file,
                nxt.line_start AS related_line,
                ff2.source_anchor_kind AS source_anchor_kind,
                ff2.source_anchor_name AS source_anchor_name,
                ff2.target_anchor_kind AS target_anchor_kind,
                ff2.target_anchor_name AS target_anchor_name,
                ff2.target_access_path_json AS access_path_json,
                ff2.confidence AS confidence,
                ff2.origin AS origin
            FROM flow_facts ff
            JOIN flow_facts ff2
              ON ff2.source_symbol_id = ff.target_symbol_id
             AND ff2.source_anchor_kind = ff.target_anchor_kind
             AND ff2.source_anchor_name = ff.target_anchor_name
             AND COALESCE(ff2.source_access_path_json, '') = COALESCE(ff.target_access_path_json, '')
            JOIN nodes mid ON mid.id = ff.target_symbol_id
            JOIN nodes nxt ON nxt.id = ff2.target_symbol_id
            WHERE mid.kind NOT IN ('import', 'import_stmt', 'module', 'namespace_binding', 'reexport', 'external_module', 'external_symbol')
              AND nxt.kind NOT IN ('import', 'import_stmt', 'module', 'namespace_binding', 'reexport', 'external_module', 'external_symbol');

            CREATE VIEW hex_line_clone_siblings AS
            SELECT
                a.node_id AS node_id,
                CASE WHEN n1.name = '__default_export__' THEN 'default export' ELSE n1.name END AS display_name,
                n1.file AS file,
                n1.line_start AS line_start,
                b.node_id AS clone_peer_id,
                CASE WHEN n2.name = '__default_export__' THEN 'default export' ELSE n2.name END AS clone_peer_name,
                n2.file AS clone_peer_file,
                n2.line_start AS clone_peer_line,
                CASE
                    WHEN a.raw_hash = b.raw_hash THEN 'exact'
                    ELSE 'normalized'
                END AS clone_type
            FROM clone_blocks a
            JOIN clone_blocks b
              ON b.norm_hash = a.norm_hash
             AND b.node_id != a.node_id
            JOIN nodes n1 ON n1.id = a.node_id
            JOIN nodes n2 ON n2.id = b.node_id;

            CREATE VIEW hex_line_edit_impact_facts AS
            SELECT DISTINCT
                tgt.id AS edited_symbol_id,
                'external_caller' AS fact_kind,
                src.id AS target_symbol_id,
                CASE WHEN src.name = '__default_export__' THEN 'default export' ELSE src.name END AS target_display_name,
                src.file AS target_file,
                src.line_start AS target_line,
                NULL AS intermediate_symbol_id,
                NULL AS intermediate_display_name,
                'call' AS path_kind,
                1 AS flow_hops,
                NULL AS source_anchor_kind,
                NULL AS source_anchor_name,
                NULL AS target_anchor_kind,
                NULL AS target_anchor_name,
                NULL AS access_path_json,
                e.confidence AS confidence,
                e.origin AS origin
            FROM edges e
            JOIN nodes src ON src.id = e.source_id
            JOIN nodes tgt ON tgt.id = e.target_id
            WHERE e.kind = 'calls'
              AND src.file != tgt.file
              AND e.confidence IN ('exact', 'precise')

            UNION ALL

            SELECT
                n.id AS edited_symbol_id,
                'public_api' AS fact_kind,
                n.id AS target_symbol_id,
                CASE
                    WHEN n.is_default_export = 1 THEN 'default export'
                    WHEN n.name = '__default_export__' THEN 'default export'
                    ELSE n.name
                END AS target_display_name,
                n.file AS target_file,
                n.line_start AS target_line,
                NULL AS intermediate_symbol_id,
                NULL AS intermediate_display_name,
                'exported_symbol' AS path_kind,
                0 AS flow_hops,
                NULL AS source_anchor_kind,
                NULL AS source_anchor_name,
                NULL AS target_anchor_kind,
                NULL AS target_anchor_name,
                NULL AS access_path_json,
                'exact' AS confidence,
                'export_index' AS origin
            FROM nodes n
            WHERE n.is_exported = 1

            UNION ALL

            SELECT DISTINCT
                tgt.id AS edited_symbol_id,
                'framework_entrypoint' AS fact_kind,
                src.id AS target_symbol_id,
                CASE WHEN src.name = '__default_export__' THEN 'default export' ELSE src.name END AS target_display_name,
                src.file AS target_file,
                src.line_start AS target_line,
                NULL AS intermediate_symbol_id,
                NULL AS intermediate_display_name,
                e.kind AS path_kind,
                1 AS flow_hops,
                NULL AS source_anchor_kind,
                NULL AS source_anchor_name,
                NULL AS target_anchor_kind,
                NULL AS target_anchor_name,
                NULL AS access_path_json,
                e.confidence AS confidence,
                e.origin AS origin
            FROM edges e
            JOIN nodes src ON src.id = e.source_id
            JOIN nodes tgt ON tgt.id = e.target_id
            WHERE e.layer = 'framework'

            UNION ALL

            SELECT
                ff.source_symbol_id AS edited_symbol_id,
                CASE
                    WHEN ff.target_anchor_kind = 'property' THEN 'property_flow_to_symbol'
                    ELSE 'return_flow_to_symbol'
                END AS fact_kind,
                tgt.id AS target_symbol_id,
                CASE WHEN tgt.name = '__default_export__' THEN 'default export' ELSE tgt.name END AS target_display_name,
                tgt.file AS target_file,
                tgt.line_start AS target_line,
                NULL AS intermediate_symbol_id,
                NULL AS intermediate_display_name,
                CASE
                    WHEN ff.target_anchor_kind = 'property' THEN 'property_flow'
                    WHEN ff.source_anchor_kind = 'return' THEN 'return_flow'
                    ELSE 'flow'
                END AS path_kind,
                1 AS flow_hops,
                ff.source_anchor_kind AS source_anchor_kind,
                ff.source_anchor_name AS source_anchor_name,
                ff.target_anchor_kind AS target_anchor_kind,
                ff.target_anchor_name AS target_anchor_name,
                ff.target_access_path_json AS access_path_json,
                ff.confidence AS confidence,
                ff.origin AS origin
            FROM flow_facts ff
            JOIN nodes tgt ON tgt.id = ff.target_symbol_id
            WHERE ff.source_anchor_kind = 'return'
              AND ff.source_symbol_id != ff.target_symbol_id

            UNION ALL

            SELECT
                ff1.source_symbol_id AS edited_symbol_id,
                CASE
                    WHEN ff2.target_anchor_kind = 'property' THEN 'property_flow_to_symbol'
                    ELSE 'flow_reaches_terminal_anchor'
                END AS fact_kind,
                tgt.id AS target_symbol_id,
                CASE WHEN tgt.name = '__default_export__' THEN 'default export' ELSE tgt.name END AS target_display_name,
                tgt.file AS target_file,
                tgt.line_start AS target_line,
                mid.id AS intermediate_symbol_id,
                CASE WHEN mid.name = '__default_export__' THEN 'default export' ELSE mid.name END AS intermediate_display_name,
                'flow_chain' AS path_kind,
                2 AS flow_hops,
                ff1.source_anchor_kind AS source_anchor_kind,
                ff1.source_anchor_name AS source_anchor_name,
                ff2.target_anchor_kind AS target_anchor_kind,
                ff2.target_anchor_name AS target_anchor_name,
                ff2.target_access_path_json AS access_path_json,
                ff2.confidence AS confidence,
                ff2.origin AS origin
            FROM flow_facts ff1
            JOIN flow_facts ff2
              ON ff2.source_symbol_id = ff1.target_symbol_id
             AND ff2.source_anchor_kind = ff1.target_anchor_kind
             AND ff2.source_anchor_name = ff1.target_anchor_name
             AND COALESCE(ff2.source_access_path_json, '') = COALESCE(ff1.target_access_path_json, '')
            JOIN nodes mid ON mid.id = ff1.target_symbol_id
            JOIN nodes tgt ON tgt.id = ff2.target_symbol_id
            WHERE ff1.source_anchor_kind = 'return'
              AND ff1.source_symbol_id != ff2.target_symbol_id

            UNION ALL

            SELECT
                c.node_id AS edited_symbol_id,
                'clone_sibling' AS fact_kind,
                c.clone_peer_id AS target_symbol_id,
                c.clone_peer_name AS target_display_name,
                c.clone_peer_file AS target_file,
                c.clone_peer_line AS target_line,
                NULL AS intermediate_symbol_id,
                NULL AS intermediate_display_name,
                c.clone_type AS path_kind,
                1 AS flow_hops,
                NULL AS source_anchor_kind,
                NULL AS source_anchor_name,
                NULL AS target_anchor_kind,
                NULL AS target_anchor_name,
                NULL AS access_path_json,
                'exact' AS confidence,
                'clone_index' AS origin
            FROM hex_line_clone_siblings c

            UNION ALL

            SELECT
                src.id AS edited_symbol_id,
                'same_name_symbol' AS fact_kind,
                peer.id AS target_symbol_id,
                CASE WHEN peer.name = '__default_export__' THEN 'default export' ELSE peer.name END AS target_display_name,
                peer.file AS target_file,
                peer.line_start AS target_line,
                NULL AS intermediate_symbol_id,
                NULL AS intermediate_display_name,
                'same_name' AS path_kind,
                1 AS flow_hops,
                NULL AS source_anchor_kind,
                NULL AS source_anchor_name,
                NULL AS target_anchor_kind,
                NULL AS target_anchor_name,
                NULL AS access_path_json,
                'low' AS confidence,
                'name_index' AS origin
            FROM nodes src
            JOIN nodes peer
              ON LOWER(peer.name) = LOWER(src.name)
             AND peer.kind = src.kind
             AND peer.id != src.id
             AND peer.file != src.file
            WHERE src.kind NOT IN ('import', 'import_stmt', 'module', 'namespace_binding', 'reexport', 'external_module', 'external_symbol')
              AND peer.kind NOT IN ('import', 'import_stmt', 'module', 'namespace_binding', 'reexport', 'external_module', 'external_symbol');

            CREATE VIEW hex_line_edit_impacts AS
            SELECT
                s.node_id AS symbol_node_id,
                s.file AS file,
                s.line_start AS line_start,
                s.line_end AS line_end,
                s.display_name AS display_name,
                COUNT(DISTINCT CASE
                    WHEN f.fact_kind = 'external_caller'
                    THEN COALESCE(CAST(f.target_symbol_id AS TEXT), '') || '|' || COALESCE(f.target_file, '') || '|' || COALESCE(CAST(f.target_line AS TEXT), '')
                END) AS external_callers_count,
                COUNT(DISTINCT CASE
                    WHEN f.fact_kind = 'return_flow_to_symbol'
                    THEN COALESCE(CAST(f.target_symbol_id AS TEXT), '') || '|' || COALESCE(f.path_kind, '') || '|' || COALESCE(f.target_anchor_kind, '')
                END) AS downstream_return_flow_count,
                COUNT(DISTINCT CASE
                    WHEN f.fact_kind = 'property_flow_to_symbol'
                    THEN COALESCE(CAST(f.target_symbol_id AS TEXT), '') || '|' || COALESCE(f.path_kind, '') || '|' || COALESCE(f.access_path_json, '')
                END) AS downstream_property_flow_count,
                COUNT(DISTINCT CASE
                    WHEN f.fact_kind = 'flow_reaches_terminal_anchor'
                    THEN COALESCE(CAST(f.target_symbol_id AS TEXT), '') || '|' || COALESCE(f.path_kind, '') || '|' || COALESCE(f.target_anchor_kind, '')
                END) AS sink_reach_count,
                COUNT(DISTINCT CASE
                    WHEN f.fact_kind = 'clone_sibling'
                    THEN COALESCE(CAST(f.target_symbol_id AS TEXT), '') || '|' || COALESCE(f.path_kind, '')
                END) AS clone_sibling_count,
                COUNT(DISTINCT CASE
                    WHEN f.fact_kind = 'public_api'
                    THEN COALESCE(CAST(f.target_symbol_id AS TEXT), '')
                END) AS public_api_count,
                COUNT(DISTINCT CASE
                    WHEN f.fact_kind = 'framework_entrypoint'
                    THEN COALESCE(CAST(f.target_symbol_id AS TEXT), '') || '|' || COALESCE(f.path_kind, '')
                END) AS framework_entrypoint_count,
                COUNT(DISTINCT CASE
                    WHEN f.fact_kind = 'same_name_symbol'
                    THEN COALESCE(CAST(f.target_symbol_id AS TEXT), '') || '|' || COALESCE(f.target_file, '')
                END) AS same_name_symbol_count
            FROM hex_line_symbols s
            LEFT JOIN hex_line_edit_impact_facts f
              ON f.edited_symbol_id = s.node_id
            GROUP BY s.node_id, s.file, s.line_start, s.line_end, s.display_name;
        `);

        // Module-level import edges (file-to-file raw evidence)
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS module_edges (
                id INTEGER PRIMARY KEY,
                source_file TEXT NOT NULL REFERENCES files(path) ON DELETE CASCADE,
                target_file TEXT NOT NULL,
                line INTEGER,
                is_side_effect INTEGER NOT NULL DEFAULT 0,
                is_dynamic INTEGER NOT NULL DEFAULT 0,
                is_reexport INTEGER NOT NULL DEFAULT 0
            );

            CREATE INDEX IF NOT EXISTS idx_module_edges_source ON module_edges(source_file);
            CREATE INDEX IF NOT EXISTS idx_module_edges_target ON module_edges(target_file);
        `);

        this.db.exec(`
            CREATE TABLE IF NOT EXISTS package_edges (
                id INTEGER PRIMARY KEY,
                source_module_id INTEGER NOT NULL REFERENCES workspace_modules(id) ON DELETE CASCADE,
                target_module_id INTEGER REFERENCES workspace_modules(id) ON DELETE SET NULL,
                source_package_id INTEGER NOT NULL REFERENCES packages(id) ON DELETE CASCADE,
                target_package_id INTEGER REFERENCES packages(id) ON DELETE SET NULL,
                source_file TEXT NOT NULL REFERENCES files(path) ON DELETE CASCADE,
                target_file TEXT,
                import_source TEXT NOT NULL,
                resolution TEXT NOT NULL,
                is_reexport INTEGER NOT NULL DEFAULT 0
            );

            CREATE INDEX IF NOT EXISTS idx_package_edges_source_module ON package_edges(source_module_id);
            CREATE INDEX IF NOT EXISTS idx_package_edges_target_module ON package_edges(target_module_id);
            CREATE INDEX IF NOT EXISTS idx_package_edges_source_package ON package_edges(source_package_id);
            CREATE INDEX IF NOT EXISTS idx_package_edges_target_package ON package_edges(target_package_id);
            CREATE INDEX IF NOT EXISTS idx_package_edges_source_file ON package_edges(source_file);
        `);

        this.db.pragma(`user_version = ${SCHEMA_VERSION}`);

        // FTS5 external content table
        const hasFts = this.db.prepare(
            "SELECT name FROM sqlite_master WHERE type='table' AND name='nodes_fts'"
        ).get();

        if (!hasFts) {
            this.db.exec(`
                CREATE VIRTUAL TABLE nodes_fts USING fts5(
                    name, kind, file,
                    content=nodes, content_rowid=id
                );

                CREATE TRIGGER nodes_ai AFTER INSERT ON nodes BEGIN
                    INSERT INTO nodes_fts(rowid, name, kind, file)
                    VALUES (new.id, new.name, new.kind, new.file);
                END;

                CREATE TRIGGER nodes_ad AFTER DELETE ON nodes BEGIN
                    INSERT INTO nodes_fts(nodes_fts, rowid, name, kind, file)
                    VALUES ('delete', old.id, old.name, old.kind, old.file);
                END;

                CREATE TRIGGER nodes_au AFTER UPDATE ON nodes BEGIN
                    INSERT INTO nodes_fts(nodes_fts, rowid, name, kind, file)
                    VALUES ('delete', old.id, old.name, old.kind, old.file);
                    INSERT INTO nodes_fts(rowid, name, kind, file)
                    VALUES (new.id, new.name, new.kind, new.file);
                END;
            `);
        }
    }

    _prepareStatements() {
        this._insertFile = this.db.prepare(
            "INSERT OR REPLACE INTO files (path, mtime, hash, node_count, package_id, workspace_module_id) VALUES (?, ?, ?, ?, ?, ?)"
        );
        this._getFile = this.db.prepare("SELECT * FROM files WHERE path = ?");
        this._deleteFile = this.db.prepare("DELETE FROM files WHERE path = ?");
        this._allFiles = this.db.prepare("SELECT path FROM files");
        this._insertPackage = this.db.prepare(
            "INSERT INTO packages (package_key, name, language, root_path, is_external) VALUES (@package_key, @name, @language, @root_path, @is_external)"
        );
        this._getPackageByKey = this.db.prepare("SELECT * FROM packages WHERE package_key = ?");
        this._insertWorkspaceModule = this.db.prepare(
            "INSERT INTO workspace_modules (module_key, name, package_id, language, root_path, is_external) VALUES (@module_key, @name, @package_id, @language, @root_path, @is_external)"
        );
        this._getWorkspaceModuleByKey = this.db.prepare("SELECT * FROM workspace_modules WHERE module_key = ?");
        this._clearPackageEdgesForFile = this.db.prepare("DELETE FROM package_edges WHERE source_file = ?");
        this._insertPackageEdge = this.db.prepare(
            `INSERT INTO package_edges (
                source_module_id, target_module_id, source_package_id, target_package_id,
                source_file, target_file, import_source, resolution, is_reexport
            ) VALUES (
                @source_module_id, @target_module_id, @source_package_id, @target_package_id,
                @source_file, @target_file, @import_source, @resolution, @is_reexport
            )`
        );
        this._workspaceModuleRows = this.db.prepare(`
            SELECT
                wm.id,
                wm.module_key,
                wm.name,
                wm.language,
                wm.root_path,
                wm.is_external,
                p.package_key,
                p.name AS package_name,
                COUNT(DISTINCT f.path) AS file_count,
                COUNT(n.id) AS symbol_count
            FROM workspace_modules wm
            JOIN packages p ON p.id = wm.package_id
            LEFT JOIN files f ON f.workspace_module_id = wm.id
            LEFT JOIN nodes n ON n.file = f.path
            GROUP BY wm.id
        `);
        this._packageEdges = this.db.prepare(`
            SELECT
                pe.source_file,
                pe.target_file,
                pe.import_source,
                pe.resolution,
                pe.is_reexport,
                sm.module_key AS source_module_key,
                sm.name AS source_module_name,
                sp.package_key AS source_package_key,
                sp.name AS source_package_name,
                tm.module_key AS target_module_key,
                tm.name AS target_module_name,
                tp.package_key AS target_package_key,
                tp.name AS target_package_name
            FROM package_edges pe
            JOIN workspace_modules sm ON sm.id = pe.source_module_id
            JOIN packages sp ON sp.id = pe.source_package_id
            LEFT JOIN workspace_modules tm ON tm.id = pe.target_module_id
            LEFT JOIN packages tp ON tp.id = pe.target_package_id
            ORDER BY pe.source_file, pe.import_source
        `);

        this._insertNode = this.db.prepare(`
            INSERT INTO nodes (
                name, qualified_name, workspace_qualified_name, kind, language, file,
                package_id, workspace_module_id, line_start, line_end, column_start, column_end, parent_id, signature
            )
            VALUES (
                @name, @qualified_name, @workspace_qualified_name, @kind, @language, @file,
                @package_id, @workspace_module_id, @line_start, @line_end, @column_start, @column_end, @parent_id, @signature
            )
        `);

        this._insertEdge = this.db.prepare(`
            INSERT INTO edges (source_id, target_id, layer, kind, confidence, origin, evidence_json, file, line, edge_hash)
            VALUES (@source_id, @target_id, @layer, @kind, @confidence, @origin, @evidence_json, @file, @line, @edge_hash)
        `);
        this._clearEdgesByOrigin = this.db.prepare("DELETE FROM edges WHERE origin = ?");
        this._clearEdgesByLayer = this.db.prepare("DELETE FROM edges WHERE layer = ?");
        this._clearNodesByKind = this.db.prepare("DELETE FROM nodes WHERE kind = ?");
        this._upsertProviderRun = this.db.prepare(`
            INSERT INTO provider_runs (provider, language, status, version, detail, indexed_at)
            VALUES (@provider, @language, @status, @version, @detail, CURRENT_TIMESTAMP)
            ON CONFLICT(provider, language) DO UPDATE SET
                status = excluded.status,
                version = excluded.version,
                detail = excluded.detail,
                indexed_at = CURRENT_TIMESTAMP
        `);
        this._providerRunByLanguage = this.db.prepare(
            "SELECT provider, language, status, version, detail, indexed_at FROM provider_runs WHERE language = ? ORDER BY indexed_at DESC LIMIT 1"
        );
        this._preciseCandidateEdgesByLanguage = this.db.prepare(`
            SELECT
                e.id,
                e.source_id,
                e.target_id,
                e.layer,
                e.kind,
                e.confidence,
                e.origin,
                e.evidence_json,
                e.file,
                e.line,
                source.language AS source_language,
                source.name AS source_name,
                source.file AS source_file,
                source.line_start AS source_line_start,
                source.kind AS source_kind,
                source.workspace_qualified_name AS source_workspace_qualified_name,
                target.language AS target_language,
                target.name AS target_name,
                target.file AS target_file,
                target.line_start AS target_line_start,
                target.kind AS target_kind,
                target.workspace_qualified_name AS target_workspace_qualified_name
            FROM edges e
            JOIN nodes source ON source.id = e.source_id
            JOIN nodes target ON target.id = e.target_id
            WHERE source.language = ?
              AND e.layer = 'symbol'
              AND e.kind IN ('imports', 'calls', 'ref_read', 'ref_type')
              AND e.origin NOT LIKE 'precise_%'
            ORDER BY e.file, e.line, e.id
        `);

        this._searchFts = this.db.prepare(`
            SELECT
                n.id,
                n.name,
                n.qualified_name,
                n.workspace_qualified_name,
                n.kind,
                n.language,
                n.file,
                n.line_start,
                n.line_end,
                n.signature,
                n.is_exported,
                n.is_default_export,
                n.package_id,
                n.workspace_module_id
            FROM nodes_fts fts
            JOIN nodes n ON n.id = fts.rowid
            WHERE nodes_fts MATCH ?
            ORDER BY rank
            LIMIT ?
        `);

        this._findByName = this.db.prepare(
            `SELECT ${NODE_SELECT_COLUMNS} FROM nodes WHERE name = ?`
        );

        this._findByQualified = this.db.prepare(
            `SELECT ${NODE_SELECT_COLUMNS} FROM nodes WHERE qualified_name = ?`
        );

        this._findByWorkspaceQualified = this.db.prepare(
            `SELECT ${NODE_SELECT_COLUMNS} FROM nodes WHERE workspace_qualified_name = ?`
        );

        this._getNodeById = this.db.prepare(
            `SELECT ${NODE_SELECT_COLUMNS} FROM nodes WHERE id = ?`
        );

        this._nodesByFile = this.db.prepare(
            `SELECT ${NODE_SELECT_COLUMNS} FROM nodes WHERE file = ? ORDER BY line_start, column_start`
        );

        this._fileOwnership = this.db.prepare(`
            SELECT
                f.package_id,
                f.workspace_module_id,
                p.package_key,
                p.name AS package_name,
                p.root_path AS package_root_path,
                wm.module_key,
                wm.name AS module_name,
                wm.root_path AS module_root_path
            FROM files f
            LEFT JOIN packages p ON p.id = f.package_id
            LEFT JOIN workspace_modules wm ON wm.id = f.workspace_module_id
            WHERE f.path = ?
        `);

        this._edgesFrom = this.db.prepare(
            "SELECT e.*, n.name as target_name, n.kind as target_kind, n.file as target_file, n.line_start as target_line, n.qualified_name as target_qualified_name, n.language as target_language FROM edges e JOIN nodes n ON n.id = e.target_id WHERE e.source_id = ?"
        );

        this._edgesTo = this.db.prepare(
            "SELECT e.*, n.name as source_name, n.kind as source_kind, n.file as source_file, n.line_start as source_line, n.qualified_name as source_qualified_name, n.language as source_language FROM edges e JOIN nodes n ON n.id = e.source_id WHERE e.target_id = ?"
        );

        // --- Clone detection statements ---

        this._insertCloneBlock = this.db.prepare(
            "INSERT OR REPLACE INTO clone_blocks (node_id, raw_hash, norm_hash, fingerprint, stmt_count, token_count) VALUES (@node_id, @raw_hash, @norm_hash, @fingerprint, @stmt_count, @token_count)"
        );

        this._insertLshBand = this.db.prepare(
            "INSERT OR REPLACE INTO clone_lsh (band_id, bucket_hash, node_id) VALUES (@band_id, @bucket_hash, @node_id)"
        );

        this._lshCandidates = this.db.prepare(
            "SELECT DISTINCT cl.node_id FROM clone_lsh cl WHERE cl.band_id = ? AND cl.bucket_hash = ? AND cl.node_id != ?"
        );

        this._cloneBlockById = this.db.prepare(`
            SELECT cb.node_id, cb.raw_hash, cb.norm_hash, cb.fingerprint, cb.stmt_count, cb.token_count,
                   n.name, n.kind, n.file, n.line_start, n.line_end, n.qualified_name, n.signature
            FROM clone_blocks cb
            JOIN nodes n ON n.id = cb.node_id
            WHERE cb.node_id = ?
        `);

        this._allCloneBlocks = this.db.prepare(`
            SELECT cb.node_id, cb.raw_hash, cb.norm_hash, cb.fingerprint, cb.stmt_count, cb.token_count,
                   n.name, n.kind, n.file, n.line_start, n.line_end, n.qualified_name, n.signature
            FROM clone_blocks cb
            JOIN nodes n ON n.id = cb.node_id
            WHERE cb.stmt_count >= ?
        `);

        // --- Module edge statements ---

        this._insertModuleEdge = this.db.prepare(
            "INSERT INTO module_edges (source_file, target_file, line, is_side_effect, is_dynamic, is_reexport) VALUES (@source_file, @target_file, @line, @is_side_effect, @is_dynamic, @is_reexport)"
        );

        this._clearModuleEdges = this.db.prepare("DELETE FROM module_edges WHERE source_file = ?");

        this._markExported = this.db.prepare("UPDATE nodes SET is_exported = 1 WHERE id = ?");
        this._markDefaultExport = this.db.prepare("UPDATE nodes SET is_exported = 1, is_default_export = 1 WHERE id = ?");

        this._moduleEdgesBySource = this.db.prepare("SELECT * FROM module_edges WHERE source_file = ?");
        this._moduleEdgesByTarget = this.db.prepare("SELECT * FROM module_edges WHERE target_file = ?");
        this._allModuleEdges = this.db.prepare("SELECT DISTINCT source_file, target_file FROM module_edges");
        this._clearModuleLayerEdges = this.db.prepare("DELETE FROM edges WHERE layer = 'module'");

        this._insertFlowSummary = this.db.prepare(
            "INSERT OR REPLACE INTO flow_summaries (owner_id, kind, source_name, target_name, related_symbol_id, file, line, confidence, summary_hash) VALUES (@owner_id, @kind, @source_name, @target_name, @related_symbol_id, @file, @line, @confidence, @summary_hash)"
        );
        this._flowSummariesByOwner = this.db.prepare(
            `SELECT fs.*, n.name AS related_name, n.kind AS related_kind, n.file AS related_file, n.line_start AS related_line, n.qualified_name AS related_qualified_name, n.language AS related_language
             FROM flow_summaries fs
             LEFT JOIN nodes n ON n.id = fs.related_symbol_id
             WHERE fs.owner_id = ?
             ORDER BY fs.line, fs.id`
        );
        this._flowSummariesByRelated = this.db.prepare(
            `SELECT fs.*, owner.name AS owner_name, owner.kind AS owner_kind, owner.file AS owner_file, owner.line_start AS owner_line, owner.qualified_name AS owner_qualified_name, owner.language AS owner_language
             FROM flow_summaries fs
             JOIN nodes owner ON owner.id = fs.owner_id
             WHERE fs.related_symbol_id = ?
             ORDER BY fs.line, fs.id`
        );
        this._insertFlowFact = this.db.prepare(
            `INSERT OR REPLACE INTO flow_facts (
                source_symbol_id, source_anchor_kind, source_anchor_name, source_access_path_json,
                target_symbol_id, target_anchor_kind, target_anchor_name, target_access_path_json,
                flow_kind, file, line, confidence, origin, evidence_json, fact_hash
            ) VALUES (
                @source_symbol_id, @source_anchor_kind, @source_anchor_name, @source_access_path_json,
                @target_symbol_id, @target_anchor_kind, @target_anchor_name, @target_access_path_json,
                @flow_kind, @file, @line, @confidence, @origin, @evidence_json, @fact_hash
            )`
        );
        this._flowFactsBySourceSymbol = this.db.prepare(
            `SELECT ff.*,
                    src.name AS source_symbol_name,
                    src.kind AS source_symbol_kind,
                    src.file AS source_symbol_file,
                    src.line_start AS source_symbol_line,
                    src.qualified_name AS source_symbol_qualified_name,
                    src.language AS source_symbol_language,
                    tgt.name AS target_symbol_name,
                    tgt.kind AS target_symbol_kind,
                    tgt.file AS target_symbol_file,
                    tgt.line_start AS target_symbol_line,
                    tgt.qualified_name AS target_symbol_qualified_name,
                    tgt.language AS target_symbol_language
             FROM flow_facts ff
             JOIN nodes src ON src.id = ff.source_symbol_id
             JOIN nodes tgt ON tgt.id = ff.target_symbol_id
             WHERE ff.source_symbol_id = ?
             ORDER BY ff.line, ff.id`
        );
        this._flowFactsByTargetSymbol = this.db.prepare(
            `SELECT ff.*,
                    src.name AS source_symbol_name,
                    src.kind AS source_symbol_kind,
                    src.file AS source_symbol_file,
                    src.line_start AS source_symbol_line,
                    src.qualified_name AS source_symbol_qualified_name,
                    src.language AS source_symbol_language,
                    tgt.name AS target_symbol_name,
                    tgt.kind AS target_symbol_kind,
                    tgt.file AS target_symbol_file,
                    tgt.line_start AS target_symbol_line,
                    tgt.qualified_name AS target_symbol_qualified_name,
                    tgt.language AS target_symbol_language
             FROM flow_facts ff
             JOIN nodes src ON src.id = ff.source_symbol_id
             JOIN nodes tgt ON tgt.id = ff.target_symbol_id
             WHERE ff.target_symbol_id = ?
             ORDER BY ff.line, ff.id`
        );

        // --- Unused export detection statements ---

        this._exportedNodes = this.db.prepare(
            "SELECT id, name, kind, file, line_start FROM nodes WHERE is_exported = 1"
        );

        this._importEdgesTo = this.db.prepare(
            "SELECT COUNT(*) as c FROM edges WHERE target_id = ? AND kind = 'imports'"
        );

        this._importEdgeSources = this.db.prepare(
            "SELECT DISTINCT n.file FROM edges e JOIN nodes n ON n.id = e.source_id WHERE e.target_id = ? AND e.kind = 'imports'"
        );

        this._exactImportEdgesTo = this.db.prepare(
            "SELECT COUNT(*) as c FROM edges WHERE target_id = ? AND kind = 'imports' AND confidence = 'exact'"
        );
        this._namespaceImportEdgesTo = this.db.prepare(
            "SELECT COUNT(*) as c FROM edges WHERE target_id = ? AND kind = 'imports' AND confidence = 'namespace'"
        );
        this._reexportSourcesTo = this.db.prepare(
            "SELECT source_id FROM edges WHERE target_id = ? AND kind = 'reexports'"
        );
        this._moduleEdgeExists = this.db.prepare(
            "SELECT 1 FROM module_edges WHERE source_file = ? AND target_file = ? LIMIT 1"
        );

        this._findReferences = this.db.prepare(`
            SELECT e.kind, e.line, e.file, e.confidence, e.origin, e.evidence_json,
                   n.id as source_id, n.name, n.kind as node_kind, n.file as node_file, n.line_start, n.qualified_name as source_qualified_name
            FROM edges e
            JOIN nodes n ON n.id = e.source_id
            WHERE e.target_id = ?
            ORDER BY e.kind, e.file, e.line
        `);
    }

    // --- File operations ---

    upsertFile(path, mtime, hash, nodeCount, ownership = {}) {
        this._insertFile.run(
            path,
            mtime,
            hash,
            nodeCount,
            ownership.package_id ?? null,
            ownership.workspace_module_id ?? null,
        );
    }

    getFile(path) {
        return this._getFile.get(path);
    }

    deleteFile(path) {
        this._deleteFile.run(path);
    }

    allFilePaths() {
        return this._allFiles.all().map(r => r.path);
    }

    ensurePackage(pkg) {
        const existing = this._getPackageByKey.get(pkg.package_key);
        if (existing) return existing;
        const normalized = { is_external: 0, ...pkg };
        this._insertPackage.run(normalized);
        return this._getPackageByKey.get(normalized.package_key);
    }

    ensureWorkspaceModule(mod) {
        const existing = this._getWorkspaceModuleByKey.get(mod.module_key);
        if (existing) return existing;
        const normalized = { is_external: 0, ...mod };
        this._insertWorkspaceModule.run(normalized);
        return this._getWorkspaceModuleByKey.get(normalized.module_key);
    }

    externalModuleFile(source) {
        return `${EXTERNAL_FILE_PREFIX}${source}`;
    }

    // --- Node operations ---

    insertNode(node) {
        const ownership = node.file ? this.describeFileOwnership(node.file) : null;
        const normalized = {
            name: node.name,
            qualified_name: node.qualified_name ?? null,
            workspace_qualified_name: node.workspace_qualified_name
                ?? buildWorkspaceQualifiedName(node, ownership),
            kind: node.kind,
            language: node.language,
            file: node.file,
            package_id: node.package_id ?? ownership?.package_id ?? null,
            workspace_module_id: node.workspace_module_id ?? ownership?.workspace_module_id ?? null,
            line_start: node.line_start ?? null,
            line_end: node.line_end ?? node.line_start ?? null,
            column_start: node.column_start ?? null,
            column_end: node.column_end ?? null,
            parent_id: node.parent_id ?? null,
            signature: node.signature ?? null,
        };
        const result = this._insertNode.run(normalized);
        return result.lastInsertRowid;
    }

    ensureExternalModuleNode(source, language = "external") {
        const filePath = this.externalModuleFile(source);
        if (!this.getFile(filePath)) {
            this._insertFile.run(filePath, 0, `external:${source}`, 1, null, null);
        }
        const qualifiedName = `${filePath}:module`;
        const existing = this._findByQualified.get(qualifiedName);
        if (existing) return existing;
        const id = this.insertNode({
            name: source,
            qualified_name: qualifiedName,
            kind: "external_module",
            language,
            file: filePath,
            line_start: 1,
            line_end: 1,
            parent_id: null,
            signature: null,
        });
        return this.getNodeById(id);
    }

    ensureExternalSymbolNode(source, symbolName, language = "external") {
        const filePath = this.externalModuleFile(source);
        const moduleNode = this.ensureExternalModuleNode(source, language);
        const safeName = symbolName || "unknown";
        const qualifiedName = `${filePath}:symbol:${safeName}`;
        const existing = this._findByQualified.get(qualifiedName);
        if (existing) return existing;
        const id = this.insertNode({
            name: safeName,
            qualified_name: qualifiedName,
            kind: "external_symbol",
            language,
            file: filePath,
            line_start: 1,
            line_end: 1,
            parent_id: moduleNode.id,
            signature: null,
        });
        return this.getNodeById(id);
    }

    nodesByFile(filePath) {
        return this._nodesByFile.all(filePath);
    }

    findByName(name) {
        return this._findByName.all(name);
    }

    findByQualified(qualifiedName) {
        return this._findByQualified.all(qualifiedName);
    }

    findByWorkspaceQualified(workspaceQualifiedName) {
        return this._findByWorkspaceQualified.all(workspaceQualifiedName);
    }

    getNodeById(id) {
        return this._getNodeById.get(id);
    }

    describeFileOwnership(filePath) {
        return this._fileOwnership.get(filePath) || null;
    }

    // --- Edge operations ---

    insertEdge(edge) {
        const normalized = {
            layer: "syntax",
            confidence: "exact",
            origin: "parsed",
            evidence_json: null,
            line: null,
            ...edge,
        };
        normalized.edge_hash = createHash("md5")
            .update([
                normalized.source_id,
                normalized.target_id,
                normalized.layer,
                normalized.kind,
                normalized.confidence,
                normalized.origin,
                normalized.file,
                normalized.line ?? "",
            ].join("|"))
            .digest("hex")
            .slice(0, 16);
        this._insertEdge.run(normalized);
    }

    clearEdgesByOrigin(origin) {
        this._clearEdgesByOrigin.run(origin);
    }

    clearEdgesByLayer(layer) {
        this._clearEdgesByLayer.run(layer);
    }

    clearNodesByKinds(kinds) {
        for (const kind of kinds || []) {
            this._clearNodesByKind.run(kind);
        }
    }

    upsertProviderRun(run) {
        this._upsertProviderRun.run({
            provider: run.provider,
            language: run.language,
            status: run.status,
            version: run.version ?? null,
            detail: run.detail ?? null,
        });
    }

    providerStatusForLanguage(language) {
        return normalizeProviderRun(this._providerRunByLanguage.get(language) || null, language);
    }

    preciseCandidateEdges(language) {
        return this._preciseCandidateEdgesByLanguage.all(language);
    }

    edgesFrom(nodeId) {
        return this._edgesFrom.all(nodeId);
    }

    edgesTo(nodeId) {
        return this._edgesTo.all(nodeId);
    }

    // --- Clone detection operations ---

    insertCloneBlock({node_id, raw_hash, norm_hash, fingerprint, stmt_count, token_count}) {
        this._insertCloneBlock.run({node_id, raw_hash, norm_hash, fingerprint, stmt_count, token_count});
    }

    insertLshBand({band_id, bucket_hash, node_id}) {
        this._insertLshBand.run({band_id, bucket_hash, node_id});
    }

    getLshCandidates(bandId, bucketHash, excludeNodeId) {
        return this._lshCandidates.all(bandId, bucketHash, excludeNodeId).map(r => r.node_id);
    }

    getCloneBlockById(nodeId) {
        return this._cloneBlockById.get(nodeId);
    }

    getAllCloneBlocks(minStmts) {
        return this._allCloneBlocks.all(minStmts);
    }

    insertFlowSummary(summary) {
        const normalized = {
            related_symbol_id: null,
            line: null,
            confidence: "exact",
            ...summary,
        };
        normalized.summary_hash = createHash("md5")
            .update([
                normalized.owner_id,
                normalized.kind,
                normalized.source_name,
                normalized.target_name,
                normalized.related_symbol_id ?? "",
                normalized.file,
                normalized.line ?? "",
                normalized.confidence,
            ].join("|"))
            .digest("hex")
            .slice(0, 16);
        this._insertFlowSummary.run(normalized);
    }

    flowSummariesByOwner(ownerId) {
        return this._flowSummariesByOwner.all(ownerId);
    }

    flowSummariesByRelatedSymbol(nodeId) {
        return this._flowSummariesByRelated.all(nodeId);
    }

    insertFlowFact(fact) {
        const sourceAnchor = normalizeAnchor(fact.source_anchor);
        const targetAnchor = normalizeAnchor(fact.target_anchor);
        if (!sourceAnchor || !targetAnchor) return;
        const normalized = {
            flow_kind: "value",
            line: null,
            confidence: "exact",
            origin: "parser_fact",
            evidence_json: null,
            ...fact,
            source_anchor_kind: sourceAnchor.kind,
            source_anchor_name: sourceAnchor.name || "",
            source_access_path_json: sourceAnchor.access_path ? JSON.stringify(sourceAnchor.access_path) : null,
            target_anchor_kind: targetAnchor.kind,
            target_anchor_name: targetAnchor.name || "",
            target_access_path_json: targetAnchor.access_path ? JSON.stringify(targetAnchor.access_path) : null,
        };
        normalized.fact_hash = createHash("md5")
            .update([
                normalized.source_symbol_id,
                normalized.source_anchor_kind,
                normalized.source_anchor_name,
                normalized.source_access_path_json || "",
                normalized.target_symbol_id,
                normalized.target_anchor_kind,
                normalized.target_anchor_name,
                normalized.target_access_path_json || "",
                normalized.flow_kind,
                normalized.file,
                normalized.line ?? "",
                normalized.confidence,
                normalized.origin,
            ].join("|"))
            .digest("hex")
            .slice(0, 16);
        this._insertFlowFact.run(normalized);
    }

    flowFactsBySourceSymbol(symbolId) {
        return this._flowFactsBySourceSymbol.all(symbolId);
    }

    flowFactsByTargetSymbol(symbolId) {
        return this._flowFactsByTargetSymbol.all(symbolId);
    }

    // --- Module edge operations ---

    insertModuleEdge(params) {
        this._insertModuleEdge.run(params);
    }

    clearPackageEdgesForFile(filePath) {
        this._clearPackageEdgesForFile.run(filePath);
    }

    insertPackageEdge(params) {
        this._insertPackageEdge.run(params);
    }

    clearModuleEdges(filePath) {
        this._clearModuleEdges.run(filePath);
    }

    markExported(nodeId) {
        this._markExported.run(nodeId);
    }

    markDefaultExport(nodeId) {
        this._markDefaultExport.run(nodeId);
    }

    cleanupOrphanModuleEdges() {
        this.db.exec("DELETE FROM module_edges WHERE target_file NOT IN (SELECT path FROM files)");
    }

    resetProjectGraph() {
        const tx = this.db.transaction(() => {
            this.db.exec(`
                DELETE FROM package_edges;
                DELETE FROM module_edges;
                DELETE FROM flow_facts;
                DELETE FROM flow_summaries;
                DELETE FROM clone_lsh;
                DELETE FROM clone_blocks;
                DELETE FROM edges;
                DELETE FROM nodes;
                INSERT INTO nodes_fts(nodes_fts) VALUES('rebuild');
                DELETE FROM files;
                DELETE FROM workspace_modules;
                DELETE FROM packages;
                DELETE FROM provider_runs;
            `);
        });
        tx();
    }

    moduleEdgesBySource(file) {
        return this._moduleEdgesBySource.all(file);
    }

    moduleEdgesByTarget(file) {
        return this._moduleEdgesByTarget.all(file);
    }

    allModuleEdges() {
        return this._allModuleEdges.all();
    }

    workspaceModuleRows() {
        return this._workspaceModuleRows.all();
    }

    packageEdgeRows() {
        return this._packageEdges.all();
    }

    rebuildAllModuleLayerEdges() {
        this._clearModuleLayerEdges.run();
        const rows = this.db.prepare(`
            SELECT me.source_file, me.target_file, me.line, me.is_reexport
            FROM module_edges me
            ORDER BY me.source_file, me.target_file, me.line
        `).all();

        for (const row of rows) {
            const sourceNode = this._findByQualified.get(`${row.source_file}:module`);
            const targetNode = this._findByQualified.get(`${row.target_file}:module`);
            if (!sourceNode || !targetNode) continue;
            const isExternal = row.target_file.startsWith(EXTERNAL_FILE_PREFIX);

            this.insertEdge({
                source_id: sourceNode.id,
                target_id: targetNode.id,
                layer: "module",
                kind: row.is_reexport
                    ? (isExternal ? "reexports_external_module" : "reexports_module")
                    : (isExternal ? "depends_on_external" : "depends_on"),
                confidence: isExternal ? "low" : "exact",
                origin: isExternal ? "unresolved" : "resolved",
                file: row.source_file,
                line: row.line ?? 0,
            });
        }
    }

    allLayerEdges(layer, kind = null) {
        if (kind) {
            return this.db.prepare(`
                SELECT e.*
                FROM edges e
                WHERE e.layer = ? AND e.kind = ?
                ORDER BY e.file, e.line, e.id
            `).all(layer, kind);
        }
        return this.db.prepare(`
            SELECT e.*
            FROM edges e
            WHERE e.layer = ?
            ORDER BY e.file, e.line, e.id
        `).all(layer);
    }

    // --- Unused export detection operations ---

    exportedNodes() {
        return this._exportedNodes.all();
    }

    importEdgeCount(nodeId) {
        return this._importEdgesTo.get(nodeId).c;
    }

    importEdgeSources(nodeId) {
        return this._importEdgeSources.all(nodeId);
    }

    exactImportEdgeCount(nodeId) {
        return this._exactImportEdgesTo.get(nodeId).c;
    }

    namespaceImportEdgeCount(nodeId) {
        return this._namespaceImportEdgesTo.get(nodeId).c;
    }

    reexportSourcesTo(nodeId) {
        return this._reexportSourcesTo.all(nodeId);
    }

    moduleEdgeExists(sourceFile, targetFile) {
        return !!this._moduleEdgeExists.get(sourceFile, targetFile);
    }

    findReferences(nodeId) {
        return this._findReferences.all(nodeId);
    }

    frameworkIncomingEdges(nodeId) {
        return this.db.prepare(`
            SELECT e.kind, e.line, e.file, e.confidence, e.origin, e.evidence_json,
                   n.id as source_id, n.name, n.kind as node_kind, n.file as node_file, n.line_start, n.qualified_name as source_qualified_name
            FROM edges e
            JOIN nodes n ON n.id = e.source_id
            WHERE e.target_id = ?
              AND e.layer = 'framework'
            ORDER BY e.kind, e.file, e.line
        `).all(nodeId);
    }

    // --- Bulk operations (transaction) ---

    clearFile(filePath) {
        // CASCADE: deleting file removes all nodes + edges
        this._deleteFile.run(filePath);
    }

    bulkInsert(filePath, mtime, hash, language, definitions, imports, ownership = null) {
        const tx = this.db.transaction(() => {
            // Clear old data for this file
            this._deleteFile.run(filePath);

            const allNodes = [...definitions, ...imports];
            this._insertFile.run(
                filePath,
                mtime,
                hash,
                allNodes.length,
                ownership?.package_id ?? null,
                ownership?.workspace_module_id ?? null,
            );

            const nodeIds = new Map();
            const classIndex = new Map(); // className -> nodeId

            for (const def of definitions) {
                const id = this.insertNode({
                    name: def.name,
                    qualified_name: def.parent
                        ? `${filePath}:${def.parent}.${def.name}`
                        : `${filePath}:${def.name}`,
                    kind: def.kind,
                    language,
                    file: filePath,
                    line_start: def.line_start,
                    line_end: def.line_end,
                    column_start: def.column_start ?? null,
                    column_end: def.column_end ?? null,
                    parent_id: def.parent ? (classIndex.get(def.parent) || null) : null,
                    signature: def.signature || null,
                });
                nodeIds.set(def.key, id);

                // Index class definitions for fast parent lookup
                // Null on collision (same-name classes in one file = ambiguous parent)
                if (def.kind === "class") {
                    if (classIndex.has(def.name)) {
                        classIndex.set(def.name, null);
                    } else {
                        classIndex.set(def.name, id);
                    }
                }
            }

            for (const imp of imports) {
                const id = this.insertNode({
                    name: imp.name,
                    qualified_name: `${filePath}:import:${imp.source}:${imp.line}`,
                    kind: "import",
                    language,
                    file: filePath,
                    line_start: imp.line,
                    line_end: imp.line,
                    column_start: imp.column_start ?? null,
                    column_end: imp.column_end ?? null,
                    parent_id: null,
                    signature: null,
                });
                nodeIds.set(`import:${imp.source}:${imp.line}`, id);
            }

            return nodeIds;
        });

        return tx();
    }

    // --- Query: Search symbols (FTS5) ---

    search(query, { kind, limit = 20 } = {}) {
        let ftsQuery = query;
        if (kind) ftsQuery = `${query} AND kind:${kind}`;

        try {
            return this._searchFts.all(ftsQuery, limit);
        } catch {
            // Fallback to LIKE if FTS query syntax fails
            const likeQuery = `%${query}%`;
            const stmt = kind
                ? this.db.prepare("SELECT * FROM nodes WHERE name LIKE ? AND kind = ? LIMIT ?")
                : this.db.prepare("SELECT * FROM nodes WHERE name LIKE ? LIMIT ?");
            return kind ? stmt.all(likeQuery, kind, limit) : stmt.all(likeQuery, limit);
        }
    }

    // --- Query: Architecture report data ---

    architectureReportData(scopePath) {
        // workspace-first architecture view
        const normalizedScope = normalizeScopePath(scopePath);
        const allNodes = scopePath
            ? this.db.prepare("SELECT * FROM nodes WHERE file LIKE ? || '%' ESCAPE '\\'")
                .all(scopePath.replace(/[%_\\]/g, m => "\\" + m))
            : this.db.prepare("SELECT * FROM nodes").all();

        void allNodes;
        const kindRows = this.db.prepare(`
            SELECT
                wm.module_key,
                n.kind,
                COUNT(*) AS count
            FROM workspace_modules wm
            LEFT JOIN files f ON f.workspace_module_id = wm.id
            LEFT JOIN nodes n ON n.file = f.path
            GROUP BY wm.module_key, n.kind
        `).all();
        const kindSummaryByModule = new Map();
        for (const row of kindRows) {
            if (!row.kind) continue;
            const summary = kindSummaryByModule.get(row.module_key) || {};
            summary[row.kind] = row.count;
            kindSummaryByModule.set(row.module_key, summary);
        }

        const modules = this.workspaceModuleRows()
            .filter(row => moduleMatchesScope(row.root_path, normalizedScope))
            .map(row => ({
                module_key: row.module_key,
                module_name: row.name,
                module_root_path: row.root_path,
                language: row.language,
                package_key: row.package_key,
                package_name: row.package_name,
                file_count: row.file_count,
                symbol_count: row.symbol_count,
                is_external: Boolean(row.is_external),
                kinds: kindSummaryByModule.get(row.module_key) || {},
            }));

        const allowedModules = new Set(modules.map(row => row.module_key));
        const hotspots = this.db.prepare(`
            SELECT
                n.file,
                n.name,
                n.kind,
                n.line_start,
                COALESCE(cb.stmt_count, MAX(n.line_end - n.line_start + 1, 1)) AS complexity,
                COUNT(DISTINCT e.source_id) AS callers,
                wm.module_key,
                wm.name AS module_name,
                wm.root_path AS module_root_path,
                p.package_key,
                p.name AS package_name
            FROM nodes n
            LEFT JOIN clone_blocks cb ON cb.node_id = n.id
            LEFT JOIN edges e ON e.target_id = n.id AND e.kind = 'calls'
            LEFT JOIN files f ON f.path = n.file
            LEFT JOIN workspace_modules wm ON wm.id = f.workspace_module_id
            LEFT JOIN packages p ON p.id = f.package_id
            WHERE n.kind IN ('function', 'method')
            GROUP BY n.id
            HAVING callers > 0
            ORDER BY complexity * callers DESC
            LIMIT 50
        `).all().filter(row => !normalizedScope || moduleMatchesScope(row.module_root_path, normalizedScope));

        const grouped = new Map();
        for (const edge of this.packageEdgeRows()) {
            const touchesScopedModule = !normalizedScope
                || allowedModules.has(edge.source_module_key)
                || (edge.target_module_key && allowedModules.has(edge.target_module_key));
            if (!touchesScopedModule) continue;
            if (edge.source_module_key === edge.target_module_key) continue;

            const targetKey = edge.target_module_key || `unresolved:${edge.import_source}`;
            const key = `${edge.source_module_key}->${targetKey}`;
            const existing = grouped.get(key) || {
                source_module_key: edge.source_module_key,
                source_module_name: edge.source_module_name,
                source_package_key: edge.source_package_key,
                source_package_name: edge.source_package_name,
                target_module_key: edge.target_module_key,
                target_module_name: edge.target_module_name || edge.import_source,
                target_package_key: edge.target_package_key,
                target_package_name: edge.target_package_name || null,
                edge_count: 0,
                reexport_count: 0,
                resolutions: {},
            };
            existing.edge_count++;
            if (edge.is_reexport) existing.reexport_count++;
            existing.resolutions[edge.resolution] = (existing.resolutions[edge.resolution] || 0) + 1;
            grouped.set(key, existing);
        }

        const crossEdges = [...grouped.values()]
            .sort((a, b) => b.edge_count - a.edge_count || a.source_module_key.localeCompare(b.source_module_key));

        const frameworkRows = this.db.prepare(`
            SELECT kind, origin, COUNT(*) AS count
            FROM edges
            WHERE layer = 'framework'
            GROUP BY kind, origin
            ORDER BY count DESC, kind, origin
        `).all();

        return { modules, hotspots, crossEdges, frameworkRows };
    }

    // --- Query: Hotspots (complexity × callers) ---

    hotspots({ minCallers = 2, minComplexity = 15, limit = 20, scopePath } = {}) {
        const scopeFilter = scopePath
            ? "AND n.file LIKE ? || '%' ESCAPE '\\'"
            : "";
        const sql = `
            SELECT n.file, n.name, n.kind, n.line_start, n.line_end,
                   COALESCE(cb.stmt_count, MAX(n.line_end - n.line_start + 1, 1)) AS complexity,
                   COUNT(DISTINCT e.source_id) AS callers,
                   COALESCE(cb.stmt_count, MAX(n.line_end - n.line_start + 1, 1)) * COUNT(DISTINCT e.source_id) AS risk,
                   cb.stmt_count AS raw_stmt_count
            FROM nodes n
            LEFT JOIN clone_blocks cb ON cb.node_id = n.id
            LEFT JOIN edges e ON e.target_id = n.id AND e.kind = 'calls'
            WHERE n.kind IN ('function', 'method')
            ${scopeFilter}
            GROUP BY n.id
            HAVING callers >= ? AND complexity >= ?
            ORDER BY risk DESC
            LIMIT ?
        `;
        const params = scopePath
            ? [scopePath.replace(/[%_\\]/g, m => "\\" + m), minCallers, minComplexity, limit]
            : [minCallers, minComplexity, limit];
        const rows = this.db.prepare(sql).all(...params);
        return rows.map(r => ({
            file: r.file,
            name: r.name,
            kind: r.kind,
            line_start: r.line_start,
            line_end: r.line_end,
            complexity: r.complexity,
            callers: r.callers,
            risk: r.risk,
            complexity_source: r.raw_stmt_count != null ? "stmt_count" : "line_span_fallback",
        }));
    }

    moduleMetricRows({ scopePath, sort = "instability", minCoupling = 2 } = {}) {
        const normalizedScope = normalizeScopePath(scopePath);
        const modules = this.workspaceModuleRows()
            .filter(row => moduleMatchesScope(row.root_path, normalizedScope));
        const allowedModules = new Set(modules.map(row => row.module_key));
        const metrics = new Map();
        const incoming = new Map();
        const outgoing = new Map();
        const unresolvedOutgoing = new Map();

        for (const edge of this.packageEdgeRows()) {
            const touchesScopedModule = !normalizedScope
                || allowedModules.has(edge.source_module_key)
                || (edge.target_module_key && allowedModules.has(edge.target_module_key));
            if (!touchesScopedModule) continue;

            if (!edge.target_module_key) {
                unresolvedOutgoing.set(
                    edge.source_module_key,
                    (unresolvedOutgoing.get(edge.source_module_key) || 0) + 1,
                );
                continue;
            }
            if (edge.source_module_key === edge.target_module_key) continue;
            if (!outgoing.has(edge.source_module_key)) outgoing.set(edge.source_module_key, new Set());
            if (!incoming.has(edge.target_module_key)) incoming.set(edge.target_module_key, new Set());
            outgoing.get(edge.source_module_key).add(edge.target_module_key);
            incoming.get(edge.target_module_key).add(edge.source_module_key);
        }

        for (const mod of modules) {
            metrics.set(mod.module_key, {
                module_key: mod.module_key,
                module_name: mod.name,
                module_root_path: mod.root_path,
                package_key: mod.package_key,
                package_name: mod.package_name,
                language: mod.language,
                is_external: Boolean(mod.is_external),
                ca: incoming.get(mod.module_key)?.size || 0,
                ce: outgoing.get(mod.module_key)?.size || 0,
                unresolved_outgoing: unresolvedOutgoing.get(mod.module_key) || 0,
            });
        }

        const result = [...metrics.values()]
            .map(m => ({
                ...m,
                instability: m.ca + m.ce > 0 ? m.ce / (m.ca + m.ce) : 0,
                total_coupling: m.ca + m.ce + m.unresolved_outgoing,
            }))
            .filter(m => m.total_coupling >= minCoupling);

        const sortFns = {
            instability: (a, b) => b.instability - a.instability || b.total_coupling - a.total_coupling,
            ca: (a, b) => b.ca - a.ca || b.total_coupling - a.total_coupling,
            ce: (a, b) => b.ce - a.ce || b.total_coupling - a.total_coupling,
            unresolved: (a, b) => b.unresolved_outgoing - a.unresolved_outgoing || b.total_coupling - a.total_coupling,
            coupling: (a, b) => b.total_coupling - a.total_coupling,
        };
        result.sort(sortFns[sort] || sortFns.instability);

        return result;
    }

    moduleGraphEdges() {
        return this.db.prepare(`
            SELECT
                e.kind,
                e.confidence,
                e.file,
                e.line,
                src.file AS source_file,
                tgt.file AS target_file
            FROM edges e
            JOIN nodes src ON src.id = e.source_id
            JOIN nodes tgt ON tgt.id = e.target_id
            WHERE e.layer = 'module'
              AND src.kind IN ('module', 'external_module')
              AND tgt.kind IN ('module', 'external_module')
            ORDER BY src.file, tgt.file, e.line, e.id
        `).all();
    }

    // --- Stats ---

    stats() {
        const files = this.db.prepare("SELECT COUNT(*) as count FROM files").get().count;
        const nodes = this.db.prepare("SELECT COUNT(*) as count FROM nodes").get().count;
        const edges = this.db.prepare("SELECT COUNT(*) as count FROM edges").get().count;
        return { files, nodes, edges };
    }

    indexedLanguages() {
        return this.db.prepare(`
            SELECT DISTINCT language
            FROM nodes
            WHERE language IS NOT NULL AND language != ''
            ORDER BY language
        `).all().map(row => row.language);
    }

    close() {
        clearEntryTimer(this._entry);
        if (this.db.open) this.db.close();
        this._entry?.registry?.delete(this.projectPath);
        this._entry = null;
    }
}

export function resolveStore(path) {
    if (path) {
        const abs = resolve(path);
        // 1. Exact match in memory
        const store = _queryStores.get(abs)?.store;
        if (store) return store;
        // 2. Prefix match: abs is subdirectory of indexed project
        for (const [key, entry] of _queryStores) {
            if (abs.startsWith(key + "/") || abs.startsWith(key + "\\")) {
                entry.store.touch();
                return entry.store;
            }
        }
        // 3. Auto-open persisted DB from disk for the exact path or its nearest parent project.
        const persistedRoot = resolvePersistedProjectRoot(abs);
        if (persistedRoot) return getStore(persistedRoot, { mode: "query" });
        // 4. Path-scoped lookups must never fall back to an unrelated in-memory store.
        return null;
    }
    return null;
}

function activeQueryStoreForPath(path) {
    if (!path) return null;
    const abs = resolve(path);
    const exact = _queryStores.get(abs)?.store;
    if (exact) return exact;
    for (const [key, entry] of _queryStores) {
        if (abs.startsWith(key + "/") || abs.startsWith(key + "\\")) return entry.store;
    }
    return null;
}

export function withResolvedStore(path, fn) {
    const existing = activeQueryStoreForPath(path);
    const store = resolveStore(path);
    if (!store) return fn(null);
    try {
        return fn(store);
    } finally {
        if (store.mode === "query" && !existing) {
            store.close();
        }
    }
}

export function hasOpenStore(projectPath, { mode = "write" } = {}) {
    const absPath = resolve(projectPath);
    const registry = mode === "query" ? _queryStores : _writeStores;
    return !!registry.get(absPath)?.store;
}

export function closeAllStores() {
    for (const entry of [..._queryStores.values(), ..._writeStores.values()]) {
        closeStoreEntry(entry);
    }
}

function moduleRelativeFilePath(filePath, moduleRootPath) {
    const normalizedFile = normalizeScopePath(filePath || "");
    const normalizedRoot = normalizeScopePath(moduleRootPath || ".");
    if (!normalizedRoot || normalizedRoot === ".") return normalizedFile;
    return normalizedFile.startsWith(`${normalizedRoot}/`)
        ? normalizedFile.slice(normalizedRoot.length + 1)
        : normalizedFile;
}

function buildWorkspaceQualifiedName(node, ownership) {
    if (!node) return null;
    if (node.workspace_qualified_name) return node.workspace_qualified_name;
    if (!ownership?.module_key) return node.qualified_name || null;
    const relFile = moduleRelativeFilePath(node.file, ownership.module_root_path);
    const localIdentity = node.qualified_name?.startsWith(`${node.file}:`)
        ? node.qualified_name.slice(node.file.length + 1)
        : (node.qualified_name || node.name);
    return `${ownership.module_key}::${relFile}::${localIdentity}`;
}

function serializeNode(store, node) {
    if (!node) return null;
    const ownership = node.file ? store.describeFileOwnership(node.file) : null;
    return {
        symbol_id: node.id,
        qualified_name: node.qualified_name || null,
        workspace_qualified_name: buildWorkspaceQualifiedName(node, ownership),
        display_name: displayName(node),
        name: node.name,
        kind: node.kind,
        language: node.language || null,
        file: node.file,
        line_start: node.line_start,
        line_end: node.line_end,
        signature: node.signature || null,
        is_exported: !!node.is_exported,
        is_default_export: !!node.is_default_export,
        package_id: node.package_id ?? ownership?.package_id ?? null,
        package_key: ownership?.package_key || null,
        package_name: ownership?.package_name || null,
        package_root_path: ownership?.package_root_path || null,
        workspace_module_id: node.workspace_module_id ?? ownership?.workspace_module_id ?? null,
        module_key: ownership?.module_key || null,
        module_name: ownership?.module_name || null,
        module_root_path: ownership?.module_root_path || null,
    };
}

function parseEvidence(evidenceJson) {
    if (!evidenceJson) return null;
    try {
        return JSON.parse(evidenceJson);
    } catch {
        return { raw: evidenceJson };
    }
}

function filterEdgesByConfidence(rows, minConfidence) {
    if (!minConfidence) return rows;
    return rows.filter(row => confidenceAtLeast(row.confidence, minConfidence));
}

function dedupeEdges(rows, directionKey) {
    return dedupeStrongest(rows, row => [
        directionKey === "incoming" ? row.source_id : row.target_id,
        directionKey === "incoming" ? row.target_id : row.source_id,
        row.kind,
        row.file,
        row.line ?? "",
    ].join("|"));
}

function dedupeReferenceRows(rows) {
    return dedupeStrongest(rows, row => [
        row.source_id,
        row.kind,
        row.file,
        row.line ?? "",
    ].join("|"));
}

function selectorError(code, message, recovery) {
    return { error: { code, message, recovery } };
}

const QUERY_PATH_RECOVERY = "Run index_project on the project root first; symbol/query tools then accept that root or a file/subdirectory inside it as path";

function selectorWarningsForNode(node) {
    if (!node) return [];
    if (node.kind === "import" || node.kind === "import_stmt") {
        return [
            "The selector resolved to an import usage, not a project-owned definition. find_references will show usages of that import node, not all downstream uses of the external symbol.",
        ];
    }
    return [];
}

function resolvedSelectorResult(query, node, reason, confidence = "exact") {
    return {
        query,
        node,
        reason,
        confidence,
        warnings: selectorWarningsForNode(node),
    };
}

function normalizeSelector(selector = {}) {
    const { symbol_id, workspace_qualified_name, qualified_name, name, file } = selector;
    const hasId = symbol_id !== undefined && symbol_id !== null;
    const hasWorkspaceQualified = typeof workspace_qualified_name === "string" && workspace_qualified_name.length > 0;
    const hasQualified = typeof qualified_name === "string" && qualified_name.length > 0;
    const hasNameFile = typeof name === "string" && name.length > 0 && typeof file === "string" && file.length > 0;
    const forms = [hasId, hasWorkspaceQualified, hasQualified, hasNameFile].filter(Boolean).length;
    if (forms !== 1) {
        return selectorError(
            "INVALID_SELECTOR",
            "Selector must provide exactly one of: symbol_id, workspace_qualified_name, qualified_name, or name+file",
            "Use find_symbols first to discover valid identifiers"
        );
    }
    if (hasId) return { kind: "symbol_id", value: Number(symbol_id), query: { symbol_id: Number(symbol_id) } };
    if (hasWorkspaceQualified) return { kind: "workspace_qualified_name", value: workspace_qualified_name, query: { workspace_qualified_name } };
    if (hasQualified) return { kind: "qualified_name", value: qualified_name, query: { qualified_name } };
    return { kind: "name_file", value: { name, file }, query: { name, file } };
}

function resolveSelector(store, selector = {}) {
    const normalized = normalizeSelector(selector);
    if (normalized.error) return normalized;

    if (normalized.kind === "symbol_id") {
        const node = store.getNodeById(normalized.value);
        if (!node) {
            return selectorError("SYMBOL_NOT_FOUND", `No symbol with id ${normalized.value}`, "Run find_symbols to find a valid symbol_id");
        }
        return resolvedSelectorResult(normalized.query, node, "resolved_by_symbol_id");
    }

    if (normalized.kind === "qualified_name") {
        const matches = store.findByQualified(normalized.value);
        if (matches.length === 0) {
            return selectorError("SYMBOL_NOT_FOUND", `No symbol with qualified_name '${normalized.value}'`, "Run find_symbols to inspect available qualified names");
        }
        if (matches.length > 1) {
            return {
                error: {
                    code: "AMBIGUOUS_SYMBOL",
                    message: `Multiple symbols matched qualified_name '${normalized.value}'`,
                    recovery: "Use symbol_id instead of qualified_name",
                    candidates: matches.map(node => serializeNode(store, node)),
                },
            };
        }
        return resolvedSelectorResult(normalized.query, matches[0], "resolved_by_qualified_name");
    }

    if (normalized.kind === "workspace_qualified_name") {
        const matches = store.findByWorkspaceQualified(normalized.value);
        if (matches.length === 0) {
            return selectorError("SYMBOL_NOT_FOUND", `No symbol with workspace_qualified_name '${normalized.value}'`, "Run find_symbols to inspect available workspace-qualified names");
        }
        if (matches.length > 1) {
            return {
                error: {
                    code: "AMBIGUOUS_SYMBOL",
                    message: `Multiple symbols matched workspace_qualified_name '${normalized.value}'`,
                    recovery: "Use symbol_id instead of workspace_qualified_name",
                    candidates: matches.map(node => serializeNode(store, node)),
                },
            };
        }
        return resolvedSelectorResult(normalized.query, matches[0], "resolved_by_workspace_qualified_name");
    }

    const { name, file } = normalized.value;
    const matches = store.findByName(name).filter(n =>
        n.file === file || n.file.endsWith(file) || n.file.endsWith(`/${file}`)
    );
    if (matches.length === 0) {
        return selectorError("SYMBOL_NOT_FOUND", `No symbol '${name}' found in '${file}'`, "Run find_symbols to inspect file paths and symbol names");
    }
    const semantic = matches.filter(n => n.kind !== "import");
    if (semantic.length > 1) {
        return {
            error: {
                code: "AMBIGUOUS_SYMBOL",
                message: `Multiple symbols named '${name}' matched file '${file}'`,
                recovery: "Use symbol_id or qualified_name",
                candidates: semantic.map(node => serializeNode(store, node)),
            },
        };
    }
    const node = semantic[0] || matches[0];
    return resolvedSelectorResult(normalized.query, node, "resolved_by_name_file");
}

function resolveOptionalSelector(store, selector = null) {
    if (!selector) return null;
    const values = [selector.symbol_id, selector.workspace_qualified_name, selector.qualified_name, selector.name, selector.file];
    if (values.every(value => value === undefined || value === null || value === "")) return null;
    return resolveSelector(store, selector);
}

function resolveFlowPoint(store, point, label) {
    if (!point || typeof point !== "object") {
        return selectorError("INVALID_FLOW_QUERY", `${label} must be an object with symbol and anchor`, "Provide source/sink as { symbol: selector, anchor: { kind, ... } }");
    }
    const symbol = resolveSelector(store, point.symbol || {});
    if (symbol.error) return symbol;
    const anchor = normalizeAnchor(point.anchor);
    if (!anchor) {
        return selectorError("INVALID_FLOW_ANCHOR", `${label}.anchor must include a valid kind/name/access_path`, "Use anchor kinds: param, local, return, property");
    }
    return {
        query: {
            symbol: symbol.query,
            anchor,
        },
        point: {
            symbol: symbol.node,
            anchor,
        },
    };
}

function collectReferenceRows(store, node, kind) {
    let refs = store.findReferences(node.id);
    const reexportProxies = store.reexportSourcesTo(node.id);
    for (const { source_id } of reexportProxies) {
        refs.push(...store.findReferences(source_id));
    }
    if (kind && kind !== "all") refs = refs.filter(r => r.kind === kind);
    return refs;
}

function parseAccessPath(value) {
    if (!value) return null;
    try {
        const parsed = JSON.parse(value);
        return Array.isArray(parsed) && parsed.length > 0 ? parsed : null;
    } catch {
        return null;
    }
}

function flowAnchorFromRow(prefix, row) {
    return {
        kind: row[`${prefix}_anchor_kind`],
        name: row[`${prefix}_anchor_name`] || null,
        access_path: parseAccessPath(row[`${prefix}_access_path_json`]),
    };
}

function serializeFlowSymbol(store, prefix, row) {
    return serializeNode(store, {
        id: row[`${prefix}_symbol_id`],
        qualified_name: row[`${prefix}_symbol_qualified_name`] || null,
        name: row[`${prefix}_symbol_name`],
        kind: row[`${prefix}_symbol_kind`],
        language: row[`${prefix}_symbol_language`] || null,
        file: row[`${prefix}_symbol_file`],
        line_start: row[`${prefix}_symbol_line`],
        line_end: row[`${prefix}_symbol_line`],
        signature: null,
        is_exported: 0,
        is_default_export: 0,
    });
}

function serializeFlowFact(store, row, direction = "forward") {
    return {
        layer: "flow",
        flow_kind: row.flow_kind,
        kind: parseEvidence(row.evidence_json)?.kind || "flow",
        confidence: row.confidence,
        origin: row.origin,
        file: row.file,
        line: row.line,
        direction,
        source_symbol: serializeFlowSymbol(store, "source", row),
        target_symbol: serializeFlowSymbol(store, "target", row),
        source_anchor: flowAnchorFromRow("source", row),
        target_anchor: flowAnchorFromRow("target", row),
        evidence: parseEvidence(row.evidence_json),
    };
}

function filterFlowFacts(rows, { flowKind = "value", minConfidence = null, symbolId = null, anchor = null, direction = "source" } = {}) {
    return rows.filter(row => {
        if (flowKind && flowKind !== "taint" && row.flow_kind !== flowKind) return false;
        if (minConfidence && !confidenceAtLeast(row.confidence, minConfidence)) return false;
        if (symbolId == null && !anchor) return true;
        const rowSymbolId = direction === "source" ? row.source_symbol_id : row.target_symbol_id;
        if (symbolId != null && rowSymbolId !== symbolId) return false;
        if (!anchor) return true;
        const rowAnchor = direction === "source" ? flowAnchorFromRow("source", row) : flowAnchorFromRow("target", row);
        return anchorsEqual(rowAnchor, anchor);
    });
}

function formatAnchorNode(symbol, anchor) {
    return {
        type: "flow_point",
        symbol,
        anchor: normalizeAnchor(anchor),
    };
}

function normalizeScopePath(scopePath) {
    if (!scopePath) return null;
    return scopePath.replace(/\\/g, "/").replace(/^\.\//, "");
}

function moduleMatchesScope(moduleRootPath, scopePath) {
    if (!scopePath) return true;
    const normalizedRoot = normalizeScopePath(moduleRootPath || ".");
    if (normalizedRoot === ".") return true;
    return normalizedRoot === scopePath
        || normalizedRoot.startsWith(`${scopePath}/`)
        || scopePath.startsWith(`${normalizedRoot}/`);
}


// --- Exported query functions (for server.mjs tool handlers) ---
export function findSymbols(query, { kind, limit = 20, path } = {}) {
    return withResolvedStore(path, (store) => {
        if (!store) return selectorError("NOT_INDEXED", "No project indexed", QUERY_PATH_RECOVERY);

        let results = store.search(query, { kind, limit });
        if (kind !== "all") {
            results = results.filter(r => r.name !== "__default_export__" && r.kind !== "reexport");
        }
        return {
            query: { query, kind: kind || null, limit },
            matches: results.map(node => serializeNode(store, node)),
            confidence: "exact",
            reason: "fts_lookup",
            evidence: { total_matches: results.length },
            limits_applied: { limit },
        };
    });
}

export function getSymbol(selector, { min_confidence = null, path } = {}) {
    return withResolvedStore(path, (store) => {
        if (!store) return selectorError("NOT_INDEXED", "No project indexed", QUERY_PATH_RECOVERY);
        const resolved = resolveSelector(store, selector);
        if (resolved.error) return resolved;

        const node = resolved.node;
        const provider_status = store.providerStatusForLanguage(node.language);
        const incoming = dedupeEdges(filterEdgesByConfidence(store.edgesTo(node.id), min_confidence), "incoming").map(e => ({
            kind: e.kind,
            confidence: e.confidence,
            origin: e.origin,
            file: e.file,
            line: e.line,
            evidence: parseEvidence(e.evidence_json),
            from: serializeNode(store, {
                id: e.source_id,
                qualified_name: e.source_qualified_name || null,
                name: e.source_name,
                kind: e.source_kind,
                language: e.source_language || null,
                file: e.source_file,
                line_start: e.source_line,
                line_end: e.source_line,
                signature: null,
                is_exported: 0,
                is_default_export: 0,
            }),
        }));
        const outgoing = dedupeEdges(filterEdgesByConfidence(store.edgesFrom(node.id), min_confidence), "outgoing").map(e => ({
            kind: e.kind,
            confidence: e.confidence,
            origin: e.origin,
            file: e.file,
            line: e.line,
            evidence: parseEvidence(e.evidence_json),
            to: serializeNode(store, {
                id: e.target_id,
                qualified_name: e.target_qualified_name || null,
                name: e.target_name,
                kind: e.target_kind,
                language: e.target_language || null,
                file: e.target_file,
                line_start: e.target_line,
                line_end: e.target_line,
                signature: null,
                is_exported: 0,
                is_default_export: 0,
            }),
        }));
        const moduleNode = store.nodesByFile(node.file).find(n => n.kind === "module");

        return {
            query: { ...resolved.query, min_confidence },
            result: {
                symbol: serializeNode(store, node),
                module: serializeNode(store, moduleNode),
                provider_status,
                incoming,
                outgoing,
                siblings: store.nodesByFile(node.file)
                    .filter(n => n.id !== node.id)
                    .map(sibling => serializeNode(store, sibling)),
            },
            confidence: resolved.confidence,
            reason: resolved.reason,
            warnings: resolved.warnings || [],
            evidence: {
                incoming_count: incoming.length,
                outgoing_count: outgoing.length,
            },
            limits_applied: {},
        };
    });
}

export function tracePaths(selector, {
    path_kind = "calls",
    direction = "reverse",
    depth = 3,
    limit = 50,
    min_confidence = null,
    path,
    target = null,
} = {}) {
    return withResolvedStore(path, (store) => {
        if (!store) return selectorError("NOT_INDEXED", "No project indexed", QUERY_PATH_RECOVERY);
        const resolved = resolveSelector(store, selector);
        if (resolved.error) return resolved;
        const resolvedTarget = resolveOptionalSelector(store, target);
        if (resolvedTarget?.error) return resolvedTarget;
        const targetNode = resolvedTarget?.node || null;

        if (path_kind === "flow") {
            const forward = direction === "forward" || direction === "both";
            const reverse = direction === "reverse" || direction === "both";
            const paths = [];
            const enqueueSeeds = [];
            if (forward) {
                for (const row of filterFlowFacts(store.flowFactsBySourceSymbol(resolved.node.id), { minConfidence: min_confidence })) {
                    enqueueSeeds.push({
                        point: { symbol: resolved.node, anchor: flowAnchorFromRow("source", row) },
                        depth: 0,
                        nodes: [formatAnchorNode(serializeNode(store, resolved.node), flowAnchorFromRow("source", row))],
                        edges: [],
                        seen: new Set([anchorKey(resolved.node.id, flowAnchorFromRow("source", row))]),
                        traversal: "forward",
                    });
                }
            }
            if (reverse) {
                for (const row of filterFlowFacts(store.flowFactsByTargetSymbol(resolved.node.id), { minConfidence: min_confidence, direction: "target" })) {
                    enqueueSeeds.push({
                        point: { symbol: resolved.node, anchor: flowAnchorFromRow("target", row) },
                        depth: 0,
                        nodes: [formatAnchorNode(serializeNode(store, resolved.node), flowAnchorFromRow("target", row))],
                        edges: [],
                        seen: new Set([anchorKey(resolved.node.id, flowAnchorFromRow("target", row))]),
                        traversal: "reverse",
                    });
                }
            }

            const queue = dedupeStrongest(enqueueSeeds, seed => `${seed.traversal}:${anchorKey(seed.point.symbol.id, seed.point.anchor)}`);
            while (queue.length > 0 && paths.length < limit) {
                const current = queue.shift();
                if (current.depth >= depth) continue;
                const candidateRows = current.traversal === "forward"
                    ? filterFlowFacts(store.flowFactsBySourceSymbol(current.point.symbol.id), {
                        minConfidence: min_confidence,
                        symbolId: current.point.symbol.id,
                        anchor: current.point.anchor,
                        direction: "source",
                    })
                    : filterFlowFacts(store.flowFactsByTargetSymbol(current.point.symbol.id), {
                        minConfidence: min_confidence,
                        symbolId: current.point.symbol.id,
                        anchor: current.point.anchor,
                        direction: "target",
                    });

                for (const row of candidateRows) {
                    const edge = current.traversal === "forward"
                        ? serializeFlowFact(store, row, "forward")
                        : {
                            ...serializeFlowFact(store, row, "reverse"),
                            source_symbol: serializeFlowSymbol(store, "target", row),
                            target_symbol: serializeFlowSymbol(store, "source", row),
                            source_anchor: flowAnchorFromRow("target", row),
                            target_anchor: flowAnchorFromRow("source", row),
                        };
                    const nextSymbol = edge.target_symbol;
                    const nextAnchor = edge.target_anchor;
                    const nextStateKey = anchorKey(nextSymbol.symbol_id, nextAnchor);
                    if (!nextStateKey || current.seen.has(nextStateKey)) continue;
                    const nextSeen = new Set(current.seen);
                    nextSeen.add(nextStateKey);
                    const nextPath = {
                        point: { symbol: store.getNodeById(nextSymbol.symbol_id), anchor: nextAnchor },
                        depth: current.depth + 1,
                        nodes: [...current.nodes, formatAnchorNode(nextSymbol, nextAnchor)],
                        edges: [...current.edges, edge],
                        seen: nextSeen,
                        traversal: current.traversal,
                    };
                    const matchesTarget = !targetNode || nextSymbol.symbol_id === targetNode.id;
                    if (matchesTarget) {
                        paths.push({
                            depth: nextPath.depth,
                            nodes: nextPath.nodes,
                            edges: nextPath.edges,
                        });
                    }
                    queue.push(nextPath);
                    if (paths.length >= limit) break;
                }
            }

            return {
                query: {
                    ...resolved.query,
                    path_kind,
                    direction,
                    depth,
                    limit,
                    min_confidence,
                    target: resolvedTarget ? resolvedTarget.query : null,
                },
                result: paths,
                confidence: resolved.confidence,
                reason: targetNode ? "targeted_flow_lookup" : resolved.reason,
                warnings: resolved.warnings || [],
                evidence: {
                    traversed_path_count: paths.length,
                    target_found: targetNode ? paths.length > 0 : null,
                },
                limits_applied: { depth, limit },
            };
        }

    const includeFlow = path_kind === "flow" || path_kind === "mixed";
    const edgeKinds = path_kind === "calls"
        ? new Set(["calls"])
        : path_kind === "references"
            ? new Set(["ref_read", "ref_type", "imports", "reexports"])
            : path_kind === "imports"
                ? new Set(["imports", "reexports"])
                : path_kind === "type"
                    ? new Set(["extends", "implements", "overrides"])
                    : path_kind === "flow"
                        ? new Set()
                        : new Set([
                            "calls", "ref_read", "ref_type", "imports", "reexports", "extends", "implements", "overrides",
                            "route_to_handler", "injects", "registers", "renders", "middleware_for",
                            "route_returns_key", "consumes_route", "consumer_uses_key", "consumer_uses_unknown_key",
                            "process_entry", "process_step",
                        ]);

    const getNeighbors = (nodeId) => {
        const rows = [];
        if (direction === "forward" || direction === "both") {
            for (const e of filterEdgesByConfidence(store.edgesFrom(nodeId), min_confidence)) {
                if (!edgeKinds.has(e.kind)) continue;
                rows.push({
                    nextId: e.target_id,
                    edge: {
                        kind: e.kind,
                        confidence: e.confidence,
                        origin: e.origin,
                        file: e.file,
                        line: e.line,
                        evidence: parseEvidence(e.evidence_json),
                        direction: "forward",
                    },
                });
            }
            if (includeFlow) {
                for (const row of filterFlowFacts(store.flowFactsBySourceSymbol(nodeId), { minConfidence: min_confidence })) {
                    if (row.target_symbol_id === nodeId) continue;
                    rows.push({
                        nextId: row.target_symbol_id,
                        edge: serializeFlowFact(store, row, "forward"),
                    });
                }
            }
        }
        if (direction === "reverse" || direction === "both") {
            for (const e of filterEdgesByConfidence(store.edgesTo(nodeId), min_confidence)) {
                if (!edgeKinds.has(e.kind)) continue;
                rows.push({
                    nextId: e.source_id,
                    edge: {
                        kind: e.kind,
                        confidence: e.confidence,
                        origin: e.origin,
                        file: e.file,
                        line: e.line,
                        evidence: parseEvidence(e.evidence_json),
                        direction: "reverse",
                    },
                });
            }
            if (includeFlow) {
                for (const row of filterFlowFacts(store.flowFactsByTargetSymbol(nodeId), { minConfidence: min_confidence, direction: "target" })) {
                    if (row.source_symbol_id === nodeId) continue;
                    rows.push({
                        nextId: row.source_symbol_id,
                        edge: {
                            ...serializeFlowFact(store, row, "reverse"),
                            source_symbol: serializeFlowSymbol(store, "target", row),
                            target_symbol: serializeFlowSymbol(store, "source", row),
                            source_anchor: flowAnchorFromRow("target", row),
                            target_anchor: flowAnchorFromRow("source", row),
                        },
                    });
                }
            }
        }
        return dedupeStrongest(rows, row => [row.nextId, row.edge.kind, row.edge.direction, row.edge.file, row.edge.line ?? ""].join("|"));
    };

    const queue = [{
        id: resolved.node.id,
        depth: 0,
        nodes: [serializeNode(store, resolved.node)],
        edges: [],
        seen: new Set([resolved.node.id]),
    }];
    const paths = [];

    while (queue.length > 0 && paths.length < limit) {
        const current = queue.shift();
        if (current.depth >= depth) continue;
        const neighbors = getNeighbors(current.id);
        for (const neighbor of neighbors) {
            if (current.seen.has(neighbor.nextId)) continue;
            const nextNode = store.getNodeById(neighbor.nextId);
            if (!nextNode) continue;
            const nextSeen = new Set(current.seen);
            nextSeen.add(neighbor.nextId);
            const nextPath = {
                id: neighbor.nextId,
                depth: current.depth + 1,
                nodes: [...current.nodes, serializeNode(store, nextNode)],
                edges: [...current.edges, neighbor.edge],
                seen: nextSeen,
            };
            const matchesTarget = !targetNode || neighbor.nextId === targetNode.id;
            if (matchesTarget) {
                paths.push({
                    depth: nextPath.depth,
                    nodes: nextPath.nodes,
                    edges: nextPath.edges,
                });
            }
            queue.push(nextPath);
            if (paths.length >= limit) break;
        }
    }

        return {
            query: {
                ...resolved.query,
                path_kind,
                direction,
                depth,
                limit,
                min_confidence,
                target: resolvedTarget ? resolvedTarget.query : null,
            },
            result: paths,
            confidence: resolved.confidence,
            reason: targetNode ? "targeted_path_lookup" : resolved.reason,
            warnings: resolved.warnings || [],
            evidence: {
                traversed_path_count: paths.length,
                target_found: targetNode ? paths.length > 0 : null,
            },
            limits_applied: { depth, limit },
        };
    });
}

export function explainResolution(selector, { path } = {}) {
    return withResolvedStore(path, (store) => {
        if (!store) return selectorError("NOT_INDEXED", "No project indexed", QUERY_PATH_RECOVERY);
        const normalized = normalizeSelector(selector);
        if (normalized.error) return normalized;
        const resolved = resolveSelector(store, selector);
        if (resolved.error) return resolved;

        let candidates = [];
        if (normalized.kind === "qualified_name") {
            candidates = store.findByQualified(normalized.value).map(node => serializeNode(store, node));
        } else if (normalized.kind === "workspace_qualified_name") {
            candidates = store.findByWorkspaceQualified(normalized.value).map(node => serializeNode(store, node));
        } else if (normalized.kind === "name_file") {
            candidates = store.findByName(normalized.value.name)
                .filter(n => n.file === normalized.value.file || n.file.endsWith(normalized.value.file) || n.file.endsWith(`/${normalized.value.file}`))
                .map(node => serializeNode(store, node));
        } else {
            candidates = [serializeNode(store, store.getNodeById(normalized.value))];
        }

        return {
            query: normalized.query,
            result: {
                resolved: serializeNode(store, resolved.node),
                selector_kind: normalized.kind,
                parsed_candidates: candidates,
                precise_provider_status: store.providerStatusForLanguage(resolved.node.language),
                precise_results: {
                    incoming_count: store.edgesTo(resolved.node.id).filter(edge => edge.origin?.startsWith("precise_")).length,
                    outgoing_count: store.edgesFrom(resolved.node.id).filter(edge => edge.origin?.startsWith("precise_")).length,
                },
                final_selection: {
                    reason: resolved.reason,
                    confidence: resolved.confidence,
                },
            },
            confidence: resolved.confidence,
            reason: resolved.reason,
            warnings: resolved.warnings || [],
            evidence: { candidate_count: candidates.length },
            limits_applied: {},
        };
    });
}

export function getReferencesBySelector(selector, { kind, limit = 50, min_confidence = null, path } = {}) {
    return withResolvedStore(path, (store) => {
        if (!store) return selectorError("NOT_INDEXED", "No project indexed", QUERY_PATH_RECOVERY);
        const resolved = resolveSelector(store, selector);
        if (resolved.error) return resolved;

        const allRefs = dedupeReferenceRows(filterEdgesByConfidence(collectReferenceRows(store, resolved.node, kind), min_confidence));
        const refs = allRefs.slice(0, limit);
        const byKind = {};
        for (const row of allRefs) byKind[row.kind] = (byKind[row.kind] || 0) + 1;

        return {
            query: { ...resolved.query, kind: kind || "all", limit, min_confidence },
            result: {
                symbol: serializeNode(store, resolved.node),
                provider_status: store.providerStatusForLanguage(resolved.node.language),
                references: refs.map(r => ({
                    file: r.file,
                    line: r.line,
                    kind: r.kind,
                    confidence: r.confidence,
                    origin: r.origin,
                    evidence: parseEvidence(r.evidence_json),
                })),
                total_by_kind: byKind,
                total: allRefs.length,
            },
            confidence: resolved.confidence,
            reason: resolved.reason,
            warnings: resolved.warnings || [],
            evidence: { total_found: allRefs.length, returned_count: refs.length },
            limits_applied: { limit },
        };
    });
}

export function findImplementationsBySelector(selector, { limit = 50, path } = {}) {
    return withResolvedStore(path, (store) => {
        if (!store) return selectorError("NOT_INDEXED", "No project indexed", QUERY_PATH_RECOVERY);
        const resolved = resolveSelector(store, selector);
        if (resolved.error) return resolved;

        const allowedKinds = resolved.node.kind === "method"
            ? new Set(["overrides"])
            : new Set(["implements", "extends", "overrides"]);
        const allMatches = store.edgesTo(resolved.node.id)
            .filter(edge => edge.layer === "type" && allowedKinds.has(edge.kind))
            .map(edge => ({
                kind: edge.kind,
                confidence: edge.confidence,
                source: serializeNode(store, {
                    id: edge.source_id,
                    qualified_name: edge.source_qualified_name || null,
                    name: edge.source_name,
                    kind: edge.source_kind,
                    language: edge.source_language || null,
                    file: edge.source_file,
                    line_start: edge.source_line,
                    line_end: edge.source_line,
                    signature: null,
                    is_exported: 0,
                    is_default_export: 0,
                }),
                evidence: {
                    layer: edge.layer,
                    origin: edge.origin,
                    file: edge.file,
                    line: edge.line,
                },
            }));
        const matches = allMatches.slice(0, limit);

        return {
            query: resolved.query,
            result: {
                symbol: serializeNode(store, resolved.node),
                total: allMatches.length,
                implementations: matches,
            },
            confidence: allMatches.some(match => match.confidence === "heuristic") ? "heuristic" : resolved.confidence,
            reason: "type_graph_lookup",
            warnings: resolved.warnings || [],
            evidence: { match_count: allMatches.length, returned_count: matches.length },
            limits_applied: { limit },
        };
    });
}

export function findDataflowsBySelector(selector, { depth = DEFAULT_FLOW_MAX_HOPS, limit = DEFAULT_FLOW_LIMIT, path, target = null } = {}) {
    return withResolvedStore(path, (store) => {
        if (!store) return selectorError("NOT_INDEXED", "No project indexed", QUERY_PATH_RECOVERY);
        const options = selector && selector.source ? selector : { source: selector, sink: target };
        const max_hops = selector?.max_hops ?? depth ?? DEFAULT_FLOW_MAX_HOPS;
        const flow_kind = selector?.flow_kind || "value";
        const min_confidence = selector?.min_confidence || null;
        const resolvedSource = resolveFlowPoint(store, options.source, "source");
        if (resolvedSource.error) return resolvedSource;
        const resolvedSink = options.sink ? resolveFlowPoint(store, options.sink, "sink") : null;
        if (resolvedSink?.error) return resolvedSink;

        const queue = [{
            point: resolvedSource.point,
            depth: 0,
            nodes: [formatAnchorNode(serializeNode(store, resolvedSource.point.symbol), resolvedSource.point.anchor)],
            hops: [],
            seen: new Set([anchorKey(resolvedSource.point.symbol.id, resolvedSource.point.anchor)]),
        }];
        const paths = [];

        while (queue.length > 0 && paths.length < limit) {
            const current = queue.shift();
            if (current.depth >= max_hops) continue;
            const rows = filterFlowFacts(store.flowFactsBySourceSymbol(current.point.symbol.id), {
                flowKind: flow_kind,
                minConfidence: min_confidence,
                symbolId: current.point.symbol.id,
                anchor: current.point.anchor,
                direction: "source",
            });
            for (const row of rows) {
                const hop = serializeFlowFact(store, row, "forward");
                if (flow_kind === "taint") hop.flow_kind = "taint";
                const nextSymbol = store.getNodeById(row.target_symbol_id);
                const nextAnchor = hop.target_anchor;
                const nextKey = anchorKey(row.target_symbol_id, nextAnchor);
                if (!nextSymbol || !nextKey || current.seen.has(nextKey)) continue;
                const nextSeen = new Set(current.seen);
                nextSeen.add(nextKey);
                const nextPath = {
                    point: { symbol: nextSymbol, anchor: nextAnchor },
                    depth: current.depth + 1,
                    nodes: [...current.nodes, formatAnchorNode(serializeNode(store, nextSymbol), nextAnchor)],
                    hops: [...current.hops, hop],
                    seen: nextSeen,
                };
                const matchesSink = !resolvedSink
                    || (nextSymbol.id === resolvedSink.point.symbol.id && anchorsEqual(nextAnchor, resolvedSink.point.anchor));
                if (matchesSink || !resolvedSink) {
                    paths.push({
                        depth: nextPath.depth,
                        nodes: nextPath.nodes,
                        hops: nextPath.hops,
                    });
                }
                queue.push(nextPath);
                if (paths.length >= limit) break;
            }
        }

        const allHops = paths.flatMap(item => item.hops);
        const confidence = allHops.some(hop => hop.confidence === "heuristic")
            ? "heuristic"
            : allHops.some(hop => hop.confidence === "inferred")
                ? "inferred"
                : "exact";

        return {
            query: {
                source: resolvedSource.query,
                sink: resolvedSink ? resolvedSink.query : null,
                flow_kind,
                max_hops,
                limit,
                min_confidence,
            },
            result: {
                source: formatAnchorNode(serializeNode(store, resolvedSource.point.symbol), resolvedSource.point.anchor),
                sink: resolvedSink ? formatAnchorNode(serializeNode(store, resolvedSink.point.symbol), resolvedSink.point.anchor) : null,
                paths,
            },
            confidence,
            reason: resolvedSink ? "targeted_flow_lookup" : "flow_path_lookup",
            evidence: {
                path_count: paths.length,
                target_found: resolvedSink ? paths.length > 0 : null,
            },
            limits_applied: { max_hops, limit },
        };
    });
}

export function getModuleMetricsReport({ scopePath, sort, minCoupling, path } = {}) {
    return withResolvedStore(path, (store) => {
        if (!store) return selectorError("NOT_INDEXED", "No project indexed", QUERY_PATH_RECOVERY);
        return {
            query: { scopePath: scopePath || null, sort: sort || "instability", minCoupling: minCoupling || 2 },
            result: store.moduleMetricRows({ scopePath, sort, minCoupling }),
            confidence: "exact",
            reason: "module_graph_metrics",
            evidence: {},
            limits_applied: {},
        };
    });
}

export function getArchitectureReport({ scopePath, limit = 15, path } = {}) {
    return withResolvedStore(path, (store) => {
        if (!store) return selectorError("NOT_INDEXED", "No project indexed", QUERY_PATH_RECOVERY);
        const { modules, hotspots, crossEdges, frameworkRows } = store.architectureReportData(scopePath);
        const stats = store.stats();
        return {
            query: { scopePath: scopePath || null, limit },
            result: {
                modules,
                hotspots: hotspots.slice(0, limit).map(h => ({
                    name: displayName(h),
                    kind: h.kind,
                    file: h.file,
                    module_key: h.module_key,
                    module_name: h.module_name,
                    package_key: h.package_key,
                    package_name: h.package_name,
                    complexity: h.complexity,
                    callers: h.callers,
                })),
                cross_module_edges: crossEdges,
                framework: frameworkRows,
                stats,
            },
            confidence: "exact",
            reason: "architecture_summary",
            evidence: {},
            limits_applied: { limit },
        };
    });
}

export function getHotspots({ minCallers = 2, minComplexity = 15, limit = 20, scopePath, path } = {}) {
    return withResolvedStore(path, (store) => {
        if (!store) return selectorError("NOT_INDEXED", "No project indexed", QUERY_PATH_RECOVERY);
        return store.hotspots({ minCallers, minComplexity, limit, scopePath });
    });
}
