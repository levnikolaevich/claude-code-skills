/**
 * Snapshot kernel for hex-line-mcp.
 *
 * DocumentSnapshot is the source of truth for:
 * - normalized lines
 * - per-line hashes
 * - file checksums
 * - revision ids
 * - change tracking across short-lived in-memory revisions
 */

import { statSync } from "node:fs";
import { diffLines } from "diff";
import { fnv1a, lineTag, rangeChecksum } from "@levnikolaevich/hex-common/text-protocol/hash";
import { parseUtf8TextWithMetadata, readUtf8WithMetadata } from "@levnikolaevich/hex-common/text/file-text";

const MAX_FILES = 200;
const MAX_REVISIONS_PER_FILE = 5;
const TTL_MS = 15 * 60 * 1000;

const latestByFile = new Map();
const revisionsById = new Map();
const fileRevisionIds = new Map();
let revisionSeq = 0;

function touchFile(filePath) {
    const latest = latestByFile.get(filePath);
    if (!latest) return;
    latestByFile.delete(filePath);
    latestByFile.set(filePath, latest);
}

function pruneExpired(now = Date.now()) {
    for (const [revision, snapshot] of revisionsById) {
        if (now - snapshot.createdAt <= TTL_MS) continue;
        revisionsById.delete(revision);
        const ids = fileRevisionIds.get(snapshot.path);
        if (!ids) continue;
        const next = ids.filter(id => id !== revision);
        if (next.length > 0) fileRevisionIds.set(snapshot.path, next);
        else fileRevisionIds.delete(snapshot.path);
        const latest = latestByFile.get(snapshot.path);
        if (latest?.revision === revision) latestByFile.delete(snapshot.path);
    }

    while (latestByFile.size > MAX_FILES) {
        const oldestPath = latestByFile.keys().next().value;
        const ids = fileRevisionIds.get(oldestPath) || [];
        for (const id of ids) revisionsById.delete(id);
        fileRevisionIds.delete(oldestPath);
        latestByFile.delete(oldestPath);
    }
}

function rememberRevisionId(filePath, revision) {
    const ids = fileRevisionIds.get(filePath) || [];
    if (ids.includes(revision)) {
        fileRevisionIds.set(filePath, ids);
        return;
    }
    ids.push(revision);
    while (ids.length > MAX_REVISIONS_PER_FILE) {
        const removed = ids.shift();
        revisionsById.delete(removed);
    }
    fileRevisionIds.set(filePath, ids);
}

function buildUniqueTagIndex(lineHashes) {
    const index = new Map();
    const duplicates = new Set();
    for (let i = 0; i < lineHashes.length; i++) {
        const tag = lineTag(lineHashes[i]);
        if (duplicates.has(tag)) continue;
        if (index.has(tag)) {
            index.delete(tag);
            duplicates.add(tag);
            continue;
        }
        index.set(tag, { idx: i, hash32: lineHashes[i] });
    }
    return index;
}

function computeFileChecksum(lineHashes) {
    return rangeChecksum(lineHashes, 1, lineHashes.length);
}

function diffLineCount(value) {
    if (!value) return 0;
    return value.split("\n").length - 1;
}

function coalesceRanges(ranges) {
    if (!ranges.length) return [];
    const sorted = [...ranges].sort((a, b) => a.start - b.start || a.end - b.end);
    const merged = [sorted[0]];
    for (let i = 1; i < sorted.length; i++) {
        const prev = merged[merged.length - 1];
        const curr = sorted[i];
        if (curr.start <= prev.end + 1) {
            prev.end = Math.max(prev.end, curr.end);
            prev.kind = prev.kind === curr.kind ? prev.kind : "mixed";
            continue;
        }
        merged.push({ ...curr });
    }
    return merged;
}

export function computeChangedRanges(oldLines, newLines) {
    const oldText = oldLines.join("\n") + "\n";
    const newText = newLines.join("\n") + "\n";
    const parts = diffLines(oldText, newText);
    const ranges = [];
    let oldNum = 1;
    let newNum = 1;

    for (let i = 0; i < parts.length; i++) {
        const part = parts[i];
        const count = diffLineCount(part.value);

        if (part.removed) {
            const next = parts[i + 1];
            if (next?.added) {
                const addedCount = diffLineCount(next.value);
                ranges.push({
                    start: newNum,
                    end: addedCount > 0 ? newNum + addedCount - 1 : newNum,
                    kind: "replace",
                });
                oldNum += count;
                newNum += addedCount;
                i++;
                continue;
            }
            ranges.push({ start: newNum, end: newNum, kind: "delete" });
            oldNum += count;
            continue;
        }

        if (part.added) {
            ranges.push({
                start: newNum,
                end: count > 0 ? newNum + count - 1 : newNum,
                kind: "insert",
            });
            newNum += count;
            continue;
        }

        oldNum += count; // eslint-disable-line no-unused-vars -- position tracking
        newNum += count;
    }

    return coalesceRanges(ranges);
}

export function describeChangedRanges(ranges) {
    if (!ranges?.length) return "none";
    return ranges.map(r => `${r.start}-${r.end}${r.kind ? `(${r.kind})` : ""}`).join(", ");
}

function createSnapshot(filePath, parsed, mtimeMs, size, prevSnapshot = null, revisionOverride = null) {
    const { content, lines, lineEndings, rawText, eol, defaultEol, trailingNewline } = parsed;
    const lineHashes = lines.map(line => fnv1a(line));
    const fileChecksum = computeFileChecksum(lineHashes);
    const revision = revisionOverride || `rev-${++revisionSeq}-${fileChecksum.split(":")[1]}`;
    return {
        revision,
        path: filePath,
        content,
        rawText,
        lines,
        lineEndings,
        lineHashes,
        fileChecksum,
        uniqueTagIndex: buildUniqueTagIndex(lineHashes),
        changedRangesFromPrev: prevSnapshot ? computeChangedRanges(prevSnapshot.lines, lines) : [],
        prevRevision: prevSnapshot?.revision || null,
        eol,
        defaultEol,
        trailingNewline,
        mtimeMs,
        size,
        createdAt: Date.now(),
    };
}

export function rememberSnapshot(filePath, input, meta = {}) {
    pruneExpired();
    const latest = latestByFile.get(filePath);
    const parsed = typeof input === "string"
        ? parseUtf8TextWithMetadata(input)
        : input;
    const mtimeMs = meta.mtimeMs ?? latest?.mtimeMs ?? Date.now();
    const size = meta.size ?? Buffer.byteLength(parsed.rawText, "utf8");

    if (latest && latest.content === parsed.content && latest.rawText === parsed.rawText && latest.mtimeMs === mtimeMs && latest.size === size) {
        touchFile(filePath);
        return latest;
    }

    const snapshot = latest && latest.content === parsed.content
        ? createSnapshot(filePath, parsed, mtimeMs, size, latest || null, latest.revision)
        : createSnapshot(filePath, parsed, mtimeMs, size, latest || null);
    latestByFile.set(filePath, snapshot);
    revisionsById.set(snapshot.revision, snapshot);
    rememberRevisionId(filePath, snapshot.revision);
    touchFile(filePath);
    pruneExpired();
    return snapshot;
}

export function readSnapshot(filePath) {
    pruneExpired();
    const stat = statSync(filePath);
    const latest = latestByFile.get(filePath);
    if (latest && latest.mtimeMs === stat.mtimeMs && latest.size === stat.size) {
        touchFile(filePath);
        return latest;
    }
    const parsed = readUtf8WithMetadata(filePath);
    return rememberSnapshot(filePath, parsed, { mtimeMs: stat.mtimeMs, size: stat.size });
}

export function getLatestSnapshot(filePath) {
    pruneExpired();
    const latest = latestByFile.get(filePath);
    if (!latest) return null;
    touchFile(filePath);
    return latest;
}

export function getSnapshotByRevision(revision) {
    pruneExpired();
    return revisionsById.get(revision) || null;
}

export function overlapsChangedRanges(ranges, startLine, endLine) {
    return (ranges || []).some(range => range.start <= endLine && range.end >= startLine);
}

export function buildRangeChecksum(snapshot, startLine, endLine) {
    if (startLine < 1 || endLine > snapshot.lineHashes.length || startLine > endLine) return null;
    return rangeChecksum(snapshot.lineHashes.slice(startLine - 1, endLine), startLine, endLine);
}

export function _resetSnapshotCache() {
    latestByFile.clear();
    revisionsById.clear();
    fileRevisionIds.clear();
    revisionSeq = 0;
}
