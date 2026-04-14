/**
 * AST-based file outline via tree-sitter WASM.
 *
 * Returns structural overview: functions, classes, interfaces with line ranges.
 * 10-20 lines instead of 500 -> 95% token reduction.
 * Output maps directly to read_file ranges.
 */

import { extname } from "node:path";
import { grammarForExtension, supportedExtensions } from "@levnikolaevich/hex-common/parser/languages";
import { outlineFromContent } from "@levnikolaevich/hex-common/parser/outline";
import { lineTag } from "@levnikolaevich/hex-common/text-protocol/hash";
import { readSnapshot } from "./snapshot.mjs";
import { validatePath, normalizePath } from "./security.mjs";
import { getGraphDB, symbolAnnotation, getRelativePath } from "./graph-enrich.mjs";

const MARKDOWN_EXTS = new Set([".md", ".mdx"]);

function fallbackOutline(sourceLines) {
    const entries = [];
    for (let index = 0; index < sourceLines.length; index++) {
        const line = sourceLines[index];
        const trimmed = line.trim();
        if (!trimmed) continue;

        const match = trimmed.match(
            /^(?:export\s+)?(?:async\s+)?function\s+[\w$]+|^(?:export\s+)?(?:const|let|var)\s+[\w$]+\s*=|^(?:export\s+)?class\s+[\w$]+|^(?:export\s+)?interface\s+[\w$]+|^(?:export\s+)?type\s+[\w$]+\s*=|^(?:export\s+)?enum\s+[\w$]+|^(?:export\s+default\s+)?[\w$]+\s*=>/
        );
        if (!match) continue;

        entries.push({
            start: index + 1,
            end: index + 1,
            depth: 0,
            text: trimmed.slice(0, 120),
            name: trimmed.match(/([\w$]+)/)?.[1] || null,
        });
    }
    return entries;
}

function markdownOutline(sourceLines) {
    const entries = [];
    let activeFence = null;
    for (let index = 0; index < sourceLines.length; index++) {
        const line = sourceLines[index];
        const fenceMatch = line.match(/^\s{0,3}(```+|~~~+).*$/);
        if (fenceMatch) {
            const marker = fenceMatch[1][0];
            const length = fenceMatch[1].length;
            if (!activeFence) {
                activeFence = { marker, length };
                continue;
            }
            if (activeFence.marker === marker && length >= activeFence.length) {
                activeFence = null;
                continue;
            }
        }
        if (activeFence) continue;
        const match = line.match(/^\s{0,3}(#{1,6})\s+(.+?)\s*#*\s*$/);
        if (!match) continue;
        const level = match[1].length;
        const title = match[2].trim();
        entries.push({
            start: index + 1,
            end: index + 1,
            depth: level - 1,
            text: title.slice(0, 120),
            name: title.split(/\s+/)[0] || null,
        });
    }
    return entries;
}

function formatOutline(entries, skippedRanges, _sourceLineCount, snapshot, db, relFile, note = "") {
    const lines = [];

    if (note) lines.push(note, "");

    if (skippedRanges.length > 0) {
        const first = skippedRanges[0].start;
        const last = skippedRanges[skippedRanges.length - 1].end;
        const count = skippedRanges.reduce((sum, r) => sum + (r.end - r.start + 1), 0);
        lines.push(`${first}-${last}: (${count} imports/declarations)`);
    }

    for (const e of entries) {
        const indent = "  ".repeat(e.depth);
        const anno = db ? symbolAnnotation(db, relFile, e.name) : null;
        const suffix = anno ? `  ${anno}` : "";
        const tag = snapshot && snapshot.lineHashes[e.start - 1]
            ? lineTag(snapshot.lineHashes[e.start - 1])
            : null;
        const prefix = tag ? `${tag}.` : "";
        lines.push(`${indent}${prefix}${e.start}-${e.end}: ${e.text}${suffix}`);
    }

    return lines.join("\n");
}

export async function fileOutline(filePath) {
    filePath = normalizePath(filePath);
    const real = validatePath(filePath);
    const ext = extname(real).toLowerCase();

    if (!grammarForExtension(ext) && !MARKDOWN_EXTS.has(ext)) {
        return `Outline unavailable for ${ext} files. Use read_file directly for non-code files (markdown, config, text). Supported code extensions: ${supportedExtensions().join(", ")}`;
    }

    const snapshot = readSnapshot(real);
    const isMarkdown = MARKDOWN_EXTS.has(ext);
    const result = isMarkdown ? null : await outlineFromContent(snapshot.content, ext);
    let entries;
    let skippedRanges = [];
    let note = "";
    if (result && result.entries.length > 0) {
        entries = result.entries;
        skippedRanges = result.skippedRanges;
    } else if (isMarkdown) {
        entries = markdownOutline(snapshot.lines);
    } else {
        entries = fallbackOutline(snapshot.lines);
        if (entries.length > 0) note = "Fallback outline: heuristic symbols shown because parser returned no structural entries.";
    }
    const db = getGraphDB(real);
    const relFile = db ? getRelativePath(real) : null;
    return `File: ${filePath}\n\n${formatOutline(entries, skippedRanges, snapshot.lines.length, snapshot, db, relFile, note)}`;
}
