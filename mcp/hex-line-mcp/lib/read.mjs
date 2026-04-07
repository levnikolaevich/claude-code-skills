/**
 * File read over the canonical edit-ready block protocol.
 */

import { statSync } from "node:fs";
import { validatePath, normalizePath } from "./security.mjs";
import { getGraphDB, fileAnnotations, getRelativePath } from "./graph-enrich.mjs";
import { formatSize, relativeTime, MAX_OUTPUT_CHARS } from "./format.mjs";
import { readSnapshot } from "./snapshot.mjs";
import {
    buildDiagnosticBlock,
    buildEditReadyBlock,
    createSnapshotEntries,
    serializeDiagnosticBlock,
    serializeReadBlock,
    serializeReadEntry,
} from "./block-protocol.mjs";

const DEFAULT_LIMIT = 2000;

function resolveReadMode(opts = {}) {
    const verbosity = opts.verbosity || "full";
    const editReady = opts.editReady ?? (verbosity === "full" && opts.plain !== true);
    const plain = opts.plain ?? (!editReady || verbosity !== "full");
    return { verbosity, editReady, plain };
}

function parseRangeEntry(entry, total) {
    if (typeof entry === "string") {
        const match = entry.trim().match(/^(\d+)(?:-(\d*)?)?$/);
        if (!match) throw new Error(`Invalid range "${entry}". Use "10", "10-25", or "10-"`);
        const start = Number(match[1]);
        const end = match[2] === undefined || match[2] === "" ? total : Number(match[2]);
        return { start, end };
    }

    if (!entry || typeof entry !== "object") {
        throw new Error("ranges entries must be strings or {start,end} objects");
    }

    const start = Number(entry.start ?? 1);
    const end = entry.end === undefined || entry.end === null ? total : Number(entry.end);
    if (!Number.isFinite(start) || !Number.isFinite(end)) {
        throw new Error("ranges entries must contain numeric start/end values");
    }
    return { start, end };
}

function normalizeRange(entry, total) {
    const parsed = parseRangeEntry(entry, total);
    if (!Number.isInteger(parsed.start) || !Number.isInteger(parsed.end)) {
        throw new Error("ranges entries must resolve to integer start/end values");
    }
    if (parsed.start > parsed.end) {
        return buildDiagnosticBlock({
            kind: "invalid_range",
            message: `Requested range ${parsed.start}-${parsed.end} has start greater than end.`,
            requestedStartLine: parsed.start,
            requestedEndLine: parsed.end,
        });
    }
    if (parsed.end < 1 || parsed.start > total) {
        return buildDiagnosticBlock({
            kind: "invalid_range",
            message: `Requested range ${parsed.start}-${parsed.end} is outside file length ${total}.`,
            requestedStartLine: parsed.start,
            requestedEndLine: parsed.end,
        });
    }
    return {
        requestedStartLine: parsed.start,
        requestedEndLine: parsed.end,
        startLine: Math.max(1, parsed.start),
        endLine: Math.min(total, parsed.end),
    };
}

function buildReadBlock(snapshot, range, plain, remainingChars) {
    const entries = [];
    let nextBudget = remainingChars;
    let cappedAtLine = 0;
    for (let lineNumber = range.startLine; lineNumber <= range.endLine; lineNumber++) {
        const entry = createSnapshotEntries(snapshot, lineNumber, lineNumber)[0];
        const rendered = serializeReadEntry(entry, { plain });
        const nextCost = rendered.length + 1;
        if (entries.length > 0 && nextBudget - nextCost < 0) {
            cappedAtLine = lineNumber;
            break;
        }
        entries.push(entry);
        nextBudget -= nextCost;
    }
    if (entries.length === 0) {
        const entry = createSnapshotEntries(snapshot, range.startLine, range.startLine)[0];
        entries.push(entry);
        nextBudget -= serializeReadEntry(entry, { plain }).length + 1;
        if (range.endLine > range.startLine) cappedAtLine = range.startLine + 1;
    }
    return {
        block: buildEditReadyBlock({
            path: snapshot.path,
            kind: "read_range",
            entries,
            requestedStartLine: range.requestedStartLine,
            requestedEndLine: range.requestedEndLine,
            meta: {
                eol: snapshot.eol,
                trailing_newline: snapshot.trailingNewline,
            },
        }),
        remainingChars: nextBudget,
        cappedAtLine,
    };
}

function buildPlainRange(snapshot, range, remainingChars) {
    const lines = [];
    let nextBudget = remainingChars;
    let cappedAtLine = 0;
    for (let lineNumber = range.startLine; lineNumber <= range.endLine; lineNumber++) {
        const rendered = `${lineNumber}|${snapshot.lines[lineNumber - 1] ?? ""}`;
        const nextCost = rendered.length + 1;
        if (lines.length > 0 && nextBudget - nextCost < 0) {
            cappedAtLine = lineNumber;
            break;
        }
        lines.push(rendered);
        nextBudget -= nextCost;
    }
    if (lines.length === 0) {
        lines.push(`${range.startLine}|${snapshot.lines[range.startLine - 1] ?? ""}`);
        nextBudget -= lines[0].length + 1;
        if (range.endLine > range.startLine) cappedAtLine = range.startLine + 1;
    }
    return { text: lines.join("\n"), remainingChars: nextBudget, cappedAtLine };
}

function buildContinuation({ nextOffset, limit }) {
    if (!nextOffset) return "";
    return `continuation: {"kind":"offset","offset":${nextOffset},"limit":${limit}}\n`;
}

export function readFile(filePath, opts = {}) {
    filePath = normalizePath(filePath);
    const real = validatePath(filePath);
    const stat = statSync(real);

    if (stat.isDirectory()) {
        throw new Error(`READ_FILE_EXPECTS_FILE: ${filePath} is a directory. Use inspect_path for directory trees and path discovery.`);
    }

    const snapshot = readSnapshot(real);
    const total = snapshot.lines.length;
    const { verbosity, editReady, plain } = resolveReadMode(opts);

    let requestedRanges;
    if (opts.ranges && opts.ranges.length > 0) {
        requestedRanges = opts.ranges;
    } else {
        const startLine = Math.max(1, opts.offset || 1);
        const maxLines = (opts.limit && opts.limit > 0) ? opts.limit : DEFAULT_LIMIT;
        requestedRanges = [{ start: startLine, end: Math.min(total, startLine - 1 + maxLines) }];
    }

    const normalizedRanges = [];
    const diagnostics = [];
    for (const requested of requestedRanges) {
        const normalized = normalizeRange(requested, total);
        if (normalized.type === "diagnostic_block") diagnostics.push(normalized);
        else normalizedRanges.push(normalized);
    }

    const sizeText = formatSize(stat.size);
    const ago = relativeTime(stat.mtime);
    let meta = `${total} lines, ${sizeText}, ${ago}`;
    const rangeForMeta = normalizedRanges.length === 1 ? normalizedRanges[0] : null;
    if (rangeForMeta) {
        if (rangeForMeta.startLine > 1 || rangeForMeta.endLine < total) meta += `, showing ${rangeForMeta.startLine}-${rangeForMeta.endLine}`;
        if (rangeForMeta.endLine < total) meta += `, ${total - rangeForMeta.endLine} more below`;
    }

    let graphLine = "";
    if (verbosity === "full") {
        const db = getGraphDB(real);
        const relFile = db ? getRelativePath(real) : null;
        if (db && relFile) {
            const visibleStart = normalizedRanges.length > 0 ? Math.min(...normalizedRanges.map(range => range.startLine)) : 1;
            const visibleEnd = normalizedRanges.length > 0 ? Math.max(...normalizedRanges.map(range => range.endLine)) : total;
            const annos = fileAnnotations(db, relFile, { startLine: visibleStart, endLine: visibleEnd, limit: 6 });
            if (annos.length > 0) {
                const items = annos.map(a => {
                    const parts = [];
                    if (a.is_exported) parts.push(a.is_default_export ? "default api" : "api");
                    if ((a.framework_incoming_count || 0) > 0) {
                        parts.push(a.framework_incoming_count === 1 ? "entrypoint" : `entrypoint ${a.framework_incoming_count}`);
                    }
                    if ((a.callees_exact || 0) > 0 || (a.callers_exact || 0) > 0) {
                        parts.push(`${a.callees_exact}\u2193 ${a.callers_exact}\u2191`);
                    }
                    const flow = [];
                    if ((a.incoming_flow_count || 0) > 0) flow.push(`${a.incoming_flow_count}in`);
                    if ((a.outgoing_flow_count || 0) > 0) flow.push(`${a.outgoing_flow_count}out`);
                    if ((a.through_flow_count || 0) > 0) flow.push(`${a.through_flow_count}thru`);
                    if (flow.length > 0) parts.push(`flow ${flow.join(" ")}`);
                    if ((a.clone_sibling_count || 0) > 0) parts.push(`clone ${a.clone_sibling_count}`);
                    return parts.length > 0
                        ? `${a.name} [${a.kind} ${parts.join(" | ")}]`
                        : `${a.name} [${a.kind}]`;
                });
                graphLine = `\nGraph: ${items.join(" | ")}`;
            }
        }
    }

    if (!editReady || verbosity !== "full") {
        const sections = [];
        let remainingChars = MAX_OUTPUT_CHARS;
        let cappedAtLine = 0;
        for (const range of normalizedRanges) {
            const built = buildPlainRange(snapshot, range, remainingChars);
            sections.push(built.text);
            remainingChars = built.remainingChars;
            if (built.cappedAtLine) {
                cappedAtLine = built.cappedAtLine;
                break;
            }
        }
        const nextOffset = cappedAtLine || (
            rangeForMeta && rangeForMeta.endLine < total && !opts.ranges
                ? rangeForMeta.endLine + 1
                : 0
        );
        const diagnosticsText = diagnostics.map(block => serializeDiagnosticBlock(block)).join("\n\n");
        const body = [sections.join("\n\n"), diagnosticsText].filter(Boolean).join("\n\n");
        const revisionLine = verbosity === "compact" ? `revision: ${snapshot.revision}\n` : "";
        return `File: ${filePath}${graphLine}\nmeta: ${meta}\n${revisionLine}${buildContinuation({ nextOffset, limit: opts.limit && opts.limit > 0 ? opts.limit : DEFAULT_LIMIT })}\n${body}`.trim();
    }

    const blocks = [];
    let remainingChars = MAX_OUTPUT_CHARS;
    let cappedAtLine = 0;
    for (const range of normalizedRanges) {
        const built = buildReadBlock(snapshot, range, plain, remainingChars);
        blocks.push(built.block);
        remainingChars = built.remainingChars;
        if (built.cappedAtLine) {
            cappedAtLine = built.cappedAtLine;
            diagnostics.push(buildDiagnosticBlock({
                kind: "output_capped",
                message: `OUTPUT_CAPPED at line ${built.cappedAtLine} (${MAX_OUTPUT_CHARS} char limit). Use offset=${built.cappedAtLine} to continue reading.`,
                requestedStartLine: built.cappedAtLine,
                requestedEndLine: built.cappedAtLine,
                startLine: built.block.startLine,
                endLine: built.block.endLine,
            }));
            break;
        }
    }
    const serializedBlocks = [
        ...blocks.map(block => serializeReadBlock(block, { plain })),
        ...diagnostics.map(block => serializeDiagnosticBlock(block)),
    ];
    if (cappedAtLine && serializedBlocks.length === 0) {
        serializedBlocks.push(serializeDiagnosticBlock(buildDiagnosticBlock({
            kind: "output_capped",
            message: `OUTPUT_CAPPED at line ${cappedAtLine} (${MAX_OUTPUT_CHARS} char limit). Use offset=${cappedAtLine} to continue reading.`,
            requestedStartLine: cappedAtLine,
            requestedEndLine: cappedAtLine,
        })));
    }
    return `File: ${filePath}${graphLine}\nmeta: ${meta}\nrevision: ${snapshot.revision}\nfile: ${snapshot.fileChecksum}\neol: ${snapshot.eol}\ntrailing_newline: ${snapshot.trailingNewline}\n\n${serializedBlocks.join("\n\n")}`.trim();
}
