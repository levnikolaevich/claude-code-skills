import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { execFileSync } from "node:child_process";
import { boundedLimit } from "@levnikolaevich/hex-common/runtime/schema";
import matter from "gray-matter";
import { auditTaskInvariants, indexProject, verifyProject } from "./indexer.mjs";
import { dbPathFor, getStore } from "./store.mjs";
import { parseYamlLite } from "./frontmatter-parser.mjs";
import { scoreEvidenceDepth } from "./source-utils.mjs";

function projectPath(path) {
    return resolve(path || process.cwd());
}

function limit(value, fallback = 50, max = 250) {
    return boundedLimit(value, fallback, max);
}

function ensureIndexed(path) {
    const root = projectPath(path);
    if (!existsSync(dbPathFor(root))) {
        return {
            ok: false,
            payload: {
                status: "UNSUPPORTED",
                reason: "not_indexed",
                summary: "Research index does not exist. Run index_hypotheses first.",
                next_action: "run_index_hypotheses",
                warnings: [],
            },
        };
    }
    return { ok: true, root, store: getStore(root) };
}

function parseJson(value, fallback) {
    if (value === null || value === undefined || value === "") return fallback;
    try { return JSON.parse(value); } catch { return fallback; }
}

function rowHypothesis(row) {
    return {
        id: row.id,
        claim: row.claim,
        category: row.category,
        status: row.status,
        priority_tier: row.priority_tier,
        confidence_post: row.confidence_post,
        created_at: row.created_at,
        last_touched: row.last_touched,
        file: row.file,
    };
}

function sourceRowsForNode(store, nodeId, nodeKind = "hypothesis") {
    return store.query(`SELECT s.* FROM sources s JOIN node_sources ns ON ns.source_id = s.id
        WHERE ns.node_id = ? AND ns.node_kind = ? ORDER BY s.type, s.title`, [nodeId, nodeKind])
        .map(s => ({ ...s, raw_payload: parseJson(s.raw_payload, {}) }));
}

function hypothesisWithDepth(store, row) {
    const sources = sourceRowsForNode(store, row.id, "hypothesis");
    return { ...rowHypothesis(row), evidence_depth: scoreEvidenceDepth(sources) };
}

function rowGoal(row) {
    return {
        id: row.id,
        claim: row.claim,
        status: row.status,
        priority: row.priority,
        deadline: row.deadline,
        metrics_target: parseJson(row.metrics_target, {}),
        metrics_current: parseJson(row.metrics_current, null),
        created_at: row.created_at,
        last_touched: row.last_touched,
        file: row.file,
    };
}

function rowRun(row) {
    return {
        id: row.id,
        hypothesis_id: row.hypothesis_id,
        goal_ids: parseJson(row.goal_ids, []),
        comprehensive: !!row.comprehensive,
        included_hypotheses: parseJson(row.included_hypotheses, []),
        branch: row.branch,
        type: row.type,
        manifest_file: row.manifest_file,
        artifact_dir: row.artifact_dir,
        created_at: row.created_at,
        git_commit: row.git_commit,
        metrics: parseJson(row.metrics, {}),
        raw_manifest: parseJson(row.raw_manifest, {}),
    };
}

function metricsCurrentWithProvenance(row) {
    const current = parseJson(row.metrics_current, null);
    if (!current) return null;
    return {
        ...current,
        provenance: {
            source: current.source || "comprehensive_run",
            run_id: current.run_id || null,
            git_commit: current.git_commit || null,
        },
    };
}

function orderedWarnings(warnings, max = 100) {
    return warnings.slice(0, max).map(w => ({
        code: w.code,
        message: w.message,
        id: w.id,
        file: w.file,
        details: w.details,
    }));
}

export function indexHypotheses(params = {}) {
    return indexProject(projectPath(params.path));
}

export function verifyIndex(params = {}) {
    const root = projectPath(params.path);
    const verified = verifyProject(root);
    const dbExists = existsSync(dbPathFor(root));
    return {
        ...verified,
        reason: dbExists ? verified.reason : "verified_without_existing_index",
        summary: { ...verified.summary, db_exists: dbExists },
    };
}

export function findHypotheses(params = {}) {
    const opened = ensureIndexed(params.path);
    if (!opened.ok) return opened.payload;
    const { store } = opened;
    const where = [];
    const args = [];
    if (params.status) { where.push("h.status = ?"); args.push(params.status); }
    if (params.goal) {
        where.push("EXISTS (SELECT 1 FROM hypothesis_goals hg WHERE hg.hypothesis_id = h.id AND hg.goal_id = ?)");
        args.push(params.goal);
    }
    if (params.task_state) {
        where.push(`EXISTS (
            SELECT 1 FROM hypothesis_tasks ht JOIN tasks t ON t.id = ht.task_id
            WHERE ht.hypothesis_id = h.id AND t.state = ?
        )`);
        args.push(params.task_state);
    }
    if (params.cited_source_type) {
        where.push(`EXISTS (
            SELECT 1 FROM node_sources ns JOIN sources s ON s.id = ns.source_id
            WHERE ns.node_id = h.id AND ns.node_kind = 'hypothesis' AND s.type = ?
        )`);
        args.push(params.cited_source_type);
    }
    if (params.cited_source_year_min !== undefined) {
        where.push(`EXISTS (
            SELECT 1 FROM node_sources ns JOIN sources s ON s.id = ns.source_id
            WHERE ns.node_id = h.id AND CAST(json_extract(s.raw_payload, '$.year') AS INTEGER) >= ?
        )`);
        args.push(Number(params.cited_source_year_min));
    }
    if (params.priority_tier !== undefined) { where.push("h.priority_tier = ?"); args.push(Number(params.priority_tier)); }
    if (params.claim_substring) { where.push("lower(h.claim) LIKE lower(?)"); args.push(`%${params.claim_substring}%`); }
    const sql = `SELECT h.* FROM hypotheses h ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
        ORDER BY h.priority_tier IS NULL, h.priority_tier ASC, h.last_touched DESC, h.id ASC LIMIT ?`;
    args.push(limit(params.limit));
    const hypotheses = store.query(sql, args).map(row => hypothesisWithDepth(store, row));
    return {
        status: "OK",
        reason: "matched",
        summary: { count: hypotheses.length },
        hypotheses,
        follow_ups: hypotheses.slice(0, 10).map(h => ({ tool: "inspect_hypothesis", args: { id: h.id } })),
    };
}

export function inspectHypothesis(params = {}) {
    const opened = ensureIndexed(params.path);
    if (!opened.ok) return opened.payload;
    const { store } = opened;
    const row = params.id
        ? store.one("SELECT * FROM hypotheses WHERE id = ?", [params.id])
        : store.one("SELECT * FROM hypotheses WHERE lower(claim) LIKE lower(?) ORDER BY last_touched DESC LIMIT 1", [`%${params.claim_substring || ""}%`]);
    if (!row) {
        return { status: "INVALID", reason: "hypothesis_not_found", summary: "No matching hypothesis", warnings: [] };
    }
    const goals = store.query("SELECT g.* FROM goals g JOIN hypothesis_goals hg ON hg.goal_id = g.id WHERE hg.hypothesis_id = ?", [row.id]).map(rowGoal);
    const tasks = store.query("SELECT t.* FROM tasks t JOIN hypothesis_tasks ht ON ht.task_id = t.id WHERE ht.hypothesis_id = ? ORDER BY t.state, t.id", [row.id]);
    const evidence = store.query("SELECT * FROM evidence WHERE hypothesis_id = ? ORDER BY date DESC, id DESC", [row.id]);
    const runs = store.query("SELECT * FROM runs WHERE hypothesis_id = ? ORDER BY created_at DESC", [row.id]).map(rowRun);
    const sources = sourceRowsForNode(store, row.id, "hypothesis");
    const edges = store.query("SELECT src, dst, src_kind, dst_kind, kind, origin, properties FROM edges WHERE src = ? OR dst = ? ORDER BY kind, src, dst", [row.id, row.id])
        .map(e => ({ ...e, properties: parseJson(e.properties, {}) }));
    return {
        status: "OK",
        reason: "inspected",
        summary: { id: row.id, goals: goals.length, tasks: tasks.length, evidence: evidence.length, runs: runs.length, sources: sources.length },
        hypothesis: { ...rowHypothesis(row), evidence_depth: scoreEvidenceDepth(sources) },
        frontmatter: parseJson(row.raw_frontmatter, {}),
        goals,
        tasks,
        evidence: evidence.map(e => ({ ...e, properties: parseJson(e.properties, {}) })),
        runs,
        sources,
        edges,
        follow_ups: [{ tool: "trace_lineage", args: { id: row.id } }, { tool: "find_evidence", args: { id: row.id } }],
    };
}

export function findEvidence(params = {}) {
    const opened = ensureIndexed(params.path);
    if (!opened.ok) return opened.payload;
    const { store } = opened;
    const max = limit(params.limit);
    const args = [];
    const where = [];
    if (params.id) { where.push("e.hypothesis_id = ?"); args.push(params.id); }
    if (params.type) { where.push("e.type = ?"); args.push(params.type); }
    const evidence = store.query(`SELECT e.* FROM evidence e ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
        ORDER BY e.date DESC, e.id DESC LIMIT ?`, [...args, max])
        .map(e => ({ ...e, properties: parseJson(e.properties, {}) }));
    const sourceArgs = [];
    const sourceWhere = [];
    if (params.id) { sourceWhere.push("ns.node_id = ?"); sourceArgs.push(params.id); }
    if (params.type) { sourceWhere.push("s.type = ?"); sourceArgs.push(params.type); }
    const sources = store.query(`SELECT s.*, ns.node_id, ns.node_kind FROM sources s JOIN node_sources ns ON ns.source_id = s.id
        ${sourceWhere.length ? `WHERE ${sourceWhere.join(" AND ")}` : ""}
        ORDER BY s.type, s.title LIMIT ?`, [...sourceArgs, max])
        .map(s => ({ ...s, raw_payload: parseJson(s.raw_payload, {}) }));
    return { status: "OK", reason: "matched", summary: { evidence: evidence.length, sources: sources.length }, evidence_depth: scoreEvidenceDepth(sources), evidence, sources };
}

export function findRuns(params = {}) {
    const opened = ensureIndexed(params.path);
    if (!opened.ok) return opened.payload;
    const { store } = opened;
    const where = [];
    const args = [];
    if (params.id) { where.push("id = ?"); args.push(params.id); }
    if (params.hypothesis) { where.push("hypothesis_id = ?"); args.push(params.hypothesis); }
    if (params.type) { where.push("type = ?"); args.push(params.type); }
    if (params.comprehensive !== undefined) { where.push("comprehensive = ?"); args.push(params.comprehensive ? 1 : 0); }
    const runs = store.query(`SELECT * FROM runs ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
        ORDER BY created_at DESC LIMIT ?`, [...args, limit(params.limit)]).map(rowRun);
    return { status: "OK", reason: "matched", summary: { count: runs.length }, runs };
}

export function traceLineage(params = {}) {
    const opened = ensureIndexed(params.path);
    if (!opened.ok) return opened.payload;
    const { store } = opened;
    const start = params.id;
    const maxDepth = Math.max(1, Math.min(8, Number(params.depth ?? 4)));
    const max = limit(params.limit, 100, 500);
    const direction = params.direction || "both";
    const seen = new Set([start]);
    const nodes = [];
    const edges = [];
    let frontier = [{ id: start, depth: 0 }];
    while (frontier.length && nodes.length < max) {
        const next = [];
        for (const item of frontier) {
            const node = store.one("SELECT * FROM nodes WHERE id = ?", [item.id]);
            if (node) nodes.push({ id: node.id, kind: node.kind, display_name: node.display_name, depth: item.depth });
            if (item.depth >= maxDepth) continue;
            const clauses = [];
            const args = [];
            if (direction === "out" || direction === "both") { clauses.push("src = ?"); args.push(item.id); }
            if (direction === "in" || direction === "both") { clauses.push("dst = ?"); args.push(item.id); }
            const rows = store.query(`SELECT * FROM edges WHERE kind IN ('parent_of','refines','supersedes','refutes','depends_on','blocks') AND (${clauses.join(" OR ")})`, args);
            for (const edge of rows) {
                edges.push({ src: edge.src, dst: edge.dst, kind: edge.kind, origin: edge.origin });
                const other = edge.src === item.id ? edge.dst : edge.src;
                if (!seen.has(other)) {
                    seen.add(other);
                    next.push({ id: other, depth: item.depth + 1 });
                }
            }
        }
        frontier = next;
    }
    return { status: "OK", reason: "traced", summary: { nodes: nodes.length, edges: edges.length, truncated: nodes.length >= max }, nodes, edges };
}

export function analyzeTopology(params = {}) {
    const opened = ensureIndexed(params.path);
    if (!opened.ok) return opened.payload;
    const { store } = opened;
    const counts = Object.fromEntries(store.query("SELECT kind, count(*) AS count FROM nodes GROUP BY kind").map(r => [r.kind, r.count]));
    const edgeCounts = Object.fromEntries(store.query("SELECT kind, count(*) AS count FROM edges GROUP BY kind").map(r => [r.kind, r.count]));
    const hubs = store.query(`SELECT n.id, n.kind, n.display_name, count(e.id) AS degree FROM nodes n
        LEFT JOIN edges e ON e.src = n.id OR e.dst = n.id
        GROUP BY n.id ORDER BY degree DESC, n.id LIMIT ?`, [limit(params.limit, 20, 100)]);
    return { status: "OK", reason: "analyzed", summary: { nodes: counts, edges: edgeCounts }, hubs };
}

export function auditOrphans(params = {}) {
    const opened = ensureIndexed(params.path);
    if (!opened.ok) return opened.payload;
    const { store } = opened;
    const issues = [];
    for (const h of store.query("SELECT * FROM hypotheses")) {
        const raw = parseJson(h.raw_frontmatter, {});
        const bridgeGoals = new Set(store.query("SELECT goal_id FROM hypothesis_goals WHERE hypothesis_id = ?", [h.id]).map(r => r.goal_id));
        for (const goal of raw.goals || []) {
            if (!bridgeGoals.has(goal)) issues.push({ category: "missing_goal", id: h.id, message: `${h.id} references missing goal ${goal}` });
        }
        const evidence = store.one("SELECT count(*) AS count FROM evidence WHERE hypothesis_id = ?", [h.id]).count;
        const sources = store.one("SELECT count(*) AS count FROM node_sources WHERE node_id = ? AND node_kind = 'hypothesis'", [h.id]).count;
        const degree = store.one("SELECT count(*) AS count FROM edges WHERE src = ? OR dst = ?", [h.id, h.id]).count;
        if (degree === 0) issues.push({ category: "disconnected_node", id: h.id, message: `${h.id} has no graph edges` });
        if (sources === 0) issues.push({ category: "missing_source", id: h.id, message: `${h.id} has no cited source` });
        if (["live", "validated_branch", "pending_implementation"].includes(h.status) && evidence === 0) {
            issues.push({ category: "missing_evidence", id: h.id, message: `${h.id} has no evidence entries` });
        }
        const touched = Date.parse(h.last_touched || h.created_at || "");
        if (Number.isFinite(touched) && Date.now() - touched > 90 * 24 * 60 * 60 * 1000) {
            issues.push({ category: "stale_hypothesis", id: h.id, message: `${h.id} last_touched is stale` });
        }
        if (raw.implementation?.branch && String(raw.implementation.branch).includes("deleted/")) {
            issues.push({ category: "dead_branch", id: h.id, message: `${h.id} implementation branch looks dead` });
        }
    }
    for (const warning of auditTaskInvariants(store)) {
        issues.push({ category: warning.code, id: warning.id, message: warning.message, details: warning.details });
    }
    for (const goal of store.query("SELECT * FROM goals")) {
        if (!goal.metrics_current) issues.push({ category: "missing_goal_run", id: goal.id, message: `${goal.id} has no derived comprehensive-run metrics` });
    }
    const categories = [...new Set(issues.map(i => i.category))].sort();
    return {
        status: issues.length ? "STALE" : "OK",
        reason: issues.length ? "audit_findings" : "no_orphans",
        summary: { issues: issues.length, categories },
        issues: issues.slice(0, limit(params.limit, 100, 500)),
    };
}

export function inspectGoal(params = {}) {
    const opened = ensureIndexed(params.path);
    if (!opened.ok) return opened.payload;
    const { store } = opened;
    const row = params.id
        ? store.one("SELECT * FROM goals WHERE id = ?", [params.id])
        : store.one("SELECT * FROM goals WHERE lower(claim) LIKE lower(?) ORDER BY last_touched DESC LIMIT 1", [`%${params.claim_substring || ""}%`]);
    if (!row) return { status: "INVALID", reason: "goal_not_found", summary: "No matching goal", warnings: [] };
    const hypotheses = store.query("SELECT h.* FROM hypotheses h JOIN hypothesis_goals hg ON hg.hypothesis_id = h.id WHERE hg.goal_id = ? ORDER BY h.status, h.id", [row.id]).map(h => hypothesisWithDepth(store, h));
    const children = store.query("SELECT g.* FROM goals g JOIN edges e ON e.dst = g.id WHERE e.src = ? AND e.kind = 'decomposes_goal'", [row.id]).map(rowGoal);
    const parents = store.query("SELECT g.* FROM goals g JOIN edges e ON e.src = g.id WHERE e.dst = ? AND e.kind = 'decomposes_goal'", [row.id]).map(rowGoal);
    return {
        status: "OK",
        reason: "inspected",
        summary: { id: row.id, hypotheses: hypotheses.length, children: children.length, parents: parents.length },
        goal: { ...rowGoal(row), metrics_current: metricsCurrentWithProvenance(row), metrics_missing_reason: row.metrics_current ? null : "no_explicit_comprehensive_run_covers_goal" },
        frontmatter: parseJson(row.raw_frontmatter, {}),
        hypotheses,
        children,
        parents,
        follow_ups: [{ tool: "trace_goal_tree", args: { id: row.id } }, { tool: "audit_goal_alignment", args: {} }],
    };
}

export function traceGoalTree(params = {}) {
    const opened = ensureIndexed(params.path);
    if (!opened.ok) return opened.payload;
    const { store } = opened;
    const start = params.id;
    const max = limit(params.limit, 100, 500);
    const seen = new Set([start]);
    const nodes = [];
    const edges = [];
    let frontier = [start];
    while (frontier.length && nodes.length < max) {
        const next = [];
        for (const id of frontier) {
            const node = store.one("SELECT * FROM goals WHERE id = ?", [id]);
            if (node) nodes.push(rowGoal(node));
            for (const edge of store.query("SELECT * FROM edges WHERE kind = 'decomposes_goal' AND (src = ? OR dst = ?)", [id, id])) {
                edges.push({ src: edge.src, dst: edge.dst, kind: edge.kind });
                const other = edge.src === id ? edge.dst : edge.src;
                if (!seen.has(other)) {
                    seen.add(other);
                    next.push(other);
                }
            }
        }
        frontier = next;
    }
    return { status: "OK", reason: "traced", summary: { goals: nodes.length, edges: edges.length }, goals: nodes, edges };
}

export function auditGoalAlignment(params = {}) {
    const opened = ensureIndexed(params.path);
    if (!opened.ok) return opened.payload;
    const { store } = opened;
    const issues = [];
    for (const goal of store.query("SELECT * FROM goals")) {
        const hypotheses = store.query("SELECT h.* FROM hypotheses h JOIN hypothesis_goals hg ON hg.hypothesis_id = h.id WHERE hg.goal_id = ?", [goal.id]);
        const live = hypotheses.filter(h => h.status === "live");
        if (!hypotheses.length) issues.push({ category: "goal_without_hypotheses", id: goal.id, message: `${goal.id} has no hypotheses` });
        if (goal.status === "active" && !live.length) issues.push({ category: "active_goal_without_live_hypothesis", id: goal.id, message: `${goal.id} has no live hypothesis` });
        if (!goal.metrics_current) issues.push({ category: "goal_without_comprehensive_run", id: goal.id, message: `${goal.id} has no derived metrics_current` });
    }
    const coverageCandidates = goalCoverageCandidates(store);
    for (const h of store.query("SELECT * FROM hypotheses")) {
        const raw = parseJson(h.raw_frontmatter, {});
        const goals = new Set(store.query("SELECT goal_id FROM hypothesis_goals WHERE hypothesis_id = ?", [h.id]).map(r => r.goal_id));
        if (!goals.size) issues.push({ category: "hypothesis_without_valid_goal", id: h.id, message: `${h.id} has no valid goal link` });
        for (const goal of raw.goals || []) {
            if (!goals.has(goal)) issues.push({ category: "missing_goal", id: h.id, message: `${h.id} references missing goal ${goal}` });
        }
    }
    return {
        status: issues.length ? "STALE" : "OK",
        reason: issues.length ? "alignment_findings" : "aligned",
        summary: { issues: issues.length, categories: [...new Set(issues.map(i => i.category))].sort() },
        issues: issues.slice(0, limit(params.limit, 100, 500)),
        coverage_candidates: coverageCandidates.slice(0, limit(params.limit, 100, 500)),
    };
}

function goalCoverageCandidates(store) {
    const candidates = [];
    for (const goal of store.query("SELECT * FROM goals")) {
        if (goal.metrics_current) continue;
        const runs = store.query("SELECT * FROM runs WHERE comprehensive = 0 ORDER BY created_at DESC");
        for (const run of runs) {
            const goals = parseJson(run.goal_ids, []);
            const included = parseJson(run.included_hypotheses, []);
            const metrics = parseJson(run.metrics, {});
            const looksMultiSymbol = included.length > 1 || Array.isArray(metrics.symbols) || metrics.multi_symbol_pass_rate !== undefined || metrics.pass_rate !== undefined;
            if (goals.includes(goal.id) && looksMultiSymbol) {
                candidates.push({
                    goal_id: goal.id,
                    run_id: run.id,
                    manifest_file: run.manifest_file,
                    reason: "targeted_or_non_comprehensive_run_has_goal_and_multisymbol_shape",
                    suggested_manifest_fix: "Set comprehensive: true, hypothesis: null, and included_hypotheses to the cohort if this run is intended to satisfy goal metrics.",
                });
            }
        }
    }
    return candidates;
}

function parseResearchFileText(file, text) {
    if (!text) return {};
    if (file.endsWith(".md")) return matter(text).data || {};
    if (/manifest\.ya?ml$/i.test(file)) return parseYamlLite(text);
    return {};
}

function summarizeValue(value) {
    if (value === undefined) return null;
    if (value === null || typeof value !== "object") return value;
    if (Array.isArray(value)) return { count: value.length, sample: value.slice(0, 3) };
    return { keys: Object.keys(value).sort().slice(0, 12) };
}

const DIFF_FIELDS = [
    "status",
    "priority",
    "priority_tier",
    "last_verdict",
    "gate.results",
    "sources",
    "git_commit",
    "metrics",
    "results_path",
];

function getPathValue(obj, path) {
    return path.split(".").reduce((value, key) => value && typeof value === "object" ? value[key] : undefined, obj);
}

function entityIdFrom(file, parsed) {
    return parsed.id || parsed.hypothesis || parsed.goal || file.replace(/^.*\/([^/]+)\.[^.]+$/, "$1");
}

export function analyzeProgress(params = {}) {
    const root = projectPath(params.path);
    let changed = [];
    try {
        changed = execFileSync("git", ["-C", root, "diff", "--name-only", params.compare_against || "HEAD", "--"], { encoding: "utf8" })
            .split(/\r?\n/).filter(Boolean);
    } catch {
        return { status: "UNSUPPORTED", reason: "git_diff_unavailable", summary: "Could not read git diff for progress analysis", warnings: [] };
    }
    const relevant = changed.filter(p => p.startsWith("docs/hypotheses/") || p.startsWith("docs/goals/") || p.startsWith("benchmark/runs/"));
    const fieldDeltas = [];
    for (const file of relevant) {
        let oldText = "";
        let newText = "";
        try { oldText = execFileSync("git", ["-C", root, "show", `${params.compare_against || "HEAD"}:${file}`], { encoding: "utf8" }); } catch { oldText = ""; }
        try { newText = readFileSync(join(root, file), "utf8"); } catch { newText = ""; }
        const oldParsed = parseResearchFileText(file, oldText);
        const newParsed = parseResearchFileText(file, newText);
        const entityId = entityIdFrom(file, newParsed) || entityIdFrom(file, oldParsed);
        for (const field of DIFF_FIELDS) {
            const oldValue = getPathValue(oldParsed, field);
            const newValue = getPathValue(newParsed, field);
            if (JSON.stringify(oldValue) !== JSON.stringify(newValue)) {
                fieldDeltas.push({ file, id: entityId, field, old: summarizeValue(oldValue), new: summarizeValue(newValue) });
            }
        }
    }
    return {
        status: "OK",
        reason: "analyzed",
        summary: { changed_files: changed.length, relevant_files: relevant.length, field_deltas: fieldDeltas.length },
        changed_files: relevant,
        field_deltas: fieldDeltas,
        next_action: relevant.length ? "run_verify_index_then_index_hypotheses" : "no_researchgraph_changes_detected",
    };
}

export function analyzeProposed(params = {}) {
    const inspected = inspectHypothesis(params);
    if (inspected.status !== "OK") return inspected;
    const h = inspected.hypothesis;
    const issues = [];
    if (!inspected.goals.length) issues.push("missing_goal_link");
    if (!inspected.sources.length) issues.push("missing_source");
    if (!inspected.tasks.length && ["pending_implementation", "live", "in_progress"].includes(h.status)) issues.push("missing_task");
    if (!inspected.evidence.length && ["live", "validated_branch"].includes(h.status)) issues.push("missing_evidence");
    const evidenceDepth = inspected.hypothesis.evidence_depth || scoreEvidenceDepth(inspected.sources);
    return {
        status: issues.length ? "STALE" : "OK",
        reason: issues.length ? "proposal_gaps" : "proposal_ready",
        summary: { id: h.id, issues: issues.length, evidence_depth: evidenceDepth.score },
        proposal: h,
        evidence_depth: evidenceDepth,
        issues,
        follow_ups: [{ tool: "inspect_hypothesis", args: { id: h.id } }],
    };
}

export function exportCanvas(params = {}) {
    const opened = ensureIndexed(params.path);
    if (!opened.ok) return opened.payload;
    const { root, store } = opened;
    const outputPath = resolve(root, params.output_path || "docs/research-map.canvas");
    const mode = params.mode || "merge";
    let previous = { nodes: [], edges: [] };
    if (mode === "merge" && existsSync(outputPath)) {
        try { previous = JSON.parse(readFileSync(outputPath, "utf8")); } catch { previous = { nodes: [], edges: [] }; }
    }
    const previousById = new Map((previous.nodes || []).map(n => [n.id, n]));
    const dbNodes = store.query("SELECT * FROM nodes WHERE kind IN ('hypothesis','goal','run') ORDER BY kind, id");
    const nodes = dbNodes.map((node, index) => {
        const prev = previousById.get(node.id);
        const row = Math.floor(index / 4);
        const col = index % 4;
        return {
            id: node.id,
            type: "text",
            text: `${node.kind}: ${node.display_name || node.id}`,
            x: prev?.x ?? col * 360,
            y: prev?.y ?? row * 220,
            width: prev?.width ?? 320,
            height: prev?.height ?? 160,
        };
    });
    const edgeSet = new Set();
    const edges = store.query("SELECT src, dst, kind FROM edges WHERE src IN (SELECT id FROM nodes WHERE kind IN ('hypothesis','goal','run')) AND dst IN (SELECT id FROM nodes WHERE kind IN ('hypothesis','goal','run')) ORDER BY src, dst, kind")
        .filter(edge => {
            const id = `${edge.src}:${edge.dst}:${edge.kind}`;
            if (edgeSet.has(id)) return false;
            edgeSet.add(id);
            return true;
        })
        .map(edge => ({ id: `${edge.src}->${edge.dst}:${edge.kind}`, fromNode: edge.src, toNode: edge.dst, label: edge.kind }));
    const canvas = { nodes, edges };
    if (!params.dry_run) {
        mkdirSync(dirname(outputPath), { recursive: true });
        writeFileSync(outputPath, `${JSON.stringify(canvas, null, 2)}\n`, "utf8");
    }
    return {
        status: params.dry_run ? "OK" : "CHANGED",
        reason: params.dry_run ? "dry_run" : "canvas_exported",
        summary: { output_path: outputPath, nodes: nodes.length, edges: edges.length, mode, dry_run: !!params.dry_run },
        canvas: params.dry_run ? canvas : undefined,
    };
}

function groupBy(items, keyFn) {
    const groups = new Map();
    for (const item of items) {
        const key = keyFn(item);
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(item);
    }
    return groups;
}

function renderResearchMap(store, audit) {
    const lines = [
        "<!-- HEX_RESEARCH_GENERATED: source=hex-research-mcp; edit docs/hypotheses, docs/goals, and benchmark/runs instead. -->",
        "# Research Map",
        "",
        "Generated from canonical split researchgraph files.",
        "",
        "## Goals",
        "",
    ];
    for (const goal of store.query("SELECT * FROM goals ORDER BY id").map(rowGoal)) {
        const metric = goal.metrics_current ? "metrics: current" : "metrics: missing";
        lines.push(`- **${goal.id}** (${goal.status}, ${goal.priority || "no priority"}) - ${goal.claim} _${metric}_`);
    }
    lines.push("", "## Hypotheses", "");
    const hypotheses = store.query("SELECT * FROM hypotheses ORDER BY status, priority_tier IS NULL, priority_tier, id").map(h => hypothesisWithDepth(store, h));
    for (const [status, rows] of groupBy(hypotheses, h => h.status)) {
        lines.push(`### ${status}`, "");
        for (const h of rows) {
            lines.push(`- **${h.id}** (tier ${h.priority_tier ?? "n/a"}, evidence ${h.evidence_depth.score}) - ${h.claim}`);
        }
        lines.push("");
    }
    lines.push("## Latest Runs", "");
    for (const run of store.query("SELECT * FROM runs ORDER BY created_at DESC, id DESC LIMIT 10").map(rowRun)) {
        const scope = run.comprehensive ? `comprehensive ${run.goal_ids.join(",")}` : `targeted ${run.hypothesis_id || "n/a"}`;
        lines.push(`- **${run.id}** (${scope}) - ${run.created_at || "unknown date"}`);
    }
    lines.push("", "## Audit Summary", "");
    lines.push(`- Issues: ${audit.summary.issues}`);
    for (const category of audit.summary.categories || []) lines.push(`- ${category}`);
    lines.push("");
    return `${lines.join("\n")}\n`;
}

export function exportResearchMap(params = {}) {
    const opened = ensureIndexed(params.path);
    if (!opened.ok) return opened.payload;
    const { root, store } = opened;
    const outputPath = resolve(root, params.output_path || "docs/research-map.md");
    const dryRun = params.dry_run !== false;
    const existing = existsSync(outputPath) ? readFileSync(outputPath, "utf8") : "";
    if (!dryRun && existing && !existing.includes("HEX_RESEARCH_GENERATED") && !params.force) {
        return {
            status: "UNSUPPORTED",
            reason: "unmarked_research_map_exists",
            summary: "Refusing to overwrite unmarked legacy research-map.md without force: true",
            warnings: [{ code: "unmarked_research_map_exists", message: "Run dry_run first or pass force: true to replace the legacy file." }],
        };
    }
    const audit = auditOrphans({ path: root, limit: 250 });
    const markdown = renderResearchMap(store, audit);
    if (!dryRun) {
        mkdirSync(dirname(outputPath), { recursive: true });
        writeFileSync(outputPath, markdown, "utf8");
    }
    return {
        status: dryRun ? "OK" : "CHANGED",
        reason: dryRun ? "dry_run" : "research_map_exported",
        summary: { output_path: outputPath, dry_run: dryRun, bytes: markdown.length },
        markdown: dryRun ? markdown : undefined,
    };
}

export function normalizeToolError(error) {
    return {
        status: "ERROR",
        reason: "tool_failed",
        summary: error?.message || String(error),
        next_action: "inspect_inputs_and_retry",
        warnings: [{ code: "tool_failed", message: error?.message || String(error) }],
    };
}
