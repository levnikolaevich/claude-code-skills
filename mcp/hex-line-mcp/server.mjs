#!/usr/bin/env node
/**
 * hex-line-mcp — MCP server for hash-verified file operations.
 *
 * 9 tools: inspect_path, read_file, edit_file, write_file, grep_search, outline, verify, changes, bulk_replace
 * FNV-1a 2-char tags + range checksums
 * Security: root policy, path validation, binary/size rejection
 * Transport: stdio
 */

import { writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
const version = typeof __HEX_VERSION__ !== "undefined" ? __HEX_VERSION__ // eslint-disable-line no-undef
  : (await import("node:module")).createRequire(import.meta.url)("./package.json").version;
import { z } from "zod";
import { createServerRuntime } from "@levnikolaevich/hex-common/runtime/mcp-bootstrap";
import { flexBool, flexNum } from "@levnikolaevich/hex-common/runtime/schema";
import { checkForUpdates } from "@levnikolaevich/hex-common/runtime/update-check";
// LLM clients may send booleans as strings ("true"/"false").
// z.coerce.boolean() is unsafe: Boolean("false") === true.
// LLM clients may send numbers as strings ("5" instead of 5).
// z.coerce.number() generates {"type":"number"} → strict MCP clients reject strings.
// flexNum generates schema accepting both, coerces at runtime.
// Outer .optional() ensures JSON Schema marks field as not-required.

import { readFile } from "./lib/read.mjs";
import { editFile } from "./lib/edit.mjs";
import { grepSearch } from "./lib/search.mjs";
import { fileOutline } from "./lib/outline.mjs";
import { verifyChecksums } from "./lib/verify.mjs";
import { assertProjectScopedPath, validateWritePath } from "./lib/security.mjs";
import { inspectPath } from "./lib/inspect-path.mjs";
import { fileInfo } from "./lib/info.mjs";
import { autoSync } from "./lib/setup.mjs";
import { fileChanges } from "./lib/changes.mjs";
import { bulkReplace } from "./lib/bulk-replace.mjs";
import { result, errorResult } from "@levnikolaevich/hex-common/runtime/results";
import { STATUS_VALUES } from "./lib/output-contract.mjs";

// Shared output schema fragments for all tools
const STATUS_ENUM = z.enum(STATUS_VALUES);
const ERROR_SHAPE = z.object({ code: z.string(), message: z.string(), recovery: z.string() }).optional();
const ERROR_RESULT_FIELDS = {
    code: z.string().optional(),
    summary: z.string().optional(),
    next_action: z.string().optional(),
    recovery: z.string().optional(),
    failure_class: z.string().optional(),
    error: ERROR_SHAPE,
};
const LINE_REPORT_KEYS = new Set([
    "status",
    "reason",
    "revision",
    "file",
    "path",
    "compare_against",
    "scope",
    "summary",
    "next_action",
    "changed_ranges",
    "recovery_ranges",
    "retry_checksum",
    "retry_edit",
    "retry_edits",
    "suggested_read_call",
    "retry_plan",
    "remapped_refs",
    "warnings",
]);

const EDIT_PAYLOAD_TYPES = ["set_line", "insert_after", "replace_lines", "replace_between"];
const EDIT_REQUIRED_FIELDS = {
    set_line: ["anchor", "new_text"],
    insert_after: ["anchor", "text"],
    replace_lines: ["start_anchor", "end_anchor", "new_text"],
    replace_between: ["start_anchor", "end_anchor", "new_text"],
};

function inputError(code, message, recovery) {
    const error = new Error(message);
    error.code = code;
    error.recovery = recovery;
    return error;
}

function validateEditPayload(edits) {
    if (!Array.isArray(edits) || edits.length === 0) {
        throw inputError("INVALID_EDIT_PAYLOAD", "BAD_INPUT: edits must be a non-empty JSON array", "Pass canonical edit objects such as {\"set_line\":{\"anchor\":\"ab.12\",\"new_text\":\"...\"}}");
    }
    edits.forEach((edit, index) => {
        if (!edit || typeof edit !== "object" || Array.isArray(edit)) {
            throw inputError("INVALID_EDIT_PAYLOAD", `BAD_INPUT: edit at index ${index} must be an object`, "Use one canonical edit object per array item");
        }
        const keys = EDIT_PAYLOAD_TYPES.filter((type) => Object.prototype.hasOwnProperty.call(edit, type));
        if (keys.length === 0) {
            throw inputError("INVALID_EDIT_PAYLOAD", `BAD_INPUT: unknown edit type at index ${index}`, "Use set_line, insert_after, replace_lines, or replace_between");
        }
        if (keys.length > 1) {
            throw inputError("INVALID_EDIT_PAYLOAD", `BAD_INPUT: edit at index ${index} has multiple edit types`, "Use exactly one edit type per object");
        }
        const [type] = keys;
        const payload = edit[type];
        if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
            throw inputError("INVALID_EDIT_PAYLOAD", `BAD_INPUT: ${type} payload at index ${index} must be an object`, "Nest fields under the canonical edit type");
        }
        for (const field of EDIT_REQUIRED_FIELDS[type]) {
            if (typeof payload[field] !== "string") {
                throw inputError("INVALID_EDIT_PAYLOAD", `BAD_INPUT: ${type}.${field} must be a string at index ${index}`, "Provide all required canonical edit fields before retrying");
            }
        }
    });
}

const { server, StdioServerTransport } = await createServerRuntime({
    name: "hex-line-mcp",
    version,
});


// --- Shared schemas ---

const replacementPairsSchema = z.array(
    z.object({ old: z.string().min(1), new: z.string() })
).min(1);

const readRangeSchema = z.union([
    z.string(),
    z.object({
        start: flexNum().optional(),
        end: flexNum().optional(),
    }),
]);

function parseReadRanges(rawRanges) {
    if (!rawRanges) return undefined;
    const parsed = Array.isArray(rawRanges) ? rawRanges : JSON.parse(rawRanges);
    if (!Array.isArray(parsed) || parsed.length === 0) {
        throw new Error("ranges must be a non-empty array");
    }
    return parsed;
}

function parseLineReport(content) {
    const parsed = {};
    for (const rawLine of String(content).split(/\r?\n/)) {
        if (!rawLine.trim()) break;
        const match = /^([a-z_]+):\s*(.*)$/.exec(rawLine);
        if (!match) continue;
        const [, key, value] = match;
        if (!LINE_REPORT_KEYS.has(key) || parsed[key] !== undefined) continue;
        if (key === "warnings") {
            try { parsed[key] = JSON.parse(value); }
            catch { parsed[key] = value; }
        } else {
            parsed[key] = value;
        }
    }
    return parsed;
}

function lineReportResult(base, content, opts = {}) {
    const report = parseLineReport(content);
    return result({
        status: report.status || base.status || "OK",
        ...base,
        ...report,
        content,
    }, opts);
}

// ==================== read_file ====================

server.registerTool("read_file", {
    title: "Read File",
    description: "Read file with progressive disclosure. Default: minimal plain partial read for discovery; enable edit-ready metadata explicitly when preparing a verified edit.",
    inputSchema: z.object({
        file_path: z.string().optional().describe("File path"),
        file_paths: z.array(z.string()).optional().describe("Array of file paths to read (batch mode)"),
        offset: flexNum().describe("Start line (1-indexed, default: 1)"),
        limit: flexNum().describe("Max lines (default: 200 for discovery, 2000 for edit-ready, 0 = all)"),
        ranges: z.union([z.string(), z.array(readRangeSchema)]).optional().describe('Line ranges, e.g. ["10-25", {"start":40,"end":55}]'),
        plain: flexBool().describe("Omit hashes (lineNum|content)"),
        verbosity: z.enum(["minimal", "compact", "full"]).optional().describe("Response budget. `minimal` is discovery-first, `compact` adds revision context, `full` preserves the richest payload."),
        edit_ready: flexBool().describe("Include hash/checksum edit protocol blocks explicitly. Default: false for discovery reads."),
    }),
    outputSchema: z.object({
        status: STATUS_ENUM,
        file_path: z.string().optional(),
        file_paths: z.array(z.string()).optional(),
        content: z.string().optional(),
        edit_ready: z.boolean().optional(),
        next_action: z.string().optional(),
        ...ERROR_RESULT_FIELDS,
    }),
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
}, async (rawParams) => {
    const { file_path: p, file_paths: multi, offset, limit, ranges: rawRanges, plain, verbosity, edit_ready } = rawParams ?? {};
    try {
        const ranges = parseReadRanges(rawRanges);
        const readVerbosity = verbosity ?? "minimal";
        const readLimit = limit ?? (edit_ready ? 2000 : 200);
        const readPlain = plain ?? (!edit_ready && readVerbosity !== "full");
        if (multi && multi.length > 0 && !p) {
            const results = [];
            for (const fp of multi) {
                try {
                    if (!edit_ready && readVerbosity !== "full") {
                        results.push(`${fileInfo(fp)}\nnext_hint: read_file file_path="${fp}" verbosity="compact"`);
                    } else {
                        results.push(readFile(fp, {
                            offset,
                            limit: readLimit,
                            ranges,
                            plain: readPlain,
                            verbosity: readVerbosity,
                            editReady: !!edit_ready,
                        }));
                    }
                } catch (e) {
                    results.push(`File: ${fp}\n\nERROR: ${e.message}`);
                }
            }
            const content = results.join("\n\n---\n\n");
            return result({ status: "OK", file_paths: multi, content, edit_ready: !!edit_ready }, { large: !!edit_ready || readVerbosity === "full" || content.length > 50_000 });
        }
        if (!p) throw new Error("Either 'file_path' or 'file_paths' is required");
        const content = readFile(p, {
            offset,
            limit: readLimit,
            ranges,
            plain: readPlain,
            verbosity: readVerbosity,
            editReady: !!edit_ready,
        });
        return result({ status: "OK", file_path: p, content, edit_ready: !!edit_ready }, { large: !!edit_ready || readVerbosity === "full" || content.length > 50_000 });
    } catch (e) {
        return errorResult(e.code || "READ_ERROR", e.message, e.recovery || "Check path and permissions");
    }
});



// ==================== edit_file ====================

server.registerTool("edit_file", {
    title: "Edit File",
    description: "Apply hash-verified partial edits to one file. Batch ALL hunks for the same file into ONE call via the `edits` array -- separate sequential edit_file calls on one file go stale and conflict (the most common edit failure). Carry base_revision only for a genuinely later follow-up after the file changed. Anchors accept tag.N, a bare line number, or unique line content (auto-resolved); range_checksum accepts \"auto\" to compute it for the current range. Preserves existing line endings and trailing-newline shape; conservative conflicts return retry helpers. boundary_mode=inclusive deletes the anchor lines themselves; new_text must close any delimiter whose opening falls inside the replaced range.",
    inputSchema: z.object({
        file_path: z.string().describe("File to edit"),
        edits: z.union([z.string(), z.array(z.any())]).describe(
            'JSON array of canonical edits.\n' +
            '[{"set_line":{"anchor":"ab.12","new_text":"x"}}]\n' +
            '[{"replace_lines":{"start_anchor":"ab.10","end_anchor":"cd.15","new_text":"x","range_checksum":"10-15:a1b2"}}]\n' +
            '[{"insert_after":{"anchor":"ab.20","text":"x"}}]\n' +
            '[{"replace_between":{"start_anchor":"ab.10","end_anchor":"cd.40","new_text":"x","boundary_mode":"inclusive","range_checksum":"10-40:a1b2"}}]\n' +
            'Prefer replace_lines with range_checksum when either anchor is a lone delimiter (}, ), ]) — replace_between anchors use short line-content hashes and may fuzzy-match a sibling delimiter. Anchors also accept a bare line number or exact line content (auto-resolved to tag.N); range_checksum accepts "auto" to compute it for the current anchor range.',
        ),
        dry_run: flexBool().describe("Preview changes without writing"),
        restore_indent: flexBool().describe("Auto-fix indentation to match anchor (default: false)"),
        base_revision: z.string().optional().describe("Prior revision from read_file/edit_file. Enables conservative auto-rebase for same-file follow-up edits."),
        conflict_policy: z.enum(["strict", "conservative"]).optional().describe('Conflict handling (default: "conservative"). "conservative" returns structured CONFLICT output with recovery_ranges, retry_edit/retry_edits, suggested_read_call, and retry_plan when available.'),
        allow_external: flexBool().describe("Allow editing a path outside the current project root. Use only when you intentionally target a temp or external file."),
    }),
    outputSchema: z.object({ status: STATUS_ENUM, file_path: z.string().optional(), content: z.string().optional(), reason: z.string().optional(), warnings: z.array(z.object({ code: z.string() }).passthrough()).optional(), ...ERROR_RESULT_FIELDS }),
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
}, async (rawParams) => {
    const { file_path: p, edits: json, dry_run, restore_indent, base_revision, conflict_policy, allow_external } = rawParams ?? {};
    try {
        assertProjectScopedPath(p, { allowExternal: !!allow_external });
        let parsed;
        try { parsed = typeof json === "string" ? JSON.parse(json) : json; }
        catch { throw new Error('edits: invalid JSON. Expected: [{"set_line":{"anchor":"xx.N","new_text":"..."}}]'); }
        validateEditPayload(parsed);
        const content = editFile(p, parsed, {
            dryRun: dry_run,
            restoreIndent: restore_indent,
            baseRevision: base_revision,
            conflictPolicy: conflict_policy,
        });
        return lineReportResult({ file_path: p }, content, { large: content.length > 50_000 });
    } catch (e) {
        return errorResult(e.code || "EDIT_ERROR", e.message, e.recovery || "Check anchors and checksums");
    }
});


// ==================== write_file ====================

server.registerTool("write_file", {
    title: "Write File",
    description:
        "Create a new file or overwrite existing. Creates parent dirs. " +
        "For existing files prefer edit_file (shows diff, verifies hashes).",
    inputSchema: z.object({
        file_path: z.string().describe("File path"),
        content: z.string().describe("File content"),
        allow_external: flexBool().describe("Allow writing a path outside the current project root. Use only when you intentionally target a temp or external file."),
    }),
    outputSchema: z.object({ status: STATUS_ENUM, file_path: z.string().optional(), lines: z.number().optional(), ...ERROR_RESULT_FIELDS }),
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
}, async (rawParams) => {
    const { file_path: p, content, allow_external } = rawParams ?? {};
    try {
        assertProjectScopedPath(p, { allowExternal: !!allow_external });
        const abs = validateWritePath(p);
        mkdirSync(dirname(abs), { recursive: true });
        writeFileSync(abs, content, "utf-8");
        const lines = content.split("\n").length;
        return result({ status: "OK", file_path: p, lines });
    } catch (e) {
        return errorResult(e.code || "WRITE_ERROR", e.message, e.recovery || "Check path and permissions");
    }
});


// ==================== grep_search ====================

server.registerTool("grep_search", {
    title: "Search Files",
    description: "Search file contents with ripgrep. Default: summary-first discovery output; use `content` with `edit_ready=true` when you need verified edit hunks.",
    inputSchema: z.object({
        pattern: z.string().describe("Search pattern (regex by default, literal if literal:true)"),
        path: z.string().optional().describe("Search dir/file (default: cwd)"),
        glob: z.string().optional().describe('Glob filter (e.g. "*.ts")'),
        type: z.string().optional().describe('File type (e.g. "js", "py")'),
        output_mode: z.enum(["summary", "content", "files_with_matches", "count"]).optional().describe('Output format (default: summary)'),
        case_insensitive: flexBool().describe("Ignore case (-i)"),
        smart_case: flexBool().describe("CI when pattern is all lowercase, CS if uppercase (-S)"),
        literal: flexBool().describe("Literal string search, no regex (-F)"),
        multiline: flexBool().describe("Pattern can span multiple lines (-U)"),
        context: flexNum().describe("Symmetric context lines around matches (-C)"),
        context_before: flexNum().describe("Context lines BEFORE match (-B)"),
        context_after: flexNum().describe("Context lines AFTER match (-A)"),
        limit: flexNum().describe("Max matches per file (default: 20 for summary discovery, 100 for content)"),
        head_limit: flexNum().describe("Total match events across all files; multiline matches count as 1 (default: 50 for summary discovery, 200 for content, 1000 for files_with_matches/count, 0 = unlimited)"),
        plain: flexBool().describe("Omit hash tags, return file:line:content"),
        edit_ready: flexBool().describe("Preserve hash/checksum search hunks in `content` mode. Default: false."),
        allow_large_output: flexBool().describe("Bypass the default content-mode block/char caps when you intentionally need a larger payload."),
    }),
    outputSchema: z.object({ status: STATUS_ENUM, pattern: z.string().optional(), content: z.string().optional(), ...ERROR_RESULT_FIELDS }),
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
}, async (rawParams) => {
    const { pattern, path: p, glob, type, output_mode, case_insensitive, smart_case, literal, multiline,
            context, context_before, context_after, limit, head_limit, plain, edit_ready, allow_large_output } = rawParams ?? {};
    try {
        const resolvedOutput = (output_mode === "files_with_matches") ? "files" : (output_mode ?? "summary");
        const resolvedLimit = limit ?? (resolvedOutput === "summary" ? 20 : 100);
        const resolvedTotalLimit = head_limit ?? (resolvedOutput === "summary" ? 50 : undefined);
        const searchResult = await grepSearch(pattern, {
            path: p, glob, type, output: resolvedOutput, caseInsensitive: case_insensitive, smartCase: smart_case,
            literal, multiline, context, contextBefore: context_before, contextAfter: context_after,
            limit: resolvedLimit, totalLimit: resolvedTotalLimit, plain, editReady: !!edit_ready,
            allowLargeOutput: !!allow_large_output,
        });
        return result({ status: "OK", pattern, content: searchResult }, { large: !!allow_large_output || resolvedOutput === "content" });
    } catch (e) {
        return errorResult(e.code || "GREP_ERROR", e.message, e.recovery || "Check pattern syntax");
    }
});


// ==================== outline ====================

server.registerTool("outline", {
    title: "File Outline",
    description:
        "AST-based structural outline with hash anchors for direct edit_file usage. " +
        "Supports JavaScript/TypeScript, Python, C#, and PHP code files plus markdown headings (.md/.mdx, fence-aware).",
    inputSchema: z.object({
        file_path: z.string().describe("Source file path"),
    }),
    outputSchema: z.object({ status: STATUS_ENUM, file_path: z.string().optional(), content: z.string().optional(), reason: z.string().optional(), ...ERROR_RESULT_FIELDS }),
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
}, async (rawParams) => {
    const { file_path: p } = rawParams ?? {};
    try {
        const content = await fileOutline(p);
        return lineReportResult({ file_path: p }, content);
    } catch (e) {
        return errorResult(e.code || "OUTLINE_ERROR", e.message, e.recovery || "Check file path and language support");
    }
});


// ==================== verify ====================

server.registerTool("verify", {
    title: "Verify Checksums",
    description: "Check if held checksums are still valid without rereading. Use before delayed or mixed-tool follow-up edits; returns canonical status, next_action, and reread guidance.",
    inputSchema: z.object({
        file_path: z.string().describe("File path"),
        checksums: z.array(z.string()).describe('Checksum strings, e.g. ["1-50:f7e2a1b0", "51-100:abcd1234"]'),
        base_revision: z.string().optional().describe("Optional prior revision to compare against latest state."),
    }),
    outputSchema: z.object({ status: STATUS_ENUM, file_path: z.string().optional(), content: z.string().optional(), reason: z.string().optional(), ...ERROR_RESULT_FIELDS }),
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
}, async (rawParams) => {
    const { file_path: p, checksums, base_revision } = rawParams ?? {};
    try {
        if (!Array.isArray(checksums) || checksums.length === 0) {
            throw new Error("checksums must be a non-empty array of strings");
        }
        const content = verifyChecksums(p, checksums, { baseRevision: base_revision });
        return lineReportResult({ file_path: p }, content);
    } catch (e) {
        return errorResult(e.code || "VERIFY_ERROR", e.message, e.recovery || "Check checksums format");
    }
});


// ==================== inspect_path ====================

server.registerTool("inspect_path", {
    title: "Inspect Path",
    description:
        "Inspect a file or directory path. Files return compact metadata; directories return a gitignore-aware tree or pattern matches.",
    inputSchema: z.object({
        path: z.string().describe("File or directory path"),
        pattern: z.string().optional().describe('Glob filter on names (e.g. "*-mcp", "*.mjs"). Returns flat match list instead of tree'),
        type: z.enum(["file", "dir", "all"]).optional().describe('"file", "dir", or "all" (default). Like find -type f/d'),
        max_depth: flexNum().describe("Max recursion depth (default: 2 for discovery, or 20 in pattern mode)"),
        max_entries: flexNum().describe("Max entries to show in pattern mode before truncation metadata is returned (default: 60, 0 = unlimited)"),
        gitignore: flexBool().describe("Respect root .gitignore patterns (default: true). Nested .gitignore not supported"),
        format: z.enum(["compact", "full"]).optional().describe('"compact" = shorter path view, "full" = include sizes/metadata where available'),
        verbosity: z.enum(["minimal", "compact", "full"]).optional().describe("Response budget. `minimal` returns the shortest tree summary."),
    }),
    outputSchema: z.object({ status: STATUS_ENUM, path: z.string().optional(), content: z.string().optional(), reason: z.string().optional(), ...ERROR_RESULT_FIELDS }),
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
}, async (rawParams) => {
    const { path: p, max_depth, max_entries, gitignore, format, pattern, type: entryType, verbosity } = rawParams ?? {};
    try {
        const resolvedVerbosity = verbosity ?? "minimal";
        const content = inspectPath(p, {
            max_depth: max_depth ?? (pattern ? 20 : (resolvedVerbosity === "full" ? 3 : 2)),
            gitignore,
            format: format ?? (resolvedVerbosity === "full" ? "full" : "compact"),
            pattern,
            type: entryType,
            max_entries,
        });
        return result({ status: "OK", path: p, content });
    } catch (e) {
        return errorResult(e.code || "INSPECT_ERROR", e.message, e.recovery || "Check path exists");
    }
});


// ==================== changes ====================

server.registerTool("changes", {
    title: "Semantic Diff",
    description:
        "Semantic diff against git ref (default: HEAD). Returns canonical status, summary, next_action, changed symbols, and graph-backed risk hints when available.",
    inputSchema: z.object({
        path: z.string().describe("File or directory path"),
        compare_against: z.string().optional().describe('Git ref to compare against (default: "HEAD")'),
    }),
    outputSchema: z.object({ status: STATUS_ENUM, path: z.string().optional(), content: z.string().optional(), ...ERROR_RESULT_FIELDS }),
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
}, async (rawParams) => {
    const { path: p, compare_against } = rawParams ?? {};
    try {
        const content = await fileChanges(p, compare_against);
        return lineReportResult({ path: p }, content, { large: content.length > 50_000 });
    } catch (e) {
        return errorResult(e.code || "CHANGES_ERROR", e.message, e.recovery || "Check git ref and path");
    }
});


// ==================== bulk_replace ====================

server.registerTool("bulk_replace", {
    title: "Bulk Replace",
    description: "Search-and-replace text across multiple files inside an explicit root path. Use for renames and refactors when the project scope is known.",
    inputSchema: z.object({
        replacements: z.union([z.string(), replacementPairsSchema]).describe('JSON array of {old, new} pairs: [{"old":"foo","new":"bar"}]'),
        glob: z.string().optional().describe('File glob (default: "**/*.{md,mjs,json,yml,ts,js}")'),
        path: z.string().describe("Root directory for the replacement scope"),
        dry_run: flexBool().describe("Preview without writing (default: false)"),
        max_files: flexNum().describe("Max files to process (default: 100)"),
        format: z.enum(["compact", "full"]).optional().describe('"compact" (default) = summary only, "full" = include capped diffs'),
        allow_external: flexBool().describe("Allow a replacement root outside the current project root. Use only when you intentionally target a temp or external directory."),
    }),
    outputSchema: z.object({ status: STATUS_ENUM, path: z.string().optional(), content: z.string().optional(), reason: z.string().optional(), ...ERROR_RESULT_FIELDS }),
    annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: false },
}, async (rawParams) => {
    try {
        const params = rawParams ?? {};
        assertProjectScopedPath(params.path, { allowExternal: !!params.allow_external });
        const raw = params.replacements;
        let replacementsInput;
        try { replacementsInput = typeof raw === "string" ? JSON.parse(raw) : raw; }
        catch { throw new Error('replacements: invalid JSON. Expected: [{"old":"text","new":"replacement"}]'); }
        const replacements = replacementPairsSchema.parse(replacementsInput);
        const content = bulkReplace(
            params.path,
            params.glob || "**/*.{md,mjs,json,yml,ts,js}",
            replacements,
            { dryRun: params.dry_run || false, maxFiles: params.max_files || 100, format: params.format }
        );
        return lineReportResult({ path: params.path }, content, { large: params.format === "full" });
    } catch (e) {
        return errorResult(e.code || "REPLACE_ERROR", e.message, e.recovery || "Check replacement pairs and scope");
    }
});


// --- Start ---

const transport = new StdioServerTransport();
await server.connect(transport);
void checkForUpdates("@levnikolaevich/hex-line-mcp", version);
try { autoSync(); } catch { /* startup sync is best-effort */ }
