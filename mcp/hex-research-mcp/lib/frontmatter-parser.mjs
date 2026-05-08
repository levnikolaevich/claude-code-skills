import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import matter from "gray-matter";
import { createHash } from "node:crypto";
import { discoverResearchFiles } from "./discovery.mjs";
import { GOAL_STATUSES, HYPOTHESIS_STATUSES, TASK_STATES, TASK_TYPES } from "./constants.mjs";

function hashText(text) {
    return createHash("sha256").update(text).digest("hex");
}

function scalar(raw) {
    const value = String(raw ?? "").trim();
    if (value === "null" || value === "~") return null;
    if (value === "true") return true;
    if (value === "false") return false;
    if (/^-?\d+(\.\d+)?$/.test(value)) return Number(value);
    if ((value.startsWith("\"") && value.endsWith("\"")) || (value.startsWith("'") && value.endsWith("'"))) {
        return value.slice(1, -1);
    }
    if (value.startsWith("[") && value.endsWith("]")) {
        const inner = value.slice(1, -1).trim();
        if (!inner) return [];
        return inner.split(",").map(part => normalizeId(scalar(part)));
    }
    if (value.startsWith("{") && value.endsWith("}")) {
        const obj = {};
        const inner = value.slice(1, -1).trim();
        if (!inner) return obj;
        for (const part of inner.split(",")) {
            const idx = part.indexOf(":");
            if (idx === -1) continue;
            obj[part.slice(0, idx).trim()] = scalar(part.slice(idx + 1));
        }
        return obj;
    }
    return normalizeId(value);
}

// Conservative YAML subset for committed run manifests. Markdown frontmatter is
// parsed by gray-matter; this only covers the simple map/list shape in fixtures
// and expected benchmark manifests.
export function parseYamlLite(text) {
    const root = {};
    const stack = [{ indent: -1, value: root }];
    const lines = String(text).split(/\r?\n/);
    for (let i = 0; i < lines.length; i += 1) {
        const raw = lines[i];
        if (!raw.trim() || raw.trimStart().startsWith("#")) continue;
        const indent = raw.match(/^\s*/)[0].length;
        const line = raw.trim();
        while (stack.length > 1 && indent <= stack.at(-1).indent) stack.pop();
        const parent = stack.at(-1).value;
        if (line.startsWith("- ")) {
            if (!Array.isArray(parent)) continue;
            const body = line.slice(2);
            if (body.includes(":")) {
                const obj = {};
                parent.push(obj);
                const [key, rest] = body.split(/:(.*)/s);
                obj[key.trim()] = rest.trim() ? scalar(rest) : {};
                stack.push({ indent, value: obj });
                if (!rest.trim()) stack.push({ indent: indent + 2, value: obj[key.trim()] });
            } else {
                parent.push(scalar(body));
            }
            continue;
        }
        const [key, rest = ""] = line.split(/:(.*)/s);
        const trimmedKey = key.trim();
        const valueText = rest.trim();
        let value;
        if (!valueText) {
            const next = lines.slice(i + 1).find(l => l.trim() && !l.trimStart().startsWith("#"));
            value = next && next.match(/^\s*/)[0].length > indent && next.trim().startsWith("- ") ? [] : {};
        } else {
            value = scalar(valueText);
        }
        parent[trimmedKey] = value;
        if (typeof value === "object" && value !== null) stack.push({ indent, value });
    }
    return root;
}

export function normalizeId(value) {
    if (typeof value !== "string") return value;
    const trimmed = value.trim();
    const wiki = /^\[\[([^\]]+)]]$/.exec(trimmed);
    return wiki ? wiki[1].trim() : trimmed;
}

function asArray(value) {
    if (value === undefined || value === null) return [];
    return Array.isArray(value) ? value.map(normalizeId) : [normalizeId(value)];
}

function warning(code, message, file, details = {}) {
    return { code, message, file, details };
}

function required(data, fields, file, warnings) {
    for (const field of fields) {
        if (data[field] === undefined || data[field] === null || data[field] === "" ||
            (Array.isArray(data[field]) && data[field].length === 0)) {
            warnings.push(warning("missing_required_field", `${file}: field '${field}' is required`, file, { field }));
        }
    }
}

function normalizeTask(task, file, warnings) {
    const system = task.system || "other";
    const trackerId = task.id;
    const id = `${system}:${trackerId}`;
    const snapshot = task.status_snapshot || {};
    const state = snapshot.state || "open";
    const at = snapshot.at || task.created_at;
    if (!trackerId) warnings.push(warning("missing_required_field", `${file}: tasks[].id is required`, file, { field: "tasks[].id" }));
    if (!task.title) warnings.push(warning("missing_required_field", `${file}: tasks[].title is required`, file, { field: "tasks[].title" }));
    if (!TASK_TYPES.includes(task.type)) warnings.push(warning("invalid_field", `${file}: tasks[].type is invalid`, file, { field: "tasks[].type" }));
    if (!TASK_STATES.includes(state)) warnings.push(warning("invalid_field", `${file}: tasks[].status_snapshot.state is invalid`, file, { field: "tasks[].status_snapshot.state" }));
    if (!at) warnings.push(warning("missing_required_field", `${file}: tasks[].status_snapshot.at or tasks[].created_at is required`, file, { field: "tasks[].status_snapshot.at" }));
    if ((state === "done" || state === "cancelled") && !task.closed_at) {
        warnings.push(warning("missing_required_field", `${file}: tasks[].closed_at is required for done/cancelled tasks`, file, { field: "tasks[].closed_at" }));
    }
    return {
        id,
        tracker_id: trackerId,
        system,
        url: task.url || null,
        type: task.type,
        title: task.title,
        state,
        state_snapshot_at: at,
        created_at: task.created_at || null,
        closed_at: task.closed_at || null,
        raw: task,
    };
}

function sourceIdentity(source) {
    const payload = {
        type: source.type,
        doi: source.doi,
        arxiv_id: source.arxiv_id,
        isbn: source.isbn,
        url: source.url,
        ref: source.ref,
        repo: source.repo,
        commit: source.commit,
        title: source.title,
        authors: source.authors,
        year: source.year,
        source: source.source,
        name: source.name,
        snapshot_date: source.snapshot_date,
    };
    return `source:${hashText(JSON.stringify(payload))}`;
}

function normalizeSources(rawSources = []) {
    return asArray(rawSources).filter(v => v && typeof v === "object").map(source => ({
        id: sourceIdentity(source),
        type: source.type || "website",
        title: source.title || source.name || source.ref || null,
        url: source.url || null,
        identifier: source.doi || source.arxiv_id || source.isbn || source.ref || source.repo || source.url || source.name || null,
        raw_payload: source,
        notes: source.notes || null,
        accessed_at: source.accessed_at || null,
        cite_extra: {
            timestamp: source.timestamp,
            pages: source.pages,
        },
    }));
}

function parseHypothesis(projectPath, file) {
    const abs = join(projectPath, file);
    const text = readFileSync(abs, "utf8");
    const parsed = matter(text);
    const data = parsed.data || {};
    const warnings = [];
    required(data, ["id", "claim", "category", "status", "goals", "mechanism", "created_at", "last_touched"], file, warnings);
    for (const field of ["parents", "supersedes", "competes_with", "refutes", "blocked_by"]) {
        if (data[field] === undefined) warnings.push(warning("missing_required_field", `${file}: field '${field}' is required`, file, { field }));
    }
    if (data.status && !HYPOTHESIS_STATUSES.includes(data.status)) {
        warnings.push(warning("invalid_field", `${file}: status '${data.status}' is invalid`, file, { field: "status" }));
    }
    return {
        kind: "hypothesis",
        file,
        hash: hashText(text),
        content: parsed.content,
        data: {
            ...data,
            id: normalizeId(data.id),
            goals: asArray(data.goals),
            parents: asArray(data.parents),
            supersedes: asArray(data.supersedes),
            competes_with: asArray(data.competes_with),
            refutes: asArray(data.refutes),
            blocked_by: asArray(data.blocked_by),
            runs: asArray(data.runs),
            evidence: asArray(data.evidence),
            tasks: asArray(data.tasks).filter(v => v && typeof v === "object").map(task => normalizeTask(task, file, warnings)),
            sources: normalizeSources(data.sources),
        },
        warnings,
    };
}

function parseGoal(projectPath, file) {
    const abs = join(projectPath, file);
    const text = readFileSync(abs, "utf8");
    const parsed = matter(text);
    const data = parsed.data || {};
    const warnings = [];
    required(data, ["id", "claim", "status", "metrics_target", "created_at", "last_touched"], file, warnings);
    if (data.metrics_current !== undefined || data.children !== undefined || data.achievement_status !== undefined) {
        warnings.push(warning("derived_field_in_source", `${file}: derived goal fields must not be written manually`, file));
    }
    if (data.status && !GOAL_STATUSES.includes(data.status)) {
        warnings.push(warning("invalid_field", `${file}: goal status '${data.status}' is invalid`, file, { field: "status" }));
    }
    return {
        kind: "goal",
        file,
        hash: hashText(text),
        content: parsed.content,
        data: {
            ...data,
            id: normalizeId(data.id),
            parents: asArray(data.parents),
            sources: normalizeSources(data.sources),
        },
        warnings,
    };
}

function parseRun(projectPath, file) {
    const abs = join(projectPath, file);
    const text = readFileSync(abs, "utf8");
    const data = parseYamlLite(text);
    const warnings = [];
    required(data, ["id", "type", "created_at", "results_path"], file, warnings);
    const comprehensive = !!data.comprehensive;
    if (comprehensive) {
        if (data.hypothesis !== null && data.hypothesis !== undefined) {
            warnings.push(warning("run_hypothesis_drift", `${file}: comprehensive run must use hypothesis: null or omit it`, file));
        }
        required(data, ["goals", "included_hypotheses"], file, warnings);
    }
    let metrics = data.metrics || {};
    const resultsPath = data.results_path ? join(dirname(abs), data.results_path) : null;
    if (resultsPath && existsSync(resultsPath)) {
        try { metrics = JSON.parse(readFileSync(resultsPath, "utf8")); }
        catch { warnings.push(warning("invalid_field", `${file}: results_path is not valid JSON`, file, { field: "results_path" })); }
    }
    return {
        kind: "run",
        file,
        hash: hashText(text),
        data: {
            ...data,
            id: normalizeId(data.id),
            hypothesis: data.hypothesis === null ? null : normalizeId(data.hypothesis),
            goals: asArray(data.goals),
            included_hypotheses: asArray(data.included_hypotheses),
            comprehensive,
            metrics,
        },
        warnings,
    };
}

export function parseProject(projectPath) {
    const discovered = discoverResearchFiles(projectPath);
    const parsed = { hypotheses: [], goals: [], runs: [], warnings: [] };
    for (const file of discovered.hypotheses) {
        try {
            const item = parseHypothesis(projectPath, file);
            parsed.hypotheses.push(item);
            parsed.warnings.push(...item.warnings);
        } catch (error) {
            parsed.warnings.push(warning("frontmatter_validation_failed", `${file}: ${error.message}`, file));
        }
    }
    for (const file of discovered.goals) {
        try {
            const item = parseGoal(projectPath, file);
            parsed.goals.push(item);
            parsed.warnings.push(...item.warnings);
        } catch (error) {
            parsed.warnings.push(warning("frontmatter_validation_failed", `${file}: ${error.message}`, file));
        }
    }
    for (const file of discovered.runs) {
        try {
            const item = parseRun(projectPath, file);
            parsed.runs.push(item);
            parsed.warnings.push(...item.warnings);
        } catch (error) {
            parsed.warnings.push(warning("frontmatter_validation_failed", `${file}: ${error.message}`, file));
        }
    }
    return parsed;
}
