import Database from "better-sqlite3";
import { existsSync, mkdirSync, statSync, rmSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { DB_RELATIVE_PATH } from "./constants.mjs";

const SCHEMA_VERSION = 1;
const QUERY_STORE_IDLE_MS = 1500;
const _stores = new Map();

export function dbPathFor(projectPath) {
    return join(resolve(projectPath), DB_RELATIVE_PATH);
}

export function closeAllStores() {
    for (const store of _stores.values()) store.close();
    _stores.clear();
}

export function resetResearchDb(projectPath) {
    closeAllStores();
    const dbPath = dbPathFor(projectPath);
    for (const suffix of ["", "-shm", "-wal"]) {
        const p = `${dbPath}${suffix}`;
        if (existsSync(p)) rmSync(p, { force: true });
    }
}

export function getStore(projectPath) {
    const abs = resolve(projectPath);
    const cached = _stores.get(abs);
    if (cached) return cached;
    const store = new ResearchStore(abs);
    _stores.set(abs, store);
    return store;
}

function json(value) {
    return JSON.stringify(value ?? null);
}

function readJson(value, fallback = null) {
    if (value === null || value === undefined || value === "") return fallback;
    try { return JSON.parse(value); } catch { return fallback; }
}

function bind(value) {
    if (value instanceof Date) return value.toISOString();
    if (typeof value === "boolean") return value ? 1 : 0;
    return value;
}

function bindAll(params) {
    return params.map(bind);
}

export class ResearchStore {
    constructor(projectPath) {
        this.projectPath = resolve(projectPath);
        this.dbPath = dbPathFor(this.projectPath);
        mkdirSync(dirname(this.dbPath), { recursive: true });
        this.db = new Database(this.dbPath);
        this.db.pragma("journal_mode = WAL");
        this.db.pragma("foreign_keys = ON");
        this.db.pragma("busy_timeout = 2000");
        this._initSchema();
        this._idleTimer = null;
    }

    close() {
        if (this._idleTimer) clearTimeout(this._idleTimer);
        this.db.close();
        _stores.delete(this.projectPath);
    }

    touch() {
        if (this._idleTimer) clearTimeout(this._idleTimer);
        this._idleTimer = setTimeout(() => this.close(), QUERY_STORE_IDLE_MS);
    }

    _initSchema() {
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS files (
                path TEXT PRIMARY KEY,
                kind TEXT NOT NULL,
                hash TEXT NOT NULL,
                mtime INTEGER NOT NULL,
                parsed_at INTEGER NOT NULL
            );
            CREATE TABLE IF NOT EXISTS nodes (
                id TEXT PRIMARY KEY,
                kind TEXT NOT NULL CHECK (kind IN ('hypothesis','goal','run','symbol','metric_snapshot','branch_or_commit','task','source')),
                display_name TEXT,
                properties TEXT
            );
            CREATE INDEX IF NOT EXISTS nodes_kind ON nodes(kind);
            CREATE TABLE IF NOT EXISTS hypotheses (
                id TEXT PRIMARY KEY REFERENCES nodes(id) ON DELETE CASCADE,
                file TEXT NOT NULL REFERENCES files(path) ON DELETE CASCADE,
                claim TEXT NOT NULL,
                category TEXT NOT NULL,
                status TEXT NOT NULL,
                priority_tier INTEGER,
                prior_belief REAL,
                confidence_post REAL,
                created_at TEXT,
                promoted_at TEXT,
                rejected_at TEXT,
                last_touched TEXT,
                raw_frontmatter TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS goals (
                id TEXT PRIMARY KEY REFERENCES nodes(id) ON DELETE CASCADE,
                file TEXT NOT NULL REFERENCES files(path) ON DELETE CASCADE,
                claim TEXT NOT NULL,
                status TEXT NOT NULL,
                priority TEXT,
                deadline TEXT,
                metrics_target TEXT NOT NULL,
                metrics_current TEXT,
                achieved_at TEXT,
                created_at TEXT,
                last_touched TEXT,
                raw_frontmatter TEXT NOT NULL
            );
            CREATE INDEX IF NOT EXISTS goals_status ON goals(status);
            CREATE TABLE IF NOT EXISTS hypothesis_goals (
                hypothesis_id TEXT NOT NULL REFERENCES hypotheses(id) ON DELETE CASCADE,
                goal_id TEXT NOT NULL REFERENCES goals(id) ON DELETE CASCADE,
                contribution TEXT,
                PRIMARY KEY (hypothesis_id, goal_id)
            );
            CREATE INDEX IF NOT EXISTS hg_goal ON hypothesis_goals(goal_id);
            CREATE INDEX IF NOT EXISTS hg_hypothesis ON hypothesis_goals(hypothesis_id);
            CREATE TABLE IF NOT EXISTS tasks (
                id TEXT PRIMARY KEY REFERENCES nodes(id) ON DELETE CASCADE,
                system TEXT NOT NULL CHECK (system IN ('linear','jira','github','file','other')),
                tracker_id TEXT NOT NULL,
                url TEXT,
                type TEXT NOT NULL CHECK (type IN ('implementation','refinement','research','rollback')),
                title TEXT NOT NULL,
                state TEXT NOT NULL CHECK (state IN ('open','in_progress','done','cancelled')),
                state_snapshot_at TEXT NOT NULL,
                created_at TEXT,
                closed_at TEXT
            );
            CREATE INDEX IF NOT EXISTS tasks_state ON tasks(state);
            CREATE INDEX IF NOT EXISTS tasks_system ON tasks(system);
            CREATE TABLE IF NOT EXISTS hypothesis_tasks (
                hypothesis_id TEXT NOT NULL REFERENCES hypotheses(id) ON DELETE CASCADE,
                task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
                PRIMARY KEY (hypothesis_id, task_id)
            );
            CREATE INDEX IF NOT EXISTS ht_task ON hypothesis_tasks(task_id);
            CREATE INDEX IF NOT EXISTS ht_hypothesis ON hypothesis_tasks(hypothesis_id);
            CREATE TABLE IF NOT EXISTS sources (
                id TEXT PRIMARY KEY REFERENCES nodes(id) ON DELETE CASCADE,
                type TEXT NOT NULL CHECK (type IN ('paper','video','website','book','podcast','code','dataset','archive')),
                title TEXT,
                url TEXT,
                identifier TEXT,
                raw_payload TEXT NOT NULL
            );
            CREATE INDEX IF NOT EXISTS sources_type ON sources(type);
            CREATE INDEX IF NOT EXISTS sources_identifier ON sources(identifier);
            CREATE TABLE IF NOT EXISTS node_sources (
                node_id TEXT NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
                node_kind TEXT NOT NULL CHECK (node_kind IN ('hypothesis','goal')),
                source_id TEXT NOT NULL REFERENCES sources(id) ON DELETE CASCADE,
                notes TEXT,
                accessed_at TEXT,
                cite_extra TEXT,
                PRIMARY KEY (node_id, source_id)
            );
            CREATE INDEX IF NOT EXISTS ns_source ON node_sources(source_id);
            CREATE INDEX IF NOT EXISTS ns_node ON node_sources(node_id);
            CREATE INDEX IF NOT EXISTS ns_kind ON node_sources(node_kind);
            CREATE TABLE IF NOT EXISTS edges (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                src TEXT NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
                dst TEXT NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
                src_kind TEXT NOT NULL,
                dst_kind TEXT NOT NULL,
                kind TEXT NOT NULL CHECK (kind IN ('parent_of','refines','supersedes','refutes','competes_with','depends_on','blocks','tested_by','implemented_in','runs_in','gated_by','tracked_by','cites','serves_goal','decomposes_goal','achieves')),
                properties TEXT,
                origin TEXT NOT NULL CHECK (origin IN ('frontmatter','inferred','derived')),
                created_at INTEGER NOT NULL
            );
            CREATE INDEX IF NOT EXISTS edges_src_kind ON edges(src, kind);
            CREATE INDEX IF NOT EXISTS edges_dst_kind ON edges(dst, kind);
            CREATE INDEX IF NOT EXISTS edges_kind_src_dst ON edges(kind, src_kind, dst_kind);
            CREATE TABLE IF NOT EXISTS runs (
                id TEXT PRIMARY KEY REFERENCES nodes(id) ON DELETE CASCADE,
                hypothesis_id TEXT REFERENCES hypotheses(id),
                goal_ids TEXT,
                comprehensive INTEGER NOT NULL DEFAULT 0,
                included_hypotheses TEXT,
                branch TEXT,
                type TEXT NOT NULL,
                manifest_file TEXT NOT NULL REFERENCES files(path) ON DELETE CASCADE,
                artifact_dir TEXT NOT NULL,
                created_at TEXT NOT NULL,
                git_commit TEXT,
                metrics TEXT NOT NULL,
                raw_manifest TEXT
            );
            CREATE INDEX IF NOT EXISTS runs_hypothesis ON runs(hypothesis_id);
            CREATE INDEX IF NOT EXISTS runs_type ON runs(type);
            CREATE TABLE IF NOT EXISTS evidence (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                hypothesis_id TEXT NOT NULL REFERENCES hypotheses(id) ON DELETE CASCADE,
                type TEXT NOT NULL,
                ref TEXT NOT NULL,
                date TEXT,
                summary TEXT,
                properties TEXT
            );
            CREATE INDEX IF NOT EXISTS evidence_hypothesis ON evidence(hypothesis_id);
            CREATE TABLE IF NOT EXISTS hypothesis_symbols (
                hypothesis_id TEXT NOT NULL REFERENCES hypotheses(id) ON DELETE CASCADE,
                workspace_qualified_name TEXT NOT NULL,
                confidence TEXT DEFAULT 'exact',
                PRIMARY KEY (hypothesis_id, workspace_qualified_name)
            );
            CREATE INDEX IF NOT EXISTS hsym_hypothesis ON hypothesis_symbols(hypothesis_id);
            CREATE INDEX IF NOT EXISTS hsym_qn ON hypothesis_symbols(workspace_qualified_name);
            CREATE VIRTUAL TABLE IF NOT EXISTS hypothesis_fts USING fts5(id UNINDEXED, claim, mechanism, tags, content='');
            CREATE VIRTUAL TABLE IF NOT EXISTS goal_fts USING fts5(id UNINDEXED, claim, rationale, content='');
            PRAGMA user_version = ${SCHEMA_VERSION};
        `);
    }

    clear() {
        this.db.exec(`
            DELETE FROM hypothesis_fts;
            DELETE FROM goal_fts;
            DELETE FROM edges;
            DELETE FROM hypothesis_symbols;
            DELETE FROM evidence;
            DELETE FROM runs;
            DELETE FROM node_sources;
            DELETE FROM sources;
            DELETE FROM hypothesis_tasks;
            DELETE FROM tasks;
            DELETE FROM hypothesis_goals;
            DELETE FROM goals;
            DELETE FROM hypotheses;
            DELETE FROM files;
            DELETE FROM nodes;
        `);
    }

    insertFile(file, kind, hash) {
        const abs = join(this.projectPath, file);
        const mtime = existsSync(abs) ? Math.trunc(statSync(abs).mtimeMs) : Date.now();
        this.db.prepare(`INSERT INTO files(path, kind, hash, mtime, parsed_at) VALUES (?, ?, ?, ?, ?)
            ON CONFLICT(path) DO UPDATE SET kind = excluded.kind, hash = excluded.hash, mtime = excluded.mtime, parsed_at = excluded.parsed_at`)
            .run(file, kind, hash, mtime, Date.now());
    }

    insertNode(id, kind, displayName = id, properties = null) {
        this.db.prepare(`INSERT INTO nodes(id, kind, display_name, properties) VALUES (?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET kind = excluded.kind, display_name = excluded.display_name, properties = excluded.properties`)
            .run(id, kind, displayName, json(properties));
    }

    insertEdge(src, dst, srcKind, dstKind, kind, properties = {}, origin = "frontmatter") {
        if (!src || !dst) return;
        this.db.prepare("INSERT INTO edges(src, dst, src_kind, dst_kind, kind, properties, origin, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)").run(src, dst, srcKind, dstKind, kind, json(properties), origin, Date.now());
    }

    query(sql, params = []) {
        return this.db.prepare(sql).all(...bindAll(params));
    }

    one(sql, params = []) {
        return this.db.prepare(sql).get(...bindAll(params));
    }

    run(sql, params = []) {
        return this.db.prepare(sql).run(...bindAll(params));
    }

    json(value, fallback = null) {
        return readJson(value, fallback);
    }
}

export { json, readJson };
