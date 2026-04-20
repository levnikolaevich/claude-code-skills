/**
 * Canonical edit-ready block protocol for read/search workflows.
 *
 * EditReadyBlock holds correctness-critical payload only:
 * - absolute line numbers
 * - canonical line entries
 * - checksum covering exactly emitted lines
 *
 * Presentation details such as match markers and graph hints stay outside the
 * checksum model and are added only during serialization.
 */

import { fnv1a, lineTag, rangeChecksum } from "@levnikolaevich/hex-common/text-protocol/hash";

function normalizeEntry(entry) {
    const text = String(entry.text ?? "");
    const hash32 = entry.hash32 ?? fnv1a(text);
    return {
        lineNumber: entry.lineNumber,
        text,
        hash32,
        tag: entry.tag ?? lineTag(hash32),
        role: entry.role ?? "content",
        annotation: entry.annotation ?? "",
    };
}

function renderRequestedSpan(block) {
    if (block.requestedStartLine === null || block.requestedEndLine === null) return null;
    if (block.requestedStartLine === block.startLine && block.requestedEndLine === block.endLine) return null;
    return `requested_span: ${block.requestedStartLine}-${block.requestedEndLine}`;
}

function renderMetaLines(meta = {}) {
    return Object.entries(meta)
        .filter(([key, value]) => {
            if (value === undefined || value === null || value === "") return false;
            // Omit platform defaults — agents assume lf + trailing newline when absent.
            if (key === "eol" && value === "lf") return false;
            if (key === "trailing_newline" && value === true) return false;
            return true;
        })
        .map(([key, value]) => `${key}: ${value}`);
}

function renderBaseEntry(entry, plain = false) {
    return plain
        ? `${entry.lineNumber}|${entry.text}`
        : `${entry.tag}.${entry.lineNumber}\t${entry.text}`;
}

export function createSnapshotEntries(snapshot, startLine, endLine, extra = {}) {
    const entries = [];
    for (let lineNumber = startLine; lineNumber <= endLine; lineNumber++) {
        const idx = lineNumber - 1;
        entries.push(normalizeEntry({
            lineNumber,
            text: snapshot.lines[idx],
            hash32: snapshot.lineHashes[idx],
            ...extra,
        }));
    }
    return entries;
}

export function buildEditReadyBlock({ path, kind, entries, requestedStartLine = null, requestedEndLine = null, meta = {} }) {
    if (!Array.isArray(entries) || entries.length === 0) {
        throw new Error("EditReadyBlock requires at least one entry");
    }
    const normalized = entries
        .map(normalizeEntry)
        .sort((a, b) => a.lineNumber - b.lineNumber);
    const startLine = normalized[0].lineNumber;
    const endLine = normalized[normalized.length - 1].lineNumber;
    return {
        type: "edit_ready_block",
        path,
        kind,
        startLine,
        endLine,
        requestedStartLine: requestedStartLine ?? startLine,
        requestedEndLine: requestedEndLine ?? endLine,
        entries: normalized,
        checksum: rangeChecksum(normalized.map(entry => entry.hash32), startLine, endLine),
        meta,
    };
}

export function buildDiagnosticBlock({
    path = "",
    kind,
    message,
    requestedStartLine = null,
    requestedEndLine = null,
    startLine = null,
    endLine = null,
    meta = {},
}) {
    return {
        type: "diagnostic_block",
        path,
        kind,
        message,
        requestedStartLine,
        requestedEndLine,
        startLine,
        endLine,
        meta,
    };
}

export function serializeReadEntry(entry, opts = {}) {
    return renderBaseEntry(entry, opts.plain);
}

export function serializeSearchEntry(entry, opts = {}) {
    const body = renderBaseEntry(entry, opts.plain);
    if (opts.plain) return body;
    const prefix = entry.role === "match" ? ">>" : "  ";
    const suffix = entry.annotation ? `  ${entry.annotation}` : "";
    return `${prefix}${body}${suffix}`;
}

export function serializeReadBlock(block, opts = {}) {
    if (block.type !== "edit_ready_block") return serializeDiagnosticBlock(block);
    const lines = [
        `block: ${block.kind}`,
        `span: ${block.startLine}-${block.endLine}`,
    ];
    const requestedSpan = renderRequestedSpan(block);
    if (requestedSpan) lines.push(requestedSpan);
    lines.push(...renderMetaLines(block.meta));
    lines.push(...block.entries.map(entry => serializeReadEntry(entry, opts)));
    lines.push(`checksum: ${block.checksum}`);
    return lines.join("\n");
}

export function serializeSearchBlock(block, opts = {}) {
    if (block.type !== "edit_ready_block") return serializeDiagnosticBlock(block);
    const lines = [
        `block: ${block.kind}`,
    ];
    // Skip file: line when caller signals it's a dedupe follow-up for the same file.
    if (!opts.skipFile) lines.push(`file: ${block.path}`);
    lines.push(`span: ${block.startLine}-${block.endLine}`);
    const requestedSpan = renderRequestedSpan(block);
    if (requestedSpan) lines.push(requestedSpan);
    if (Array.isArray(block.meta.matchLines) && block.meta.matchLines.length > 0) {
        const matchLinesStr = block.meta.matchLines.join(",");
        const spanStr = `${block.startLine}-${block.endLine}`;
        const singleSpan = block.startLine === block.endLine ? String(block.startLine) : null;
        if (matchLinesStr !== spanStr && matchLinesStr !== singleSpan) {
            lines.push(`match_lines: ${matchLinesStr}`);
        }
    }
    if (block.meta.summary) lines.push(`summary: ${block.meta.summary}`);
    lines.push(...renderMetaLines(Object.fromEntries(
        Object.entries(block.meta).filter(([key]) => key !== "matchLines" && key !== "summary" && key !== "graphScore")
    )));
    lines.push(...block.entries.map(entry => serializeSearchEntry(entry, opts)));
    lines.push(`checksum: ${block.checksum}`);
    return lines.join("\n");
}

export function serializeDiagnosticBlock(block) {
    const lines = ["block: diagnostic"];
    if (block.path) lines.push(`file: ${block.path}`);
    lines.push(`kind: ${block.kind}`);
    if (block.startLine !== null && block.endLine !== null) {
        lines.push(`span: ${block.startLine}-${block.endLine}`);
    }
    if (block.requestedStartLine !== null && block.requestedEndLine !== null) {
        lines.push(`requested_span: ${block.requestedStartLine}-${block.requestedEndLine}`);
    }
    lines.push(...renderMetaLines(block.meta));
    lines.push(`message: ${block.message}`);
    return lines.join("\n");
}
