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
import { getGraphDB, matchAnnotation, getRelativePath, ensureGraphFreshForFile } from "./graph-enrich.mjs";
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
const DEFAULT_CONTENT_BLOCK_LIMIT = 12;
const DEFAULT_CONTENT_OUTPUT_CHARS = 12000;
const MAX_OUTPUT = 10 * 1024 * 1024; // 10 MB
const TIMEOUT = 30000; // 30s
const MAX_SEARCH_OUTPUT_CHARS = 80000; // Block-aware cap to prevent CC maxResultSizeChars truncation
const GRAPH_MATCH_ANNOTATION_BUDGET = 12;



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
    const output = opts.output || "summary";
    const plain = !!opts.plain;
    const editReady = !!opts.editReady;
    const allowLargeOutput = !!opts.allowLargeOutput;
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
    return contentMode(pattern, target, opts, plain, editReady, totalLimit, allowLargeOutput);
}

function applyListModeTotalLimit(lines, totalLimit) {
    if (!totalLimit || totalLimit <= 0 || lines.length <= totalLimit) return lines.join("\n");
    const visible = lines.slice(0, totalLimit);
    visible.push(`OUTPUT_CAPPED: ${lines.length - totalLimit} more result line(s) omitted. Narrow with path= or glob=, or raise head_limit.`);
    return visible.join("\n");
}

// Flags shared by every output mode. Mode-specific flags (-l, -c, -n, -C/-B/-A, -m)
// are appended by each caller around this.
function appendCommonRgFlags(args, opts) {
    if (opts.caseInsensitive) args.push("-i");
    else if (opts.smartCase) args.push("-S");
    if (opts.literal) args.push("-F");
    if (opts.multiline) args.push("-U", "--multiline-dotall");
    if (opts.glob) args.push("--glob", opts.glob);
    if (opts.type) args.push("--type", opts.type);
    return args;
}

/**
 * files mode: rg -l — just file paths.
 */
async function filesMode(pattern, target, opts, totalLimit) {
    // -l + shared flags (without -n/heading/-m since -l ignores them)
    const realArgs = ["-l"];
    appendCommonRgFlags(realArgs, opts);
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
    appendCommonRgFlags(realArgs, opts);
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
    appendCommonRgFlags(realArgs, opts);

    const limit = (opts.limit && opts.limit > 0) ? opts.limit : 20;
    realArgs.push("-m", String(limit));
    realArgs.push("--", pattern, target);

    const { stdout, code, stderr, killed } = await spawnRg(realArgs);
    if (killed) return "GREP_OUTPUT_TRUNCATED: exceeded 10MB. Use specific glob/path.";
    if (code === 1) return "No matches found.";
    if (code !== 0 && code !== null) throw new Error(`GREP_ERROR: rg exit ${code} — ${stderr.trim() || "unknown error"}`);

    const rawLines = stdout.trimEnd().split(/\r?\n/).filter(Boolean);
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
    ];
    if (fileHits.size > 1 && topFiles.length) {
        lines.push(`top_files: ${topFiles.map(([file, count]) => `${file} (${count})`).join(", ")}`);
    }
    // snippets prose removed per PROTOCOL.md §Response grammar; escalate to output_mode=content for hunks.
    if (totalLimit > 0 && rawLines.length > totalLimit) {
        lines.push(`truncated: ${rawLines.length - totalLimit}`);
    }
    return lines.join("\n");
}

function buildSearchRefineCall(target, pattern, opts) {
    const args = { path: String(target).replace(/\\/g, "/"), pattern };
    if (opts.glob) args.glob = opts.glob;
    if (opts.type) args.type = opts.type;
    return JSON.stringify({
        tool: "mcp__hex-line__grep_search",
        arguments: {
            ...args,
            output_mode: "summary",
        },
    });
}

/**
 * content mode: rg --json — canonical search blocks.
 */
async function contentMode(pattern, target, opts, plain, editReady, totalLimit, allowLargeOutput) {
    const realArgs = ["--json"];
    const plainOutput = plain || !editReady;
    const shouldUseGraph = editReady && !plain;
    const contentBlockLimit = allowLargeOutput ? Number.POSITIVE_INFINITY : DEFAULT_CONTENT_BLOCK_LIMIT;
    const outputCharBudget = allowLargeOutput ? MAX_SEARCH_OUTPUT_CHARS : DEFAULT_CONTENT_OUTPUT_CHARS;
    appendCommonRgFlags(realArgs, opts);
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
    const db = shouldUseGraph ? getGraphDB(target) : null;
    const relCache = new Map();
    let annotationBudget = GRAPH_MATCH_ANNOTATION_BUDGET;
    const matchedFiles = new Set();

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
        if (msg.type === "match") matchedFiles.add(filePath);

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
            if (db && isMatch && annotationBudget > 0) {
                if (ensureGraphFreshForFile(db, resolve(filePath))) {
                    let rel = relCache.get(filePath);
                    if (rel === undefined) {
                        rel = getRelativePath(resolve(filePath)) || "";
                        relCache.set(filePath, rel);
                    }
                    if (rel) {
                        const a = matchAnnotation(db, rel, ln);
                        if (a) {
                            annotation = a;
                            annotationBudget--;
                        }
                    }
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
                    kind: "head_limit",
                    meta: {
                        total_matches: matchCount,
                        shown_matches: matchCount,
                        file_count: matchedFiles.size,
                        shown_count: blocks.filter(block => block.type === "edit_ready_block").length,
                        truncated: true,
                        next_action: "narrow_search_scope",
                        suggested_refine_call: buildSearchRefineCall(target, pattern, opts),
                    },
                    message: `Search stopped after ${totalLimit} match event(s). Narrow the query, raise head_limit, or pass head_limit=0 to disable the cap.`,
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
    const searchBlocks = blocks.filter(block => block.type === "edit_ready_block");
    const totalSearchBlocks = searchBlocks.length;
    const parts = [];
    let budget = outputCharBudget;
    let capped = false;
    let shownBlocks = 0;
    let shownMatches = 0;
    // Track last emitted file path so consecutive same-file hunks can dedupe the `file:` line.
    let lastPath = null;
    for (const block of blocks) {
        if (block.type === "edit_ready_block" && shownBlocks >= contentBlockLimit) {
            capped = true;
            break;
        }
        const sameFile = block.type === "edit_ready_block" && block.path === lastPath;
        const serialized = block.type === "edit_ready_block"
            ? serializeSearchBlock(block, { plain: plainOutput, skipFile: sameFile })
            : serializeDiagnosticBlock(block);
        if (parts.length > 0 && budget - serialized.length < 0) {
            capped = true;
            break;
        }
        parts.push(serialized);
        budget -= serialized.length;
        if (block.type === "edit_ready_block") {
            shownBlocks++;
            shownMatches += Array.isArray(block.meta.matchLines) ? block.meta.matchLines.length : 0;
            lastPath = block.path;
        } else {
            lastPath = null; // diagnostic interrupts file-grouping
        }
    }
    if (capped) {
        const remaining = Math.max(0, totalSearchBlocks - shownBlocks);
        parts.push(serializeDiagnosticBlock(buildDiagnosticBlock({
            kind: "output_capped",
            path: String(target).replace(/\\/g, "/"),
            meta: {
                total_matches: matchCount,
                shown_matches: shownMatches,
                file_count: matchedFiles.size,
                shown_count: shownBlocks,
                truncated: true,
                next_action: "narrow_search_scope",
                suggested_refine_call: buildSearchRefineCall(target, pattern, opts),
            },
            message: `OUTPUT_CAPPED: ${remaining} more search block(s) omitted (${outputCharBudget} char limit${allowLargeOutput ? "" : `, ${DEFAULT_CONTENT_BLOCK_LIMIT} block default`}). Narrow with path= or glob= filters or pass allow_large_output=true when you intentionally need a larger payload.`,
        })));
    }
    return parts.join("\n\n");
}
