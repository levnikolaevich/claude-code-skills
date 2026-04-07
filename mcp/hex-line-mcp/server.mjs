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

// ==================== read_file ====================

server.registerTool("read_file", {
    title: "Read File",
    description: "Read file with progressive disclosure. Default: minimal plain partial read for discovery; enable edit-ready metadata explicitly when preparing a verified edit.",
    inputSchema: z.object({
        path: z.string().optional().describe("File path"),
        paths: z.array(z.string()).optional().describe("Array of file paths to read (batch mode)"),
        offset: flexNum().describe("Start line (1-indexed, default: 1)"),
        limit: flexNum().describe("Max lines (default: 200 for discovery, 2000 for edit-ready, 0 = all)"),
        ranges: z.union([z.string(), z.array(readRangeSchema)]).optional().describe('Line ranges, e.g. ["10-25", {"start":40,"end":55}]'),
        plain: flexBool().describe("Omit hashes (lineNum|content)"),
        verbosity: z.enum(["minimal", "compact", "full"]).optional().describe("Response budget. `minimal` is discovery-first, `compact` adds revision context, `full` preserves the richest payload."),
        edit_ready: flexBool().describe("Include hash/checksum edit protocol blocks explicitly. Default: false for discovery reads."),
    }),
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
}, async (rawParams) => {
    const { path: p, paths: multi, offset, limit, ranges: rawRanges, plain, verbosity, edit_ready } = rawParams ?? {};
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
                        results.push(`${fileInfo(fp)}\nnext_hint: read_file path="${fp}" verbosity="compact"`);
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
            return { content: [{ type: "text", text: results.join("\n\n---\n\n") }] };
        }
        if (!p) throw new Error("Either 'path' or 'paths' is required");
        return { content: [{ type: "text", text: readFile(p, {
            offset,
            limit: readLimit,
            ranges,
            plain: readPlain,
            verbosity: readVerbosity,
            editReady: !!edit_ready,
        }) }] };
    } catch (e) {
        return { content: [{ type: "text", text: e.message }], isError: true };
    }
});


// ==================== edit_file ====================

server.registerTool("edit_file", {
    title: "Edit File",
    description: "Apply hash-verified partial edits to one file. Carry base_revision on same-file follow-ups. Preserves existing line endings and trailing-newline shape; conservative conflicts return retry helpers.",
    inputSchema: z.object({
        path: z.string().describe("File to edit"),
        edits: z.union([z.string(), z.array(z.any())]).describe(
            'JSON array of canonical edits.\n' +
            '[{"set_line":{"anchor":"ab.12","new_text":"x"}}]\n' +
            '[{"replace_lines":{"start_anchor":"ab.10","end_anchor":"cd.15","new_text":"x","range_checksum":"10-15:a1b2"}}]\n' +
            '[{"insert_after":{"anchor":"ab.20","text":"x"}}]\n' +
            '[{"replace_between":{"start_anchor":"ab.10","end_anchor":"cd.40","new_text":"x","boundary_mode":"inclusive"}}]',
        ),
        dry_run: flexBool().describe("Preview changes without writing"),
        restore_indent: flexBool().describe("Auto-fix indentation to match anchor (default: false)"),
        base_revision: z.string().optional().describe("Prior revision from read_file/edit_file. Enables conservative auto-rebase for same-file follow-up edits."),
        conflict_policy: z.enum(["strict", "conservative"]).optional().describe('Conflict handling (default: "conservative"). "conservative" returns structured CONFLICT output with recovery_ranges, retry_edit/retry_edits, suggested_read_call, and retry_plan when available.'),
        allow_external: flexBool().describe("Allow editing a path outside the current project root. Use only when you intentionally target a temp or external file."),
    }),
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
}, async (rawParams) => {
    const { path: p, edits: json, dry_run, restore_indent, base_revision, conflict_policy, allow_external } = rawParams ?? {};
    try {
        assertProjectScopedPath(p, { allowExternal: !!allow_external });
        let parsed;
        try { parsed = typeof json === "string" ? JSON.parse(json) : json; }
        catch { throw new Error('edits: invalid JSON. Expected: [{"set_line":{"anchor":"xx.N","new_text":"..."}}]'); }
        if (!Array.isArray(parsed) || !parsed.length) throw new Error("Edits: non-empty JSON array required");
        return {
            content: [{
                type: "text",
                text: editFile(p, parsed, {
                    dryRun: dry_run,
                    restoreIndent: restore_indent,
                    baseRevision: base_revision,
                    conflictPolicy: conflict_policy,
                }),
            }],
        };
    } catch (e) {
        return { content: [{ type: "text", text: e.message }], isError: true };
    }
});


// ==================== write_file ====================

server.registerTool("write_file", {
    title: "Write File",
    description:
        "Create a new file or overwrite existing. Creates parent dirs. " +
        "For existing files prefer edit_file (shows diff, verifies hashes).",
    inputSchema: z.object({
        path: z.string().describe("File path"),
        content: z.string().describe("File content"),
        allow_external: flexBool().describe("Allow writing a path outside the current project root. Use only when you intentionally target a temp or external file."),
    }),
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
}, async (rawParams) => {
    const { path: p, content, allow_external } = rawParams ?? {};
    try {
        assertProjectScopedPath(p, { allowExternal: !!allow_external });
        const abs = validateWritePath(p);
        mkdirSync(dirname(abs), { recursive: true });
        writeFileSync(abs, content, "utf-8");
        return { content: [{ type: "text", text: `Created ${p} (${content.split("\n").length} lines)` }] };
    } catch (e) {
        return { content: [{ type: "text", text: e.message }], isError: true };
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
        output: z.enum(["summary", "content", "files", "count"]).optional().describe('Output format (default: summary)'),
        case_insensitive: flexBool().describe("Ignore case (-i)"),
        smart_case: flexBool().describe("CI when pattern is all lowercase, CS if uppercase (-S)"),
        literal: flexBool().describe("Literal string search, no regex (-F)"),
        multiline: flexBool().describe("Pattern can span multiple lines (-U)"),
        context: flexNum().describe("Symmetric context lines around matches (-C)"),
        context_before: flexNum().describe("Context lines BEFORE match (-B)"),
        context_after: flexNum().describe("Context lines AFTER match (-A)"),
        limit: flexNum().describe("Max matches per file (default: 20 for summary discovery, 100 for content)"),
        total_limit: flexNum().describe("Total match events across all files; multiline matches count as 1 (default: 50 for summary discovery, 200 for content, 1000 for files/count, 0 = unlimited)"),
        plain: flexBool().describe("Omit hash tags, return file:line:content"),
        edit_ready: flexBool().describe("Preserve hash/checksum search hunks in `content` mode. Default: false."),
    }),
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
}, async (rawParams) => {
    const { pattern, path: p, glob, type, output, case_insensitive, smart_case, literal, multiline,
            context, context_before, context_after, limit, total_limit, plain, edit_ready } = rawParams ?? {};
    try {
        const resolvedOutput = output ?? "summary";
        const resolvedLimit = limit ?? (resolvedOutput === "summary" ? 20 : 100);
        const resolvedTotalLimit = total_limit ?? (resolvedOutput === "summary" ? 50 : undefined);
        const result = await grepSearch(pattern, {
            path: p, glob, type, output: resolvedOutput, caseInsensitive: case_insensitive, smartCase: smart_case,
            literal, multiline, context, contextBefore: context_before, contextAfter: context_after,
            limit: resolvedLimit, totalLimit: resolvedTotalLimit, plain, editReady: !!edit_ready,
        });
        return { content: [{ type: "text", text: result }] };
    } catch (e) {
        return { content: [{ type: "text", text: e.message }], isError: true };
    }
});


// ==================== outline ====================

server.registerTool("outline", {
    title: "File Outline",
    description:
        "AST-based structural outline with hash anchors for direct edit_file usage. " +
        "Supports JavaScript/TypeScript, Python, C#, and PHP code files plus markdown headings (.md/.mdx, fence-aware).",
    inputSchema: z.object({
        path: z.string().describe("Source file path"),
    }),
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
}, async (rawParams) => {
    const { path: p } = rawParams ?? {};
    try {
        const result = await fileOutline(p);
        return { content: [{ type: "text", text: result }] };
    } catch (e) {
        return { content: [{ type: "text", text: e.message }], isError: true };
    }
});


// ==================== verify ====================

server.registerTool("verify", {
    title: "Verify Checksums",
    description: "Check if held checksums are still valid without rereading. Use before delayed or mixed-tool follow-up edits; returns canonical status, next_action, and reread guidance.",
    inputSchema: z.object({
        path: z.string().describe("File path"),
        checksums: z.array(z.string()).describe('Checksum strings, e.g. ["1-50:f7e2a1b0", "51-100:abcd1234"]'),
        base_revision: z.string().optional().describe("Optional prior revision to compare against latest state."),
    }),
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
}, async (rawParams) => {
    const { path: p, checksums, base_revision } = rawParams ?? {};
    try {
        if (!Array.isArray(checksums) || checksums.length === 0) {
            throw new Error("checksums must be a non-empty array of strings");
        }
        return { content: [{ type: "text", text: verifyChecksums(p, checksums, { baseRevision: base_revision }) }] };
    } catch (e) {
        return { content: [{ type: "text", text: e.message }], isError: true };
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
        gitignore: flexBool().describe("Respect root .gitignore patterns (default: true). Nested .gitignore not supported"),
        format: z.enum(["compact", "full"]).optional().describe('"compact" = shorter path view, "full" = include sizes/metadata where available'),
        verbosity: z.enum(["minimal", "compact", "full"]).optional().describe("Response budget. `minimal` returns the shortest tree summary."),
    }),
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
}, async (rawParams) => {
    const { path: p, max_depth, gitignore, format, pattern, type: entryType, verbosity } = rawParams ?? {};
    try {
        const resolvedVerbosity = verbosity ?? "minimal";
        return { content: [{ type: "text", text: inspectPath(p, {
            max_depth: max_depth ?? (pattern ? 20 : (resolvedVerbosity === "full" ? 3 : 2)),
            gitignore,
            format: format ?? (resolvedVerbosity === "full" ? "full" : "compact"),
            pattern,
            type: entryType,
        }) }] };
    } catch (e) {
        return { content: [{ type: "text", text: e.message }], isError: true };
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
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
}, async (rawParams) => {
    const { path: p, compare_against } = rawParams ?? {};
    try {
        return { content: [{ type: "text", text: await fileChanges(p, compare_against) }] };
    } catch (e) {
        return { content: [{ type: "text", text: e.message }], isError: true };
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
    annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false },
}, async (rawParams) => {
    try {
        const params = rawParams ?? {};
        assertProjectScopedPath(params.path, { allowExternal: !!params.allow_external });
        const raw = params.replacements;
        let replacementsInput;
        try { replacementsInput = typeof raw === "string" ? JSON.parse(raw) : raw; }
        catch { throw new Error('replacements: invalid JSON. Expected: [{"old":"text","new":"replacement"}]'); }
        const replacements = replacementPairsSchema.parse(replacementsInput);
        const result = bulkReplace(
            params.path,
            params.glob || "**/*.{md,mjs,json,yml,ts,js}",
            replacements,
            { dryRun: params.dry_run || false, maxFiles: params.max_files || 100, format: params.format }
        );
        return { content: [{ type: "text", text: result }] };
    } catch (e) {
        return { content: [{ type: "text", text: e.message }], isError: true };
    }
});


// --- Start ---

const transport = new StdioServerTransport();
await server.connect(transport);
void checkForUpdates("@levnikolaevich/hex-line-mcp", version);
try { autoSync(); } catch { /* startup sync is best-effort */ }
