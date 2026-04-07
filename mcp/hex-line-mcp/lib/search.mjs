/**
 * File search via ripgrep with canonical edit-ready blocks.
 * Uses spawn with arg arrays (no shell string interpolation).
 *
 * Output modes:
 *   summary — match counts, top files, and plain snippets
 *   content — edit-ready search blocks (uses rg --json)
 *   files — file paths only (rg -l)
 *   count — match counts per file (rg -c)
 */

import { spawn } from "node:child_process";
import { resolve, isAbsolute } from "node:path";
import { existsSync } from "node:fs";
import { getGraphDB, matchAnnotation, getRelativePath } from "./graph-enrich.mjs";
import { normalizePath } from "./security.mjs";
import {
    buildDiagnosticBlock,
    buildEditReadyBlock,
    serializeDiagnosticBlock,
    serializeSearchBlock,
} from "./block-protocol.mjs";

let rgBin = "rg";
try {
    rgBin = (await import("@vscode/ripgrep")).rgPath;
    if (isAbsolute(rgBin) && !existsSync(rgBin)) rgBin = "rg";
} catch { /* system rg */ }

const DEFAULT_LIMIT = 100;
const DEFAULT_TOTAL_LIMIT_CONTENT = 200;
const DEFAULT_TOTAL_LIMIT_LIST = 1000;
const MAX_OUTPUT = 10 * 1024 * 1024; // 10 MB
const TIMEOUT = 30000; // 30s
const MAX_SEARCH_OUTPUT_CHARS = 80000; // Block-aware cap to prevent CC maxResultSizeChars truncation



/**
 * Spawn ripgrep and collect stdout.
 * Returns { stdout, code, stderr, killed }.
 */
function spawnRg(args) {
    return new Promise((resolve_, reject) => {
        let stdout = "";
        let totalBytes = 0;
        let killed = false;
        let stderrBuf = "";

        const child = spawn(rgBin, args, { timeout: TIMEOUT });

        child.stdout.on("data", (chunk) => {
            totalBytes += chunk.length;
            if (totalBytes > MAX_OUTPUT) {
                killed = true;
                child.kill();
                return;
            }
            stdout += chunk.toString("utf-8");
        });

        child.stderr.on("data", (chunk) => { stderrBuf += chunk.toString("utf-8"); });

        child.on("error", (err) => {
            if (err.code === "ENOENT") {
                reject(new Error(
                    `ripgrep not available. ` +
                    `Reinstall dependencies so @vscode/ripgrep can provide its binary, ` +
                    `or install system rg and add it to PATH. ` +
                    `Attempted binary: "${rgBin}".`
                ));
            } else {
                reject(new Error(`rg spawn error: ${err.message}`));
            }
        });

        child.on("close", (code) => {
            resolve_({ stdout, code, stderr: stderrBuf, killed });
        });
    });
}

/**
 * Search files using ripgrep.
 *
 * @param {string} pattern - regex or literal pattern
 * @param {object} opts
 * @returns {Promise<string>} formatted results
 */
export function grepSearch(pattern, opts = {}) {
    const normPath = normalizePath(opts.path || "");
    const target = normPath ? resolve(normPath) : process.cwd();
    const output = opts.output || "content";
    const plain = !!opts.plain;
    const editReady = !!opts.editReady;
    const defaultTotalLimit = output === "content"
        ? DEFAULT_TOTAL_LIMIT_CONTENT
        : DEFAULT_TOTAL_LIMIT_LIST;
    const totalLimit = opts.totalLimit === 0
        ? 0
        : (opts.totalLimit && opts.totalLimit > 0) ? opts.totalLimit : defaultTotalLimit;

    // Branch by output mode
    if (output === "summary") return summaryMode(pattern, target, opts, totalLimit);
    if (output === "files") return filesMode(pattern, target, opts, totalLimit);
    if (output === "count") return countMode(pattern, target, opts, totalLimit);
    return contentMode(pattern, target, opts, plain, editReady, totalLimit);
}

function applyListModeTotalLimit(lines, totalLimit) {
    if (!totalLimit || totalLimit <= 0 || lines.length <= totalLimit) return lines.join("\n");
    const visible = lines.slice(0, totalLimit);
    visible.push(`OUTPUT_CAPPED: ${lines.length - totalLimit} more result line(s) omitted. Narrow with path= or glob=, or raise total_limit.`);
    return visible.join("\n");
}

/**
 * files mode: rg -l — just file paths.
 */
async function filesMode(pattern, target, opts, totalLimit) {
    // -l + shared flags (without -n/heading/-m since -l ignores them)
    const realArgs = ["-l"];
    if (opts.caseInsensitive) realArgs.push("-i");
    else if (opts.smartCase) realArgs.push("-S");
    if (opts.literal) realArgs.push("-F");
    if (opts.multiline) realArgs.push("-U", "--multiline-dotall");
    if (opts.glob) realArgs.push("--glob", opts.glob);
    if (opts.type) realArgs.push("--type", opts.type);
    realArgs.push("--", pattern, target);

    const { stdout, code, stderr, killed } = await spawnRg(realArgs);
    if (killed) return "GREP_OUTPUT_TRUNCATED: exceeded 10MB. Use specific glob/path.";
    if (code === 1) return "No matches found.";
    if (code !== 0 && code !== null) throw new Error(`GREP_ERROR: rg exit ${code} — ${stderr.trim() || "unknown error"}`);

    const lines = stdout.trimEnd().split("\n").filter(Boolean);
    const normalized = lines.map(l => l.replace(/\\/g, "/"));
    return applyListModeTotalLimit(normalized, totalLimit);
}

/**
 * count mode: rg -c — match counts per file.
 */
async function countMode(pattern, target, opts, totalLimit) {
    const realArgs = ["-c"];
    if (opts.caseInsensitive) realArgs.push("-i");
    else if (opts.smartCase) realArgs.push("-S");
    if (opts.literal) realArgs.push("-F");
    if (opts.multiline) realArgs.push("-U", "--multiline-dotall");
    if (opts.glob) realArgs.push("--glob", opts.glob);
    if (opts.type) realArgs.push("--type", opts.type);
    realArgs.push("--", pattern, target);

    const { stdout, code, stderr, killed } = await spawnRg(realArgs);
    if (killed) return "GREP_OUTPUT_TRUNCATED: exceeded 10MB. Use specific glob/path.";
    if (code === 1) return "No matches found.";
    if (code !== 0 && code !== null) throw new Error(`GREP_ERROR: rg exit ${code} — ${stderr.trim() || "unknown error"}`);

    const lines = stdout.trimEnd().split("\n").filter(Boolean);
    const normalized = lines.map(l => l.replace(/\\/g, "/"));
    return applyListModeTotalLimit(normalized, totalLimit);
}

async function summaryMode(pattern, target, opts, totalLimit) {
    const realArgs = ["-n", "-H", "--no-heading", "--color", "never"];
    if (opts.caseInsensitive) realArgs.push("-i");
    else if (opts.smartCase) realArgs.push("-S");
    if (opts.literal) realArgs.push("-F");
    if (opts.multiline) realArgs.push("-U", "--multiline-dotall");
    if (opts.glob) realArgs.push("--glob", opts.glob);
    if (opts.type) realArgs.push("--type", opts.type);

    const limit = (opts.limit && opts.limit > 0) ? opts.limit : 20;
    realArgs.push("-m", String(limit));
    realArgs.push("--", pattern, target);

    const { stdout, code, stderr, killed } = await spawnRg(realArgs);
    if (killed) return "GREP_OUTPUT_TRUNCATED: exceeded 10MB. Use specific glob/path.";
    if (code === 1) return "No matches found.";
    if (code !== 0 && code !== null) throw new Error(`GREP_ERROR: rg exit ${code} — ${stderr.trim() || "unknown error"}`);

    const rawLines = stdout.trimEnd().split("\n").filter(Boolean);
    const visible = totalLimit > 0 ? rawLines.slice(0, totalLimit) : rawLines;
    const fileHits = new Map();
    const snippets = [];

    for (const line of visible) {
        const match = line.match(/^(.*):(\d+):(.*)$/);
        if (!match) continue;
        const [, file, lineNumber, content] = match;
        fileHits.set(file, (fileHits.get(file) || 0) + 1);
        if (snippets.length < 3) snippets.push(`${file}:${lineNumber}: ${content.trim()}`);
    }

    const topFiles = [...fileHits.entries()]
        .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
        .slice(0, 5);

    const lines = [
        `summary: ${rawLines.length} match event(s) across ${fileHits.size} file(s)`,
        topFiles.length ? `top_files: ${topFiles.map(([file, count]) => `${file} (${count})`).join(", ")}` : "top_files: none",
    ];
    if (snippets.length > 0) {
        lines.push("snippets:");
        lines.push(...snippets.map((snippet) => `- ${snippet}`));
    }
    if (totalLimit > 0 && rawLines.length > totalLimit) {
        lines.push(`continuation_hint: rerun grep_search with a higher total_limit or narrower path/glob to inspect ${rawLines.length - totalLimit} additional match event(s)`);
    }
    return lines.join("\n");
}

/**
 * content mode: rg --json — canonical search blocks.
 */
async function contentMode(pattern, target, opts, plain, editReady, totalLimit) {
    const realArgs = ["--json"];
    const plainOutput = plain || !editReady;
    if (opts.caseInsensitive) realArgs.push("-i");
    else if (opts.smartCase) realArgs.push("-S");
    if (opts.literal) realArgs.push("-F");
    if (opts.multiline) realArgs.push("-U", "--multiline-dotall");
    if (opts.glob) realArgs.push("--glob", opts.glob);
    if (opts.type) realArgs.push("--type", opts.type);
    if (opts.context && opts.context > 0) realArgs.push("-C", String(opts.context));
    if (opts.contextBefore && opts.contextBefore > 0) realArgs.push("-B", String(opts.contextBefore));
    if (opts.contextAfter && opts.contextAfter > 0) realArgs.push("-A", String(opts.contextAfter));

    const limit = (opts.limit && opts.limit > 0) ? opts.limit : DEFAULT_LIMIT;
    realArgs.push("-m", String(limit));
    realArgs.push("--", pattern, target);

    const { stdout, code, stderr, killed } = await spawnRg(realArgs);
    if (killed) return "GREP_OUTPUT_TRUNCATED: exceeded 10MB. Use specific glob/path.";
    if (code === 1) return "No matches found.";
    if (code !== 0 && code !== null) throw new Error(`GREP_ERROR: rg exit ${code} — ${stderr.trim() || "unknown error"}`);

    // Parse NDJSON output
    const jsonLines = stdout.trimEnd().split("\n").filter(Boolean);
    const blocks = [];
    const db = getGraphDB(target);
    const relCache = new Map();

    let groupFile = null;
    let groupEntries = [];
    let matchCount = 0;

    function flushGroup() {
        if (groupEntries.length === 0) return;
        const matchLines = groupEntries
            .filter(entry => entry.role === "match")
            .map(entry => entry.lineNumber);
        // Graph-aware scoring and summary from annotations
        let graphScore = 0;
        let defs = 0;
        let usages = 0;
        for (const entry of groupEntries) {
            if (!entry.annotation) continue;
            const callerMatch = entry.annotation.match(/(\d+)\u2191/);
            if (callerMatch) graphScore += parseInt(callerMatch[1], 10);
            if (/\[fn|\[cls|\[mtd/.test(entry.annotation)) defs++;
            else usages++;
        }
        const summary = (defs || usages) ? `${defs} definition(s), ${usages} usage(s)` : null;
        blocks.push(buildEditReadyBlock({
            path: groupFile,
            kind: "search_hunk",
            entries: groupEntries,
            meta: { matchLines, graphScore, ...(summary ? { summary } : {}) },
        }));
        groupEntries = [];
    }

    for (const jl of jsonLines) {
        let msg;
        try { msg = JSON.parse(jl); } catch { continue; }

        if (msg.type === "begin" || msg.type === "end" || msg.type === "summary") {
            if (msg.type === "end") {
                flushGroup();
                groupFile = null;
            }
            continue;
        }

        if (msg.type !== "match" && msg.type !== "context") continue;

        const data = msg.data;
        const filePath = (data.path?.text || "").replace(/\\/g, "/");
        const lineNum = data.line_number;
        if (!lineNum) continue;

        // Get line content (handle text vs bytes)
        let content = data.lines?.text;
        if (content === undefined && data.lines?.bytes) {
            content = Buffer.from(data.lines.bytes, "base64").toString("utf-8");
        }
        if (content === undefined) continue;

        // Trim trailing newline from rg JSON output
        content = content.replace(/\n$/, "");

        // Handle multiline: split into individual lines
        const subLines = content.split("\n");

        // Track group boundaries
        if (filePath !== groupFile) {
            flushGroup();
            groupFile = filePath;
        }

        for (let i = 0; i < subLines.length; i++) {
            const ln = lineNum + i;
            const lineContent = subLines[i];

            if (groupEntries.length > 0) {
                const lastLn = groupEntries[groupEntries.length - 1].lineNumber;
                if (ln > lastLn + 1) flushGroup();
            }

            const isMatch = msg.type === "match";
            let annotation = "";
            if (db && isMatch) {
                let rel = relCache.get(filePath);
                if (rel === undefined) {
                    rel = getRelativePath(resolve(filePath)) || "";
                    relCache.set(filePath, rel);
                }
                if (rel) {
                    const a = matchAnnotation(db, rel, ln);
                    if (a) annotation = a;
                }
            }
            groupEntries.push({
                lineNumber: ln,
                text: lineContent,
                role: isMatch ? "match" : "context",
                annotation,
            });
        }

        if (msg.type === "match") {
            matchCount++;
            if (totalLimit > 0 && matchCount >= totalLimit) {
                flushGroup();
                blocks.push(buildDiagnosticBlock({
                    kind: "total_limit",
                    message: `Search stopped after ${totalLimit} match event(s). Narrow the query, raise total_limit, or pass total_limit=0 to disable the cap.`,
                    path: String(target).replace(/\\/g, "/"),
                }));
                return blocks
                    .map(block => block.type === "edit_ready_block"
                        ? serializeSearchBlock(block, { plain: plainOutput })
                        : serializeDiagnosticBlock(block))
                    .join("\n\n");
            }
        }
    }

    flushGroup();
    // Graph-aware ranking: sort blocks by graphScore DESC (only reorders when graph DB is available)
    if (db) blocks.sort((a, b) => (b.meta.graphScore || 0) - (a.meta.graphScore || 0));
    // Block-aware output cap: serialize incrementally, stop at budget
    const parts = [];
    let budget = MAX_SEARCH_OUTPUT_CHARS;
    let capped = false;
    for (const block of blocks) {
        const serialized = block.type === "edit_ready_block"
            ? serializeSearchBlock(block, { plain: plainOutput })
            : serializeDiagnosticBlock(block);
        if (parts.length > 0 && budget - serialized.length < 0) {
            capped = true;
            break;
        }
        parts.push(serialized);
        budget -= serialized.length;
    }
    if (capped) {
        const remaining = blocks.length - parts.length;
        parts.push(serializeDiagnosticBlock(buildDiagnosticBlock({
            kind: "output_capped",
            message: `OUTPUT_CAPPED: ${remaining} more search block(s) omitted (${MAX_SEARCH_OUTPUT_CHARS} char limit). Narrow with path= or glob= filters.`,
        })));
    }
    return parts.join("\n\n");
}
