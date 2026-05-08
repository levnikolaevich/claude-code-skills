import { dirname } from "node:path";
import { parseProject } from "./frontmatter-parser.mjs";
import { getStore, resetResearchDb } from "./store.mjs";

const EDGE_KINDS = new Map([
    ["serves_goal", ["hypothesis", "goal"]],
    ["decomposes_goal", ["goal", "goal"]],
    ["parent_of", ["hypothesis", "hypothesis"]],
    ["refines", ["hypothesis", "hypothesis"]],
    ["supersedes", ["hypothesis", "hypothesis"]],
    ["refutes", ["hypothesis", "hypothesis"]],
    ["competes_with", ["hypothesis", "hypothesis"]],
    ["depends_on", ["hypothesis", "hypothesis"]],
    ["blocks", ["hypothesis", "hypothesis"]],
    ["tested_by", ["hypothesis", "run"]],
    ["implemented_in", ["hypothesis", "symbol"]],
    ["runs_in", ["run", "branch_or_commit"]],
    ["gated_by", ["hypothesis", "metric_snapshot"]],
    ["tracked_by", ["hypothesis", "task"]],
    ["cites", [null, "source"]],
    ["achieves", ["goal", "metric_snapshot"]],
]);

function addWarning(warnings, code, message, extra = {}) {
    warnings.push({ code, message, ...extra });
}

export const STRICT_INVALID_CODES = new Set([
    "missing_required_field",
    "invalid_field",
    "frontmatter_validation_failed",
    "duplicate_yaml_key",
    "missing_source_definition",
]);

export const STRICT_FAILURE_CODES = new Set([
    ...STRICT_INVALID_CODES,
    "missing_goal",
    "missing_hypothesis",
]);

function validEdgeKind(kind, srcKind, dstKind) {
    const expected = EDGE_KINDS.get(kind);
    if (!expected) return false;
    return (!expected[0] || expected[0] === srcKind) && expected[1] === dstKind;
}

function insertSource(store, source) {
    store.insertNode(source.id, "source", source.title || source.identifier || source.id, source.raw_payload);
    store.run(`INSERT INTO sources(id, type, title, url, identifier, raw_payload) VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET type = excluded.type, title = excluded.title, url = excluded.url,
        identifier = excluded.identifier, raw_payload = excluded.raw_payload`, [
        source.id, source.type, source.title, source.url, source.identifier, JSON.stringify(source.raw_payload),
    ]);
}

function linkSource(store, nodeId, nodeKind, source) {
    insertSource(store, source);
    store.run("INSERT OR REPLACE INTO node_sources(node_id, node_kind, source_id, notes, accessed_at, cite_extra) VALUES (?, ?, ?, ?, ?, ?)", [
        nodeId, nodeKind, source.id, source.notes, source.accessed_at, JSON.stringify(source.cite_extra ?? {}),
    ]);
    store.insertEdge(nodeId, source.id, nodeKind, "source", "cites", {}, "frontmatter");
}

function insertHypothesis(store, item, warnings) {
    const h = item.data;
    store.insertFile(item.file, "hypothesis", item.hash);
    store.insertNode(h.id, "hypothesis", h.claim, { file: item.file, status: h.status });
    store.run(`INSERT OR REPLACE INTO hypotheses(
        id, file, claim, category, status, priority_tier, prior_belief, confidence_post,
        created_at, promoted_at, rejected_at, last_touched, raw_frontmatter
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
        h.id, item.file, h.claim || "", h.category || "", h.status || "not_started",
        h.priority_tier ?? null, h.prior_belief ?? null, h.confidence_post ?? null,
        h.created_at || null, h.promoted_at || null, h.rejected_at || null, h.last_touched || null, JSON.stringify(h),
    ]);
    store.run("INSERT INTO hypothesis_fts(id, claim, mechanism, tags) VALUES (?, ?, ?, ?)", [
        h.id, h.claim || "", h.mechanism || "", Array.isArray(h.tags) ? h.tags.join(" ") : "",
    ]);
    for (const goal of h.goals || []) {
        const existingGoal = store.one("SELECT id FROM goals WHERE id = ?", [goal]);
        if (!existingGoal) {
            addWarning(warnings, "missing_goal", `${h.id}: referenced goal ${goal} does not exist`, { id: h.id, details: { goal_id: goal } });
            continue;
        }
        store.run("INSERT OR REPLACE INTO hypothesis_goals(hypothesis_id, goal_id, contribution) VALUES (?, ?, ?)", [
            h.id, goal, JSON.stringify(h.goal_contribution?.[goal] ?? null),
        ]);
        store.insertEdge(h.id, goal, "hypothesis", "goal", "serves_goal", h.goal_contribution?.[goal] ?? {}, "frontmatter");
    }
    for (const parent of h.parents || []) store.insertEdge(parent, h.id, "hypothesis", "hypothesis", "parent_of", {}, "frontmatter");
    for (const parent of h.parents || []) store.insertEdge(h.id, parent, "hypothesis", "hypothesis", "refines", {}, "frontmatter");
    for (const old of h.supersedes || []) store.insertEdge(h.id, old, "hypothesis", "hypothesis", "supersedes", {}, "frontmatter");
    for (const target of h.refutes || []) store.insertEdge(h.id, target, "hypothesis", "hypothesis", "refutes", {}, "frontmatter");
    for (const other of h.competes_with || []) {
        store.insertEdge(h.id, other, "hypothesis", "hypothesis", "competes_with", {}, "frontmatter");
        store.insertEdge(other, h.id, "hypothesis", "hypothesis", "competes_with", {}, "frontmatter");
    }
    for (const blocker of h.blocked_by || []) {
        store.insertEdge(h.id, blocker, "hypothesis", "hypothesis", "depends_on", {}, "frontmatter");
        store.insertEdge(blocker, h.id, "hypothesis", "hypothesis", "blocks", {}, "derived");
    }
    for (const symbol of h.implementation?.symbols || []) {
        store.insertNode(symbol, "symbol", symbol, { source: "implementation.symbols" });
        store.run("INSERT OR REPLACE INTO hypothesis_symbols(hypothesis_id, workspace_qualified_name, confidence) VALUES (?, ?, ?)", [h.id, symbol, "exact"]);
        store.insertEdge(h.id, symbol, "hypothesis", "symbol", "implemented_in", { confidence: "exact" }, "frontmatter");
    }
    for (const [level, metric] of Object.entries(h.gate?.results || {})) {
        const metricId = `${h.id}:${level}`;
        store.insertNode(metricId, "metric_snapshot", metricId, metric);
        store.insertEdge(h.id, metricId, "hypothesis", "metric_snapshot", "gated_by", metric, "frontmatter");
    }
    for (const task of h.tasks || []) {
        if (!task.id || !task.tracker_id || !task.title || !task.type || !task.state || !task.state_snapshot_at) {
            continue;
        }
        store.insertNode(task.id, "task", task.title, task.raw);
        store.run(`INSERT INTO tasks(id, system, tracker_id, url, type, title, state, state_snapshot_at, created_at, closed_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET system = excluded.system, tracker_id = excluded.tracker_id,
            url = excluded.url, type = excluded.type, title = excluded.title, state = excluded.state,
            state_snapshot_at = excluded.state_snapshot_at, created_at = excluded.created_at, closed_at = excluded.closed_at`, [
            task.id, task.system, task.tracker_id, task.url, task.type, task.title, task.state, task.state_snapshot_at, task.created_at, task.closed_at,
        ]);
        store.run("INSERT OR REPLACE INTO hypothesis_tasks(hypothesis_id, task_id) VALUES (?, ?)", [h.id, task.id]);
        store.insertEdge(h.id, task.id, "hypothesis", "task", "tracked_by", { system: task.system, type: task.type, state: task.state }, "frontmatter");
    }
    for (const evidence of h.evidence || []) {
        if (!evidence?.type || !evidence?.ref) continue;
        store.run("INSERT INTO evidence(hypothesis_id, type, ref, date, summary, properties) VALUES (?, ?, ?, ?, ?, ?)", [
            h.id, evidence.type, evidence.ref, evidence.date || null, evidence.summary || null, JSON.stringify(evidence),
        ]);
    }
    for (const source of h.sources || []) linkSource(store, h.id, "hypothesis", source);
}

function insertGoal(store, item) {
    const g = item.data;
    store.insertFile(item.file, "goal", item.hash);
    store.insertNode(g.id, "goal", g.claim, { file: item.file, status: g.status });
    store.run(`INSERT OR REPLACE INTO goals(
        id, file, claim, status, priority, deadline, metrics_target, metrics_current,
        achieved_at, created_at, last_touched, raw_frontmatter
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
        g.id, item.file, g.claim || "", g.status || "active", g.priority || null, g.deadline || null,
        JSON.stringify(g.metrics_target || {}), null, null, g.created_at || null, g.last_touched || null, JSON.stringify(g),
    ]);
    store.run("INSERT INTO goal_fts(id, claim, rationale) VALUES (?, ?, ?)", [g.id, g.claim || "", g.rationale || ""]);
    for (const parent of g.parents || []) store.insertEdge(parent, g.id, "goal", "goal", "decomposes_goal", {}, "frontmatter");
    for (const source of g.sources || []) linkSource(store, g.id, "goal", source);
}

function insertRun(store, item) {
    const r = item.data;
    store.insertFile(item.file, "run_manifest", item.hash);
    store.insertNode(r.id, "run", r.id, { type: r.type, comprehensive: r.comprehensive });
    if (r.branch) store.insertNode(r.branch, "branch_or_commit", r.branch, { kind: "branch" });
    if (r.git_commit) store.insertNode(r.git_commit, "branch_or_commit", r.git_commit, { kind: "git_commit" });
    store.run(`INSERT OR REPLACE INTO runs(
        id, hypothesis_id, goal_ids, comprehensive, included_hypotheses, branch, type,
        manifest_file, artifact_dir, created_at, git_commit, metrics, raw_manifest
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
        r.id, r.hypothesis || null, JSON.stringify(r.goals || []), r.comprehensive ? 1 : 0,
        JSON.stringify(r.included_hypotheses || []), r.branch || null, r.type || "",
        item.file, dirname(item.file), r.created_at || "", r.git_commit || null, JSON.stringify(r.metrics || {}), JSON.stringify(r),
    ]);
    if (r.hypothesis) store.insertEdge(r.hypothesis, r.id, "hypothesis", "run", "tested_by", { type: r.type }, "frontmatter");
    if (r.branch) store.insertEdge(r.id, r.branch, "run", "branch_or_commit", "runs_in", {}, "frontmatter");
    if (r.git_commit) store.insertEdge(r.id, r.git_commit, "run", "branch_or_commit", "runs_in", {}, "frontmatter");
}

function aggregateGoalMetrics(store, warnings) {
    const goals = store.query("SELECT id, metrics_target FROM goals");
    for (const goal of goals) {
        const live = store.query(`SELECT h.id FROM hypotheses h JOIN hypothesis_goals hg ON hg.hypothesis_id = h.id WHERE hg.goal_id = ? AND h.status = 'live'`, [goal.id]).map(r => r.id);
        const runs = store.query("SELECT * FROM runs WHERE comprehensive = 1 ORDER BY created_at DESC");
        const match = runs.find(run => {
            const goals = store.json(run.goal_ids, []);
            const included = new Set(store.json(run.included_hypotheses, []));
            return goals.includes(goal.id) && live.every(id => included.has(id));
        });
        if (!match) {
            addWarning(warnings, "no_comprehensive_run_for_goal", `No comprehensive run covers ${goal.id}`, { id: goal.id });
            continue;
        }
        const metrics = store.json(match.metrics, {});
        const current = { source: "comprehensive_run", run_id: match.id, git_commit: match.git_commit, metrics };
        store.run("UPDATE goals SET metrics_current = ? WHERE id = ?", [JSON.stringify(current), goal.id]);
        const metricId = `${goal.id}:metrics_current`;
        store.insertNode(metricId, "metric_snapshot", metricId, current);
        store.insertEdge(goal.id, metricId, "goal", "metric_snapshot", "achieves", current, "derived");
    }
}

export function auditTaskInvariants(store) {
    const warnings = [];
    const hypotheses = store.query("SELECT * FROM hypotheses");
    for (const h of hypotheses) {
        const raw = store.json(h.raw_frontmatter, {});
        const tasks = store.query(`SELECT t.* FROM tasks t JOIN hypothesis_tasks ht ON ht.task_id = t.id WHERE ht.hypothesis_id = ?`, [h.id]);
        const openImpl = tasks.some(t => t.type === "implementation" && ["open", "in_progress"].includes(t.state));
        const doneImpl = tasks.some(t => t.type === "implementation" && t.state === "done");
        const openRefine = tasks.some(t => t.type === "refinement" && ["open", "in_progress"].includes(t.state));
        const openAny = tasks.some(t => ["open", "in_progress"].includes(t.state));
        const decision = raw.last_verdict?.decision;
        if (h.status === "pending_implementation" && !openImpl) {
            addWarning(warnings, "implementation_gap", `${h.id}: pending_implementation requires open/in_progress implementation task`, { id: h.id });
        }
        if (h.status === "live" && !doneImpl) addWarning(warnings, "task_drift", `${h.id}: live requires done implementation task`, { id: h.id });
        if (h.status === "live" && openAny) addWarning(warnings, "task_drift", `${h.id}: live has open/in_progress task`, { id: h.id });
        if (h.status === "in_progress" && decision === "refine" && !openRefine) {
            addWarning(warnings, "implementation_gap", `${h.id}: refine verdict requires open/in_progress refinement task`, { id: h.id });
        }
        if (h.status === "in_progress" && ["proceed", "reject", "hold"].includes(decision)) {
            addWarning(warnings, "status_verdict_drift", `${h.id}: non-refine verdict must transition status`, { id: h.id });
        }
        if (h.status === "validated_branch" && ["proceed", "refine", "reject", "hold"].includes(decision)) {
            addWarning(warnings, "status_verdict_drift", `${h.id}: validated_branch verdict must transition status`, { id: h.id });
        }
        if (decision === "reject" && h.status !== "rejected") addWarning(warnings, "status_verdict_drift", `${h.id}: reject verdict must transition to rejected`, { id: h.id });
        if (decision === "hold" && h.status !== "deferred") addWarning(warnings, "status_verdict_drift", `${h.id}: hold verdict must transition to deferred`, { id: h.id });
        for (const task of tasks) {
            const at = Date.parse(task.state_snapshot_at);
            if (Number.isFinite(at) && Date.now() - at > 30 * 24 * 60 * 60 * 1000) {
                addWarning(warnings, "task_status_stale", `${h.id}: task ${task.id} status snapshot is stale`, { id: h.id, details: { task_id: task.id } });
            }
        }
    }
    return warnings;
}

export function auditGraphInvariants(store) {
    const warnings = [];
    const edges = store.query("SELECT * FROM edges");
    for (const edge of edges) {
        if (!validEdgeKind(edge.kind, edge.src_kind, edge.dst_kind)) {
            addWarning(warnings, "edge_kind_mismatch", `${edge.kind}: ${edge.src_kind}->${edge.dst_kind}`, { details: edge });
        }
    }
    return warnings;
}

export function indexProject(projectPath) {
    const parsed = parseProject(projectPath);
    resetResearchDb(projectPath);
    const store = getStore(projectPath);
    const warnings = [...parsed.warnings];
    const transaction = store.db.transaction(() => {
        store.clear();
        for (const goal of parsed.goals) store.insertNode(goal.data.id, "goal", goal.data.claim, {});
        for (const hyp of parsed.hypotheses) store.insertNode(hyp.data.id, "hypothesis", hyp.data.claim, {});
        for (const run of parsed.runs) store.insertNode(run.data.id, "run", run.data.id, {});
        for (const goal of parsed.goals) insertGoal(store, goal);
        for (const hyp of parsed.hypotheses) insertHypothesis(store, hyp, warnings);
        for (const run of parsed.runs) insertRun(store, run);
        aggregateGoalMetrics(store, warnings);
    });
    transaction();
    warnings.push(...auditTaskInvariants(store), ...auditGraphInvariants(store));
    const invalid = warnings.filter(w => STRICT_INVALID_CODES.has(w.code));
    return {
        status: invalid.length ? "INVALID" : "OK",
        reason: invalid.length ? "frontmatter_validation_failed" : "indexed",
        summary: {
            hypotheses: parsed.hypotheses.length,
            goals: parsed.goals.length,
            runs: parsed.runs.length,
            warnings: warnings.length,
            invalid: invalid.length,
        },
        warnings,
    };
}

export function verifyProject(projectPath) {
    const parsed = parseProject(projectPath);
    const warnings = [...parsed.warnings];
    const goalIds = new Set(parsed.goals.map(g => g.data.id));
    const hypothesisIds = new Set(parsed.hypotheses.map(h => h.data.id));
    for (const h of parsed.hypotheses) {
        for (const goal of h.data.goals || []) {
            if (!goalIds.has(goal)) addWarning(warnings, "missing_goal", `${h.data.id}: referenced goal ${goal} does not exist`, { id: h.data.id, details: { goal_id: goal } });
        }
        for (const field of ["parents", "supersedes", "competes_with", "refutes", "blocked_by"]) {
            for (const target of h.data[field] || []) {
                if (!hypothesisIds.has(target)) addWarning(warnings, "missing_hypothesis", `${h.data.id}: referenced hypothesis ${target} does not exist`, { id: h.data.id, details: { field, hypothesis_id: target } });
            }
        }
    }
    for (const run of parsed.runs) {
        if (run.data.hypothesis && !hypothesisIds.has(run.data.hypothesis)) {
            addWarning(warnings, "missing_hypothesis", `${run.data.id}: referenced hypothesis ${run.data.hypothesis} does not exist`, { id: run.data.id, details: { hypothesis_id: run.data.hypothesis } });
        }
        for (const goal of run.data.goals || []) {
            if (!goalIds.has(goal)) addWarning(warnings, "missing_goal", `${run.data.id}: referenced goal ${goal} does not exist`, { id: run.data.id, details: { goal_id: goal } });
        }
        for (const hypothesis of run.data.included_hypotheses || []) {
            if (!hypothesisIds.has(hypothesis)) addWarning(warnings, "missing_hypothesis", `${run.data.id}: included hypothesis ${hypothesis} does not exist`, { id: run.data.id, details: { hypothesis_id: hypothesis } });
        }
    }
    const invalid = warnings.filter(w => STRICT_INVALID_CODES.has(w.code));
    return {
        status: invalid.length ? "INVALID" : "OK",
        reason: invalid.length ? "frontmatter_validation_failed" : "verified",
        summary: {
            hypotheses: parsed.hypotheses.length,
            goals: parsed.goals.length,
            runs: parsed.runs.length,
            warnings: warnings.length,
            invalid: invalid.length,
        },
        warnings,
    };
}
