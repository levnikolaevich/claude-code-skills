/**
 * Hash-verified file editing with diff output.
 *
 * Supports:
 * - set_line / replace_lines / insert_after / replace_between
 * - dry_run preview, noop detection, diff output
 * - optional revision-aware conservative auto-rebase
 */

import { statSync, writeFileSync } from "node:fs";
import { diffLines } from "diff";
import { fnv1a, lineTag, parseChecksum, parseRef } from "@levnikolaevich/hex-common/text-protocol/hash";
import { validatePath, normalizePath } from "./security.mjs";
import { getGraphDB, semanticImpact, cloneWarning, getRelativePath, graphUnavailableHint } from "./graph-enrich.mjs";
import {
    assertNonOverlappingTargets,
    braceDelta,
    collectEditTargets,
    isAmbiguousDelimiter,
    isFileGloballyBalanced,
    lexicalBraceCounts,
    normalizeAnchoredEdits,
    sortEditsForApply,
    targetRangeForReplaceBetween,
    validateChecksumCoverage,
} from "./edit-resolution.mjs";
import { createSnapshotEntries, buildEditReadyBlock, serializeReadBlock } from "./block-protocol.mjs";
import {
    buildRangeChecksum,
    computeChangedRanges,
    describeChangedRanges,
    getSnapshotByRevision,
    overlapsChangedRanges,
    readSnapshot,
    rememberSnapshot,
} from "./snapshot.mjs";
import { ACTION, REASON, STATUS } from "./output-contract.mjs";

function asLine(value) {
    return typeof value === "string" ? value : String(value ?? "");
}

/**
 * Restore indentation from original lines onto replacement lines.
 * Preserves relative indentation structure while matching the anchor's indent level.
 */
function restoreIndent(origLines, newLines) {
    if (!origLines.length || !newLines.length) return newLines;
    const safeNewLines = newLines.map(asLine);
    const origIndent = asLine(origLines[0]).match(/^\s*/)[0];
    const newIndent = safeNewLines[0].match(/^\s*/)[0];
    if (origIndent === newIndent) return safeNewLines;
    return safeNewLines.map(line => {
        if (!line.trim()) return line;
        if (line.startsWith(newIndent)) return origIndent + line.slice(newIndent.length);
        return line;
    });
}

/**
 * Build hash-annotated snippet around a position for error or conflict messages.
 */
function buildErrorSnippet(lines, centerIdx, radius = 5) {
    const start = Math.max(0, centerIdx - radius);
    const end = Math.min(lines.length, centerIdx + radius + 1);
    const text = lines.slice(start, end).map((line, i) => {
        const num = start + i + 1;
        const tag = lineTag(fnv1a(line));
        return `${tag}.${num}\t${line}`;
    }).join("\n");
    return { start: start + 1, end, text };
}

function stripAnchorOrDiffPrefix(line) {
    let next = line;
    next = next.replace(/^\s*(?:>>|  )?[a-z2-7]{2}\.\d+\t/, "");
    next = next.replace(/^.+:(?:>>|  )[a-z2-7]{2}\.\d+\t/, "");
    next = next.replace(/^[ +-]\d+\|\s?/, "");
    return next;
}

function sanitizeEditText(text) {
    const original = String(text ?? "");
    const hadTrailingNewline = original.endsWith("\n");
    let lines = original.split("\n");
    const nonEmpty = lines.filter((line) => line.length > 0);
    if (nonEmpty.length > 0 && nonEmpty.every((line) => /^\+(?!\+)/.test(line))) {
        lines = lines.map((line) => line.startsWith("+") && !line.startsWith("++") ? line.slice(1) : line);
    }
    lines = lines.map(stripAnchorOrDiffPrefix);
    let cleaned = lines.join("\n");
    if (hadTrailingNewline && !cleaned.endsWith("\n")) cleaned += "\n";
    return cleaned;
}

function replaceLogicalRange(lines, lineEndings, startIdx, endIdx, newLines, defaultEol) {
    const removeCount = endIdx - startIdx + 1;
    const tailEnding = lineEndings[endIdx] ?? "";
    const lastIdx = lines.length - 1;

    if (newLines.length === 0) {
        lines.splice(startIdx, removeCount);
        lineEndings.splice(startIdx, removeCount);
        if (lines.length === 0) {
            lines.push("");
            lineEndings.push("");
            return;
        }
        if (endIdx === lastIdx && startIdx > 0) {
            lineEndings[startIdx - 1] = tailEnding;
        }
        return;
    }

    const newEndings = newLines.map((_, idx) => idx === newLines.length - 1 ? tailEnding : defaultEol);
    lines.splice(startIdx, removeCount, ...newLines);
    lineEndings.splice(startIdx, removeCount, ...newEndings);
}

function insertLogicalLinesAfter(lines, lineEndings, idx, newLines, defaultEol) {
    if (newLines.length === 0) return;
    let lastInsertedEnding = defaultEol;
    if ((lineEndings[idx] ?? "") === "") {
        lineEndings[idx] = defaultEol;
        lastInsertedEnding = "";
    }
    const insertedEndings = newLines.map((_, index) => index === newLines.length - 1 ? lastInsertedEnding : defaultEol);
    lines.splice(idx + 1, 0, ...newLines);
    lineEndings.splice(idx + 1, 0, ...insertedEndings);
}

function composeRawText(lines, lineEndings) {
    return lines.map((line, idx) => `${line}${lineEndings[idx] ?? ""}`).join("");
}

/**
 * Find line by tag.lineNum reference with fuzzy matching (+-5 lines).
 * Falls back to global hash relocation via hashIndex before throwing.
 */
function findLine(lines, lineNum, expectedTag, hashIndex, originalHash32) {
    const idx = lineNum - 1;
    if (idx < 0 || idx >= lines.length) {
        const center = idx >= lines.length ? lines.length - 1 : 0;
        const snip = buildErrorSnippet(lines, center);
        throw new Error(
            `Line ${lineNum} out of range (1-${lines.length}).\n\n` +
            `Current content (lines ${snip.start}-${snip.end}):\n${snip.text}\n\n` +
            `Tip: Use updated hashes above for retry.`
        );
    }

    const actual = lineTag(fnv1a(lines[idx]));
    if (actual === expectedTag) return idx;

    for (let d = 1; d <= 5; d++) {
        for (const off of [d, -d]) {
            const c = idx + off;
            if (c >= 0 && c < lines.length && lineTag(fnv1a(lines[c])) === expectedTag) return c;
        }
    }

    const stripped = lines[idx].replace(/\s+/g, "");
    if (stripped.length > 0) {
        for (let j = Math.max(0, idx - 5); j <= Math.min(lines.length - 1, idx + 5); j++) {
            if (lines[j].replace(/\s+/g, "") === stripped && lineTag(fnv1a(lines[j])) === expectedTag) return j;
        }
    }

    const CONFUSABLE_RE = /[\u2010\u2011\u2012\u2013\u2014\u2212\uFE63\uFF0D]/g;
    const norm = t => t.replace(CONFUSABLE_RE, "-");
    const normalizedExpected = norm(expectedTag);
    for (let i = Math.max(0, idx - 10); i <= Math.min(lines.length - 1, idx + 10); i++) {
        const normalizedActual = norm(lineTag(fnv1a(norm(lines[i]))));
        if (normalizedActual === normalizedExpected) return i;
    }

    let collisionDetail = "";
    if (hashIndex) {
        const relocated = hashIndex.get(expectedTag);
        if (relocated !== undefined) {
            if (originalHash32 === undefined || relocated.hash32 === originalHash32) {
                return relocated.idx;
            }
            collisionDetail = ` Nearest "${expectedTag}" at line ${relocated.idx + 1} is a hash collision (different content), not a relocation.`;
        }
    }

    const snip = buildErrorSnippet(lines, idx);
    throw new Error(
        `HASH_MISMATCH: line ${lineNum} expected ${expectedTag}, got ${actual}.${collisionDetail}\n\n` +
        `Current content (lines ${snip.start}-${snip.end}):\n${snip.text}\n\n` +
        `Tip: Re-read the target range with edit_ready=true and retry with fresh anchors.`
    );
}

/**
 * Context diff via `diff` package (Myers O(ND) algorithm).
 * Returns compact hunks with ±ctx context lines, or null if no changes.
 */
export function simpleDiff(oldLines, newLines, ctx = 3) {
    const oldText = oldLines.join("\n") + "\n";
    const newText = newLines.join("\n") + "\n";
    const parts = diffLines(oldText, newText);

    const out = [];
    let oldNum = 1, newNum = 1;
    let lastChange = false;

    for (let i = 0; i < parts.length; i++) {
        const part = parts[i];
        const lines = part.value.replace(/\n$/, "").split("\n");

        if (part.added || part.removed) {
            for (const line of lines) {
                if (part.removed) { out.push(`-${oldNum}| ${line}`); oldNum++; }
                else { out.push(`+${newNum}| ${line}`); newNum++; }
            }
            lastChange = true;
        } else {
            const next = i < parts.length - 1 && (parts[i + 1].added || parts[i + 1].removed);
            if (lastChange || next) {
                let start = 0, end = lines.length;
                if (!lastChange) start = Math.max(0, end - ctx);
                if (!next && end - start > ctx) end = start + ctx;
                if (start > 0) { out.push("..."); oldNum += start; newNum += start; }
                for (let k = start; k < end; k++) {
                    out.push(` ${oldNum}| ${lines[k]}`);
                    oldNum++; newNum++;
                }
                if (end < lines.length) {
                    out.push("...");
                    oldNum += lines.length - end;
                    newNum += lines.length - end;
                }
            } else {
                oldNum += lines.length;
                newNum += lines.length;
            }
            lastChange = false;
        }
    }
    return out.length ? out.join("\n") : null;
}

function verifyChecksumAgainstSnapshot(snapshot, rc) {
    const { start, end, hex } = parseChecksum(rc);
    const actual = buildRangeChecksum(snapshot, start, end);
    if (!actual) return { ok: false, actual: null, start, end };
    return { ok: actual.split(":")[1] === hex, actual, start, end };
}

function buildSnippetModel(lines, centerIdx) {
    const safeCenter = Math.max(0, Math.min(lines.length - 1, centerIdx));
    const snippet = buildErrorSnippet(lines, safeCenter);
    return {
        range: `${snippet.start}-${snippet.end}`,
        text: snippet.text,
    };
}

function buildRecoveryModel(filePath, { recoveryRanges = null, retryChecksum = null, retryEdit = null, retryEdits = null } = {}) {
    const normalizedRanges = dedupeRanges(recoveryRanges || []);
    const suggestedReadCall = !retryEdit && !(Array.isArray(retryEdits) && retryEdits.length > 0)
        ? buildSuggestedReadCall(filePath, normalizedRanges)
        : null;
    const retryPlan = buildRetryPlan(filePath, { recoveryRanges: normalizedRanges, retryEdit, retryEdits });
    return {
        recovery_ranges: normalizedRanges.length ? normalizedRanges : null,
        retry_checksum: retryChecksum || null,
        retry_edit: retryEdit || null,
        retry_edits: Array.isArray(retryEdits) && retryEdits.length ? retryEdits.map(parseRetryEdit).filter(Boolean) : null,
        suggested_read_call: suggestedReadCall,
        retry_plan: retryPlan,
        next_action: deriveNextAction({
            retryEdit,
            retryEdits: Array.isArray(retryEdits) && retryEdits.length ? retryEdits : null,
            suggestedReadCall,
        }),
    };
}

function buildConflictEntryModel({ lines, centerIdx, reason, details, recoveryRanges = null, retryChecksum = null, retryEdit = null, remaps = null, index = null, total = null }) {
    return {
        edit: index && total ? `${index}/${total}` : null,
        reason,
        ...buildRecoveryModel(null, { recoveryRanges, retryChecksum, retryEdit }),
        remapped_refs: formatRemaps(remaps),
        summary: summarizeConflictDetails(details),
        snippet: buildSnippetModel(lines, centerIdx),
    };
}

function renderConflictEntry(entry, { skipRetryEdit = false } = {}) {
    let msg = "";
    if (entry.edit) msg += `edit: ${entry.edit}\n`;
    msg += `reason: ${entry.reason}`;
    if (entry.recovery_ranges?.length) msg += `\nrecovery_ranges: ${entry.recovery_ranges.join(", ")}`;
    if (entry.retry_checksum) msg += `\nretry_checksum: ${entry.retry_checksum}`;
    if (entry.retry_edit && !skipRetryEdit) msg += `\nretry_edit: ${entry.retry_edit}`;
    if (entry.remapped_refs) msg += `\nremapped_refs: ${entry.remapped_refs}`;
    msg += `\nsnippet: ${entry.snippet.range}\n${entry.snippet.text}`;
    return msg;
}

function buildSingleConflictReport({
    filePath,
    reason,
    revision,
    fileChecksum,
    lines,
    centerIdx,
    changedRanges,
    recoveryRanges,
    retryChecksum,
    retryEdit,
    remaps,
    details,
}) {
    return {
        status: STATUS.CONFLICT,
        reason,
        revision,
        file: fileChecksum,
        path: filePath || null,
        changed_ranges: changedRanges ? describeChangedRanges(changedRanges) : null,
        ...buildRecoveryModel(filePath, { recoveryRanges, retryChecksum, retryEdit }),
        remapped_refs: formatRemaps(remaps),
        summary: summarizeConflictDetails(details),
        snippet: buildSnippetModel(lines, centerIdx),
    };
}

function renderSingleConflictReport(report) {
    let msg =
        `status: ${report.status}\n` +
        `reason: ${report.reason}\n` +
        `revision: ${report.revision}`;
    if (report.path) msg += `\npath: ${report.path}`;
    if (report.changed_ranges) msg += `\nchanged_ranges: ${report.changed_ranges}`;
    if (report.recovery_ranges?.length) msg += `\nrecovery_ranges: ${report.recovery_ranges.join(", ")}`;
    if (report.retry_checksum) msg += `\nretry_checksum: ${report.retry_checksum}`;
    msg += `\nnext_action: ${report.next_action}`;
    if (report.retry_edit) msg += `\nretry_edit: ${report.retry_edit}`;
    if (report.suggested_read_call) msg += `\nsuggested_read_call: ${report.suggested_read_call}`;
    if (report.retry_plan) msg += `\nretry_plan: ${report.retry_plan}`;
    if (report.remapped_refs) msg += `\nremapped_refs: ${report.remapped_refs}`;
    msg += `\nsnippet: ${report.snippet.range}\n${report.snippet.text}`;
    return msg;
}

function buildConflictMessage(args) {
    return renderSingleConflictReport(buildSingleConflictReport(args));
}

function pushRemap(remaps, remapKeys, lines, ref, idx) {
    const actualRef = `${lineTag(fnv1a(lines[idx]))}.${idx + 1}`;
    const expectedRef = `${ref.tag}.${ref.line}`;
    if (actualRef === expectedRef) return;
    const key = `${expectedRef}->${actualRef}`;
    if (remapKeys.has(key)) return;
    remapKeys.add(key);
    remaps.push({ from: expectedRef, to: actualRef });
}

function anchorAtLine(lines, lineNum) {
    const idx = lineNum - 1;
    if (idx < 0 || idx >= lines.length) return null;
    return `${lineTag(fnv1a(lines[idx]))}.${lineNum}`;
}

function stringifyRetryEdit(edit) {
    return JSON.stringify(edit);
}

function parseRetryEdit(retryEdit) {
    if (!retryEdit) return null;
    try {
        return JSON.parse(retryEdit);
    } catch {
        return null;
    }
}

function dedupeRanges(ranges) {
    if (!Array.isArray(ranges) || ranges.length === 0) return [];
    const seen = new Set();
    const out = [];
    for (const range of ranges) {
        if (!range || seen.has(range)) continue;
        seen.add(range);
        out.push(range);
    }
    return out;
}

function buildSuggestedReadCall(filePath, recoveryRanges) {
    if (!filePath || !recoveryRanges?.length) return null;
    return JSON.stringify({
        tool: "mcp__hex-line__read_file",
        arguments: {
            file_path: filePath,
            ranges: dedupeRanges(recoveryRanges),
        }
    });
}

function buildRetryPlan(filePath, { retryEdit = null, retryEdits = null } = {}) {
    if (!filePath) return null;
    const steps = [];
    const parsedRetryEdits = Array.isArray(retryEdits)
        ? retryEdits.map(parseRetryEdit).filter(Boolean)
        : [];
    const parsedRetryEdit = parsedRetryEdits.length === 0 ? parseRetryEdit(retryEdit) : null;


    if (parsedRetryEdits.length > 0) {
        steps.push({
            tool: "mcp__hex-line__edit_file",
            arguments: {
                path: filePath,
                edits: parsedRetryEdits,
                conflict_policy: "conservative",
            }
        });
    } else if (parsedRetryEdit) {
        steps.push({
            tool: "mcp__hex-line__edit_file",
            arguments: {
                path: filePath,
                edits: [parsedRetryEdit],
                conflict_policy: "conservative",
            }
        });
    }
    // No retry_edit available: suggested_read_call already covers the reread case.
    // Skip emitting a single-step read_file retry_plan (duplicates suggested_read_call).


    if (steps.length === 0) return null;
    return JSON.stringify({ steps });
}

function summarizeConflictDetails(details) {
    let summary = String(details ?? "").trim();
    if (!summary) return "Conflict requires local refresh.";
    summary = summary.split(/\n\s*\n/)[0];
    summary = summary.replace(/\s*Recovery:.*$/i, "");
    summary = summary.replace(/\s*Tip:.*$/i, "");
    summary = summary.replace(/\s+/g, " ").trim();
    return summary || "Conflict requires local refresh.";
}

function formatRemaps(remaps) {
    if (!remaps?.length) return null;
    return remaps.map(({ from, to }) => `${from}->${to}`).join(", ");
}

function deriveNextAction({ retryEdit = null, retryEdits = null, suggestedReadCall = null }) {
    if (Array.isArray(retryEdits) && retryEdits.length > 0) return ACTION.APPLY_RETRY_BATCH;
    if (retryEdit) return ACTION.APPLY_RETRY_EDIT;
    if (suggestedReadCall) return ACTION.REREAD_THEN_RETRY;
    return ACTION.INSPECT_SNIPPET;
}

function summarizeChangedSpan(minLine, maxLine) {
    return Number.isFinite(minLine) && Number.isFinite(maxLine) && minLine !== Infinity && maxLine > 0
        ? `${minLine}-${maxLine}`
        : "unknown";
}

function buildRetryEdit(edit, lines, options = {}) {
    const retryChecksum = options.retryChecksum || null;
    if (edit.set_line) {
        const ref = parseRef(edit.set_line.anchor);
        const anchor = options.startAnchor || anchorAtLine(lines, ref.line);
        if (!anchor) return null;
        return stringifyRetryEdit({ set_line: { anchor, new_text: edit.set_line.new_text } });
    }
    if (edit.insert_after) {
        const ref = parseRef(edit.insert_after.anchor);
        const anchor = options.startAnchor || anchorAtLine(lines, ref.line);
        if (!anchor) return null;
        return stringifyRetryEdit({ insert_after: { anchor, text: edit.insert_after.text } });
    }
    if (edit.replace_between) {
        const startRef = parseRef(edit.replace_between.start_anchor);
        const endRef = parseRef(edit.replace_between.end_anchor);
        const startAnchor = options.startAnchor || anchorAtLine(lines, startRef.line);
        const endAnchor = options.endAnchor || anchorAtLine(lines, endRef.line);
        if (!startAnchor || !endAnchor) return null;
        return stringifyRetryEdit({
            replace_between: {
                start_anchor: startAnchor,
                end_anchor: endAnchor,
                new_text: edit.replace_between.new_text,
                boundary_mode: edit.replace_between.boundary_mode || "inclusive",
            }
        });
    }
    if (edit.replace_lines) {
        const startRef = parseRef(edit.replace_lines.start_anchor);
        const endRef = parseRef(edit.replace_lines.end_anchor);
        const startAnchor = options.startAnchor || anchorAtLine(lines, startRef.line);
        const endAnchor = options.endAnchor || anchorAtLine(lines, endRef.line);
        if (!startAnchor || !endAnchor || !retryChecksum) return null;
        return stringifyRetryEdit({
            replace_lines: {
                start_anchor: startAnchor,
                end_anchor: endAnchor,
                new_text: edit.replace_lines.new_text,
                range_checksum: retryChecksum,
            }
        });
    }
    return null;
}

function buildBatchConflictMessage({
    filePath,
    revision,
    fileChecksum: _fileChecksum,
    lines,
    changedRanges,
    conflicts,
}) {
    const retryEdits = conflicts.map((conflict) => conflict.retryEdit).filter(Boolean);
    const recoveryRanges = dedupeRanges(conflicts.flatMap((conflict) => conflict.recoveryRanges || []));
    const parsedRetryEdits = retryEdits.map(parseRetryEdit).filter(Boolean);
    const hasCompleteRetryBatch = parsedRetryEdits.length === conflicts.length;
    const recovery = buildRecoveryModel(filePath, {
        recoveryRanges,
        retryEdits: hasCompleteRetryBatch ? retryEdits : null,
    });
    const entries = conflicts.map((conflict) => buildConflictEntryModel({
        lines,
        centerIdx: conflict.centerIdx,
        reason: conflict.reason,
        details: conflict.details,
        recoveryRanges: conflict.recoveryRanges,
        retryChecksum: conflict.retryChecksum,
        retryEdit: conflict.retryEdit,
        remaps: conflict.remaps,
        index: conflict.index,
        total: conflict.total,
    }));
    let msg =
        `status: ${STATUS.CONFLICT}\n` +
        `reason: ${REASON.BATCH_CONFLICT}\n` +
        `revision: ${revision}\n` +
        `edit_conflicts: ${conflicts.length}`;
    if (filePath) msg += `\npath: ${filePath}`;
    if (changedRanges) msg += `\nchanged_ranges: ${describeChangedRanges(changedRanges)}`;
    msg += `\nnext_action: ${recovery.next_action}`;
    if (hasCompleteRetryBatch) msg += `\nretry_edits: ${JSON.stringify(recovery.retry_edits)}`;
    if (recovery.suggested_read_call) msg += `\nsuggested_read_call: ${recovery.suggested_read_call}`;
    if (recovery.retry_plan && conflicts.length > 1) msg += `\nretry_plan: ${recovery.retry_plan}`;
    for (const entry of entries) {
        msg += `\n\n${renderConflictEntry(entry, { skipRetryEdit: conflicts.length === 1 })}`;
    }
    return msg;
}

function collectBatchConflicts({
    edits,
    baseSnapshot,
    changedRanges,
    conflictPolicy,
    currentSnapshot,
    hasBaseSnapshot,
    opts,
    staleRevision,
}) {
    if (conflictPolicy !== "conservative" || edits.length <= 1) return [];
    const conflicts = [];
    const lines = currentSnapshot.lines;
    const hashIndex = currentSnapshot.uniqueTagIndex;

    const locateRef = (ref, remaps, remapKeys) => {
        try {
            const idx = findLine(lines, ref.line, ref.tag, hashIndex, baseSnapshot?.lineHashes?.[ref.line - 1]);
            pushRemap(remaps, remapKeys, lines, ref, idx);
            return { idx };
        } catch (error) {
            return { error };
        }
    };

    const addConflict = (index, reason, centerIdx, details, retryChecksum = null, remaps = [], recoveryRanges = [], retryEdit = null) => {
        conflicts.push({
            index,
            total: edits.length,
            reason,
            centerIdx,
            details,
            retryChecksum,
            remaps,
            recoveryRanges,
            retryEdit,
        });
    };

    for (let i = 0; i < edits.length; i++) {
        const edit = edits[i];
        const remaps = [];
        const remapKeys = new Set();
        const idx1 = i + 1;

        if (edit.set_line) {
            const ref = parseRef(edit.set_line.anchor);
            const located = locateRef(ref, remaps, remapKeys);
            if (located.error) {
                addConflict(idx1, staleRevision ? "stale_anchor" : "anchor_error", Math.max(0, ref.line - 1), located.error.message, null, remaps, [`${ref.line}-${ref.line}`], buildRetryEdit(edit, lines));
                continue;
            }
            if (staleRevision && overlapsChangedRanges(changedRanges, located.idx + 1, located.idx + 1)) {
                addConflict(
                    idx1,
                    "overlap",
                    located.idx,
                    `Changes since ${opts.baseRevision} overlap edit range ${located.idx + 1}-${located.idx + 1}. Recovery: re-read lines ${located.idx + 1}-${located.idx + 1} with read_file, then retry with fresh anchors and checksum.`,
                    null,
                    remaps,
                    [`${located.idx + 1}-${located.idx + 1}`],
                );
            }
            continue;
        }

        if (edit.insert_after) {
            const ref = parseRef(edit.insert_after.anchor);
            const located = locateRef(ref, remaps, remapKeys);
            if (located.error) {
                addConflict(idx1, staleRevision ? "stale_anchor" : "anchor_error", Math.max(0, ref.line - 1), located.error.message, null, remaps, [`${ref.line}-${ref.line}`], buildRetryEdit(edit, lines));
                continue;
            }
            if (staleRevision && overlapsChangedRanges(changedRanges, located.idx + 1, located.idx + 1)) {
                addConflict(
                    idx1,
                    "overlap",
                    located.idx,
                    `Changes since ${opts.baseRevision} overlap edit range ${located.idx + 1}-${located.idx + 1}. Recovery: re-read lines ${located.idx + 1}-${located.idx + 1} with read_file, then retry with fresh anchors and checksum.`,
                    null,
                    remaps,
                    [`${located.idx + 1}-${located.idx + 1}`],
                );
            }
            continue;
        }

        if (edit.replace_between) {
            const startRef = parseRef(edit.replace_between.start_anchor);
            const endRef = parseRef(edit.replace_between.end_anchor);
            const startLocated = locateRef(startRef, remaps, remapKeys);
            if (startLocated.error) {
                addConflict(idx1, staleRevision ? "stale_anchor" : "anchor_error", Math.max(0, startRef.line - 1), startLocated.error.message, null, remaps, [`${startRef.line}-${startRef.line}`], buildRetryEdit(edit, lines));
                continue;
            }
            const endLocated = locateRef(endRef, remaps, remapKeys);
            if (endLocated.error) {
                addConflict(idx1, staleRevision ? "stale_anchor" : "anchor_error", Math.max(0, endRef.line - 1), endLocated.error.message, null, remaps, [`${endRef.line}-${endRef.line}`], buildRetryEdit(edit, lines));
                continue;
            }
            const boundaryMode = edit.replace_between.boundary_mode || "inclusive";
            const targetRange = targetRangeForReplaceBetween(startLocated.idx, endLocated.idx, boundaryMode);
            if (staleRevision && overlapsChangedRanges(changedRanges, targetRange.start, targetRange.end)) {
                addConflict(
                    idx1,
                    "overlap",
                    Math.max(0, targetRange.start - 1),
                    `Changes since ${opts.baseRevision} overlap edit range ${targetRange.start}-${targetRange.end}. Recovery: re-read lines ${targetRange.start}-${targetRange.end} with read_file, then retry with fresh anchors and checksum.`,
                    null,
                    remaps,
                    [`${targetRange.start}-${targetRange.end}`],
                );
            }
            continue;
        }

        if (edit.replace_lines) {
            const startRef = parseRef(edit.replace_lines.start_anchor);
            const endRef = parseRef(edit.replace_lines.end_anchor);
            const startLocated = locateRef(startRef, remaps, remapKeys);
            if (startLocated.error) {
                addConflict(
                    idx1,
                    staleRevision ? "stale_anchor" : "anchor_error",
                    Math.max(0, startRef.line - 1),
                    startLocated.error.message,
                    null,
                    remaps,
                    [`${startRef.line}-${startRef.line}`],
                    buildRetryEdit(edit, lines, { retryChecksum: buildRangeChecksum(currentSnapshot, startRef.line, endRef.line) }),
                );
                continue;
            }
            const endLocated = locateRef(endRef, remaps, remapKeys);
            if (endLocated.error) {
                addConflict(
                    idx1,
                    staleRevision ? "stale_anchor" : "anchor_error",
                    Math.max(0, endRef.line - 1),
                    endLocated.error.message,
                    null,
                    remaps,
                    [`${endRef.line}-${endRef.line}`],
                    buildRetryEdit(edit, lines, { retryChecksum: buildRangeChecksum(currentSnapshot, startRef.line, endRef.line) }),
                );
                continue;
            }
            const actualStart = startLocated.idx + 1;
            const actualEnd = endLocated.idx + 1;
            const exactRetryChecksum = buildRangeChecksum(currentSnapshot, actualStart, actualEnd);
            const rangeChecksum = edit.replace_lines.range_checksum;
            if (!rangeChecksum) {
                throw new Error("range_checksum required for replace_lines. Read the range first via read_file, then pass its checksum. The checksum range must cover start-to-end anchors (inclusive).");
            }

            if (staleRevision) {
                if (!hasBaseSnapshot) {
                    addConflict(
                        idx1,
                        "base_revision_evicted",
                        startLocated.idx,
                        `Base revision ${opts.baseRevision} is not available in the local revision cache. Recovery: re-read the file with read_file to get a fresh revision, then retry.`,
                        null,
                        remaps,
                        [`${actualStart}-${actualEnd}`],
                    );
                    continue;
                }
                if (overlapsChangedRanges(changedRanges, actualStart, actualEnd)) {
                    addConflict(
                        idx1,
                        "overlap",
                        startLocated.idx,
                        `Changes since ${opts.baseRevision} overlap edit range ${actualStart}-${actualEnd}. Recovery: re-read lines ${actualStart}-${actualEnd} with read_file, then retry with fresh anchors and checksum.`,
                        null,
                        remaps,
                        [`${actualStart}-${actualEnd}`],
                    );
                    continue;
                }
                const baseCheck = verifyChecksumAgainstSnapshot(baseSnapshot, rangeChecksum);
                if (!baseCheck.ok) {
                    addConflict(
                        idx1,
                        "stale_checksum",
                        startLocated.idx,
                        baseCheck.actual
                            ? `Provided checksum ${rangeChecksum} does not match base revision ${opts.baseRevision}.`
                            : `Checksum range from ${rangeChecksum} is outside the available base revision.`,
                        exactRetryChecksum || baseCheck.actual || null,
                        remaps,
                        [`${actualStart}-${actualEnd}`],
                        buildRetryEdit(edit, lines, {
                            startAnchor: `${lineTag(fnv1a(lines[startLocated.idx]))}.${actualStart}`,
                            endAnchor: `${lineTag(fnv1a(lines[endLocated.idx]))}.${actualEnd}`,
                            retryChecksum: exactRetryChecksum || baseCheck.actual || null,
                        }),
                    );
                }
                continue;
            }

            const coverage = validateChecksumCoverage(rangeChecksum, actualStart, actualEnd);
            const { start: csStart, end: csEnd, hex: csHex } = parseChecksum(rangeChecksum);
            if (!coverage.ok) {
                const retryChecksum = buildRangeChecksum(currentSnapshot, actualStart, actualEnd);
                addConflict(
                    idx1,
                    "checksum_range_gap",
                    actualStart - 1,
                    coverage.reason,
                    exactRetryChecksum || retryChecksum,
                    remaps,
                    [`${actualStart}-${actualEnd}`],
                    buildRetryEdit(edit, lines, {
                        startAnchor: `${lineTag(fnv1a(lines[startLocated.idx]))}.${actualStart}`,
                        endAnchor: `${lineTag(fnv1a(lines[endLocated.idx]))}.${actualEnd}`,
                        retryChecksum: exactRetryChecksum || retryChecksum,
                    }),
                );
                continue;
            }
            const actual = buildRangeChecksum(currentSnapshot, csStart, csEnd);
            const actualHex = actual?.split(":")[1];
            if (!actual || csHex !== actualHex) {
                addConflict(
                    idx1,
                    "stale_checksum",
                    csStart - 1,
                    `CHECKSUM_MISMATCH: expected ${rangeChecksum}, got ${actual}. Content at lines ${csStart}-${csEnd} differs from when you read it.\nRecovery: read_file path ranges=["${csStart}-${csEnd}"], then retry edit with fresh checksum.`,
                    exactRetryChecksum || actual,
                    remaps,
                    [`${actualStart}-${actualEnd}`],
                    buildRetryEdit(edit, lines, {
                        startAnchor: `${lineTag(fnv1a(lines[startLocated.idx]))}.${actualStart}`,
                        endAnchor: `${lineTag(fnv1a(lines[endLocated.idx]))}.${actualEnd}`,
                        retryChecksum: exactRetryChecksum || actual,
                    }),
                );
            }
        }
    }
    return conflicts;
}

function applySetLineEdit(edit, ctx) {
    const { lines, lineEndings, defaultEol, opts, locateOrConflict, ensureRevisionContext } = ctx;
    const { tag, line } = parseRef(edit.set_line.anchor);
    const idx = locateOrConflict({ tag, line }, "stale_anchor", () => buildRetryEdit(edit, lines));
    if (typeof idx === "string") return idx;
    const conflict = ensureRevisionContext(idx + 1, idx + 1, idx, buildRetryEdit(edit, lines, {
        startAnchor: `${lineTag(fnv1a(lines[idx]))}.${idx + 1}`,
    }));
    if (conflict) return conflict;

    const txt = edit.set_line.new_text;
    if (!txt && txt !== 0) {
        replaceLogicalRange(lines, lineEndings, idx, idx, [], defaultEol);
        return null;
    }
    const origLine = [lines[idx]];
    const raw = sanitizeEditText(txt).split("\n");
    const newLines = opts.restoreIndent ? restoreIndent(origLine, raw) : raw;
    replaceLogicalRange(lines, lineEndings, idx, idx, newLines, defaultEol);
    return null;
}

function applyInsertAfterEdit(edit, ctx) {
    const { lines, lineEndings, defaultEol, opts, locateOrConflict, ensureRevisionContext } = ctx;
    const { tag, line } = parseRef(edit.insert_after.anchor);
    const idx = locateOrConflict({ tag, line }, "stale_anchor", () => buildRetryEdit(edit, lines));
    if (typeof idx === "string") return idx;
    const conflict = ensureRevisionContext(idx + 1, idx + 1, idx, buildRetryEdit(edit, lines, {
        startAnchor: `${lineTag(fnv1a(lines[idx]))}.${idx + 1}`,
    }));
    if (conflict) return conflict;

    let insertLines = sanitizeEditText(edit.insert_after.text).split("\n");
    if (opts.restoreIndent) insertLines = restoreIndent([lines[idx]], insertLines);
    insertLogicalLinesAfter(lines, lineEndings, idx, insertLines, defaultEol);
    return null;
}

function applyReplaceLinesEdit(edit, ctx) {
    const {
        baseSnapshot,
        buildStrictChecksumMismatchError,
        conflictIfNeeded,
        currentSnapshot,
        ensureRevisionContext,
        hasBaseSnapshot,
        lineEndings,
        defaultEol,
        lines,
        locateOrConflict,
        opts,
        origLines,
        staleRevision,
    } = ctx;
    const startRef = parseRef(edit.replace_lines.start_anchor);
    const endRef = parseRef(edit.replace_lines.end_anchor);
    const startIdx = locateOrConflict(startRef, "stale_anchor", () => buildRetryEdit(edit, lines, {
        startAnchor: anchorAtLine(lines, startRef.line),
        endAnchor: anchorAtLine(lines, endRef.line),
        retryChecksum: buildRangeChecksum(currentSnapshot, startRef.line, endRef.line),
    }));
    if (typeof startIdx === "string") return startIdx;
    const endIdx = locateOrConflict(endRef, "stale_anchor", () => buildRetryEdit(edit, lines, {
        startAnchor: `${lineTag(fnv1a(lines[startIdx]))}.${startIdx + 1}`,
        endAnchor: anchorAtLine(lines, endRef.line),
        retryChecksum: buildRangeChecksum(currentSnapshot, startIdx + 1, endRef.line),
    }));
    if (typeof endIdx === "string") return endIdx;
    const actualStart = startIdx + 1;
    const actualEnd = endIdx + 1;
    const rangeChecksum = edit.replace_lines.range_checksum;
    if (!rangeChecksum) {
        throw new Error("range_checksum required for replace_lines. Read the range first via read_file, then pass its checksum. The checksum range must cover start-to-end anchors (inclusive).");
    }

    if (staleRevision && opts.conflictPolicy === "conservative") {
        const conflict = ensureRevisionContext(actualStart, actualEnd, startIdx, buildRetryEdit(edit, lines, {
            startAnchor: `${lineTag(fnv1a(lines[startIdx]))}.${actualStart}`,
            endAnchor: `${lineTag(fnv1a(lines[endIdx]))}.${actualEnd}`,
            retryChecksum: buildRangeChecksum(currentSnapshot, actualStart, actualEnd),
        }));
        if (conflict) return conflict;
        const baseCheck = hasBaseSnapshot ? verifyChecksumAgainstSnapshot(baseSnapshot, rangeChecksum) : null;
        const exactRetryChecksum = buildRangeChecksum(currentSnapshot, actualStart, actualEnd);
        if (!baseCheck?.ok) {
            return conflictIfNeeded(
                "stale_checksum",
                startIdx,
                exactRetryChecksum || baseCheck?.actual || null,
                baseCheck?.actual
                    ? `Provided checksum ${rangeChecksum} does not match base revision ${opts.baseRevision}.`
                    : `Checksum range from ${rangeChecksum} is outside the available base revision.`,
                [`${actualStart}-${actualEnd}`],
                buildRetryEdit(edit, lines, {
                    startAnchor: `${lineTag(fnv1a(lines[startIdx]))}.${actualStart}`,
                    endAnchor: `${lineTag(fnv1a(lines[endIdx]))}.${actualEnd}`,
                    retryChecksum: exactRetryChecksum || baseCheck?.actual || null,
                })
            );
        }
    } else {
        const coverage = validateChecksumCoverage(rangeChecksum, actualStart, actualEnd);
        const { start: csStart, end: csEnd, hex: csHex } = parseChecksum(rangeChecksum);
        if (!coverage.ok) {
            const snip = buildErrorSnippet(origLines, actualStart - 1);
            const retryChecksum = buildRangeChecksum(currentSnapshot, actualStart, actualEnd);
            throw new Error(
                `${coverage.reason}\n\n` +
                `Current content (lines ${snip.start}-${snip.end}):\n${snip.text}\n\n` +
                (retryChecksum ? `Retry checksum: ${retryChecksum}` : "Tip: Use updated hashes above for retry."),
            );
        }
        const actual = buildRangeChecksum(currentSnapshot, csStart, csEnd);
        const actualHex = actual?.split(":")[1];
        if (!actual || csHex !== actualHex) {
            const exactRetryChecksum = buildRangeChecksum(currentSnapshot, actualStart, actualEnd);
            const details = `CHECKSUM_MISMATCH: expected ${rangeChecksum}, got ${actual}. Content at lines ${csStart}-${csEnd} differs from when you read it.\nRecovery: read_file path ranges=["${csStart}-${csEnd}"], then retry edit with fresh checksum.`;
            if (opts.conflictPolicy === "conservative") {
                return conflictIfNeeded(
                    "stale_checksum",
                    csStart - 1,
                    exactRetryChecksum || actual,
                    details,
                    [`${actualStart}-${actualEnd}`],
                    buildRetryEdit(edit, lines, {
                        startAnchor: `${lineTag(fnv1a(lines[startIdx]))}.${actualStart}`,
                        endAnchor: `${lineTag(fnv1a(lines[endIdx]))}.${actualEnd}`,
                        retryChecksum: exactRetryChecksum || actual,
                    })
                );
            }
            throw buildStrictChecksumMismatchError(details, csStart, actual);
        }
    }

    const txt = edit.replace_lines.new_text;
    if (!txt && txt !== 0) {
        replaceLogicalRange(lines, lineEndings, startIdx, endIdx, [], defaultEol);
        return null;
    }
    const origRange = lines.slice(startIdx, endIdx + 1);
    let newLines = sanitizeEditText(txt).split("\n");
    if (opts.restoreIndent) newLines = restoreIndent(origRange, newLines);
    replaceLogicalRange(lines, lineEndings, startIdx, endIdx, newLines, defaultEol);
    return null;
}

function applyReplaceBetweenEdit(edit, ctx) {
    const {
        lines,
        lineEndings,
        defaultEol,
        opts,
        locateOrConflict,
        ensureRevisionContext,
        currentSnapshot,
        buildStrictChecksumMismatchError,
        conflictIfNeeded,
        origLines,
    } = ctx;
    const boundaryMode = edit.replace_between.boundary_mode || "inclusive";
    if (boundaryMode !== "inclusive" && boundaryMode !== "exclusive") {
        throw new Error(`BAD_INPUT: replace_between boundary_mode must be inclusive or exclusive, got ${boundaryMode}`);
    }
    const startRef = parseRef(edit.replace_between.start_anchor);
    const endRef = parseRef(edit.replace_between.end_anchor);
    const startIdx = locateOrConflict(startRef, "stale_anchor", () => buildRetryEdit(edit, lines));
    if (typeof startIdx === "string") return startIdx;
    const endIdx = locateOrConflict(endRef, "stale_anchor", () => buildRetryEdit(edit, lines, {
        startAnchor: `${lineTag(fnv1a(lines[startIdx]))}.${startIdx + 1}`,
    }));
    if (typeof endIdx === "string") return endIdx;
    if (startIdx > endIdx) {
        throw new Error(`BAD_INPUT: replace_between start anchor resolves after end anchor (${startIdx + 1} > ${endIdx + 1})`);
    }

    const targetRange = targetRangeForReplaceBetween(startIdx, endIdx, boundaryMode);
    const conflict = ensureRevisionContext(targetRange.start, targetRange.end, startIdx, buildRetryEdit(edit, lines, {
        startAnchor: `${lineTag(fnv1a(lines[startIdx]))}.${startIdx + 1}`,
        endAnchor: `${lineTag(fnv1a(lines[endIdx]))}.${endIdx + 1}`,
    }));
    if (conflict) return conflict;

    // T1c: optional range_checksum validation; on ambiguous-delimiter anchors
    // without checksum, emit lone_delimiter_anchors warning (conservative) or
    // CONFLICT before write (strict).
    const rangeChecksum = edit.replace_between.range_checksum;
    const startAmbiguous = isAmbiguousDelimiter(lines[startIdx]);
    const endAmbiguous = isAmbiguousDelimiter(lines[endIdx]);
    const bothAmbiguous = startAmbiguous && endAmbiguous;
    const actualStart = targetRange.start;
    const actualEnd = targetRange.end;

    if (rangeChecksum) {
        const coverage = validateChecksumCoverage(rangeChecksum, actualStart, actualEnd);
        if (!coverage.ok) {
            const snip = buildErrorSnippet(origLines, actualStart - 1);
            const retryChecksum = buildRangeChecksum(currentSnapshot, actualStart, actualEnd);
            throw new Error(
                `${coverage.reason}\n\n` +
                `Current content (lines ${snip.start}-${snip.end}):\n${snip.text}\n\n` +
                (retryChecksum ? `Retry checksum: ${retryChecksum}` : "Tip: Use updated hashes above for retry."),
            );
        }
        const { start: csStart, end: csEnd, hex: csHex } = parseChecksum(rangeChecksum);
        const actual = buildRangeChecksum(currentSnapshot, csStart, csEnd);
        const actualHex = actual?.split(":")[1];
        if (!actual || csHex !== actualHex) {
            const exactRetryChecksum = buildRangeChecksum(currentSnapshot, actualStart, actualEnd);
            const details = `CHECKSUM_MISMATCH: expected ${rangeChecksum}, got ${actual}. Content at lines ${csStart}-${csEnd} differs from when you read it.\nRecovery: read_file path ranges=["${csStart}-${csEnd}"], then retry edit with fresh checksum.`;
            if (opts.conflictPolicy !== "strict") {
                return conflictIfNeeded(
                    "stale_checksum",
                    csStart - 1,
                    exactRetryChecksum || actual,
                    details,
                    [`${actualStart}-${actualEnd}`],
                    buildRetryEdit(edit, lines, {
                        startAnchor: `${lineTag(fnv1a(lines[startIdx]))}.${actualStart}`,
                        endAnchor: `${lineTag(fnv1a(lines[endIdx]))}.${actualEnd}`,
                        retryChecksum: exactRetryChecksum || actual,
                    })
                );
            }
            throw buildStrictChecksumMismatchError(details, csStart, actual);
        }
    } else if (bothAmbiguous) {
        if (opts.conflictPolicy !== "strict") {
            ctx.warnings.push({
                code: "lone_delimiter_anchors",
                suggestion: "provide range_checksum or use replace_lines",
                start_anchor_line: startIdx + 1,
                end_anchor_line: endIdx + 1,
            });
        } else {
            const retryChecksum = buildRangeChecksum(currentSnapshot, actualStart, actualEnd);
            return conflictIfNeeded(
                "lone_delimiter_anchors",
                startIdx,
                retryChecksum,
                `Both replace_between anchors are lone delimiters (line-content hashes are ambiguous and may match a sibling closing delimiter). Provide range_checksum to disambiguate, or use replace_lines with range_checksum.`,
                [`${actualStart}-${actualEnd}`],
                buildRetryEdit(edit, lines, {
                    startAnchor: `${lineTag(fnv1a(lines[startIdx]))}.${startIdx + 1}`,
                    endAnchor: `${lineTag(fnv1a(lines[endIdx]))}.${endIdx + 1}`,
                    retryChecksum,
                })
            );
        }
    }

    const txt = edit.replace_between.new_text;
    let newLines = sanitizeEditText(txt ?? "").split("\n");
    const sliceStart = boundaryMode === "exclusive" ? startIdx + 1 : startIdx;
    const removeCount = boundaryMode === "exclusive" ? Math.max(0, endIdx - startIdx - 1) : (endIdx - startIdx + 1);
    const origRange = lines.slice(sliceStart, sliceStart + removeCount);
    if (opts.restoreIndent && origRange.length > 0) newLines = restoreIndent(origRange, newLines);
    if (txt === "" || txt === null) newLines = [];
    if (removeCount === 0) {
        insertLogicalLinesAfter(lines, lineEndings, sliceStart - 1, newLines, defaultEol);
        return null;
    }
    replaceLogicalRange(lines, lineEndings, sliceStart, sliceStart + removeCount - 1, newLines, defaultEol);

    // T1a: auto-strip duplicate boundary lines, BUT preserve structural closing
    // delimiters (}, ), ], });, etc). For those, hash-only match cannot tell an
    // LLM echo apart from a legitimate sibling brace of an outer scope — silent
    // deletion there produces CS1513-style errors far from the actual cause.
    let boundaryEchoSkipped = false;
    const insertEnd = sliceStart + newLines.length;
    if (newLines.length > 0 && insertEnd < lines.length) {
        const lastNew = asLine(newLines[newLines.length - 1]).trim();
        const firstAfter = asLine(lines[insertEnd]).trim();
        if (lastNew && lastNew === firstAfter) {
            if (isAmbiguousDelimiter(firstAfter)) {
                boundaryEchoSkipped = true;
                ctx.warnings.push({
                    code: "boundary_echo_skipped",
                    position: "tail",
                    line: insertEnd + 1,
                    content: firstAfter,
                });
            } else {
                lines.splice(insertEnd, 1);
                lineEndings.splice(insertEnd, 1);
                ctx.corrections.push({ type: "tail_echo", line: insertEnd + 1, content: firstAfter });
            }
        }
    }
    if (newLines.length > 0 && sliceStart > 0) {
        const firstNew = asLine(newLines[0]).trim();
        const lineBefore = asLine(lines[sliceStart - 1]).trim();
        if (firstNew && firstNew === lineBefore) {
            if (isAmbiguousDelimiter(lineBefore)) {
                boundaryEchoSkipped = true;
                ctx.warnings.push({
                    code: "boundary_echo_skipped",
                    position: "head",
                    line: sliceStart,
                    content: lineBefore,
                });
            } else {
                lines.splice(sliceStart - 1, 1);
                lineEndings.splice(sliceStart - 1, 1);
                ctx.corrections.push({ type: "head_echo", line: sliceStart, content: lineBefore });
            }
        }
    }

    // T1b: advisory post-edit lexical brace balance check. Heuristic only —
    // lexical counts ignore strings/template literals/JSX/comments. Gated on a
    // structural-risk signal so normal edits involving strings with braces
    // don't trigger noisy warnings.
    const delta = braceDelta(origRange, newLines);
    if (delta.totalAbs >= 2) {
        const preCounts = lexicalBraceCounts(origLines);
        if (isFileGloballyBalanced(preCounts)) {
            const postCounts = lexicalBraceCounts(lines);
            if (!isFileGloballyBalanced(postCounts)) {
                const hasStructuralSignal =
                    startAmbiguous ||
                    endAmbiguous ||
                    boundaryEchoSkipped ||
                    newLines.some(l => isAmbiguousDelimiter(l)) ||
                    origRange.some(l => isAmbiguousDelimiter(l));
                if (hasStructuralSignal) {
                    ctx.warnings.push({
                        code: "brace_imbalance",
                        delta: { brace: delta.brace, paren: delta.paren, bracket: delta.bracket },
                        range: [sliceStart + 1, sliceStart + newLines.length],
                    });
                }
            }
        }
    }

    return null;
}

/**
 * Apply edits to a file.
 *
 * @param {string} filePath
 * @param {Array} edits - parsed edit objects
 * @param {object} opts - { dryRun, restoreIndent, baseRevision, conflictPolicy }
 * @returns {string} result message with diff
 */
export function editFile(filePath, edits, opts = {}) {
    filePath = normalizePath(filePath);
    const real = validatePath(filePath);
    const currentSnapshot = readSnapshot(real);
    const baseSnapshot = opts.baseRevision ? getSnapshotByRevision(opts.baseRevision) : null;
    const hasBaseSnapshot = !!(baseSnapshot && baseSnapshot.path === real);
    const staleRevision = !!opts.baseRevision && opts.baseRevision !== currentSnapshot.revision && hasBaseSnapshot;
    const changedRanges = staleRevision && hasBaseSnapshot
        ? computeChangedRanges(baseSnapshot.lines, currentSnapshot.lines)
        : [];
    const conflictPolicy = opts.conflictPolicy || "conservative";

    const originalRaw = currentSnapshot.rawText;
    const lines = [...currentSnapshot.lines];
    const lineEndings = [...currentSnapshot.lineEndings];
    const origLines = [...currentSnapshot.lines];
    const hashIndex = currentSnapshot.uniqueTagIndex;
    const defaultEol = currentSnapshot.defaultEol || "\n";
    let autoRebased = false;
    const remaps = [];
    const remapKeys = new Set();

    const anchored = normalizeAnchoredEdits(edits);
    assertNonOverlappingTargets(collectEditTargets(anchored));
    const sorted = sortEditsForApply(anchored);

    const buildStrictConflictError = (reason, centerIdx, details, recoveryRanges = null, retryChecksum = null, retryEdit = null) => {
        const safeCenter = Math.max(0, Math.min(lines.length - 1, centerIdx));
        const snip = buildErrorSnippet(lines, safeCenter);
        const suggestedReadCall = !retryEdit ? buildSuggestedReadCall(filePath, recoveryRanges) : null;
        const retryPlan = buildRetryPlan(filePath, { recoveryRanges, retryEdit });
        const nextAction = deriveNextAction({ retryEdit, suggestedReadCall });
        let msg =
            `status: ${STATUS.CONFLICT}\n` +
            `reason: ${reason}\n` +
            `revision: ${currentSnapshot.revision}`;
        if (filePath) msg += `\npath: ${filePath}`;
        if (staleRevision && hasBaseSnapshot) msg += `\nchanged_ranges: ${describeChangedRanges(changedRanges)}`;
        if (recoveryRanges?.length) msg += `\nrecovery_ranges: ${recoveryRanges.join(", ")}`;
        if (retryChecksum) msg += `\nretry_checksum: ${retryChecksum}`;
        msg += `\nnext_action: ${nextAction}`;
        if (retryEdit) msg += `\nretry_edit: ${retryEdit}`;
        if (suggestedReadCall) msg += `\nsuggested_read_call: ${suggestedReadCall}`;
        if (retryPlan) msg += `\nretry_plan: ${retryPlan}`;
        msg += `\nsnippet: ${snip.start}-${snip.end}\n${snip.text}`;
        return new Error(msg);
    };

    const conflictIfNeeded = (reason, centerIdx, retryChecksum, details, recoveryRanges = null, retryEdit = null) => {
        if (conflictPolicy !== "conservative") {
            throw buildStrictConflictError(reason, centerIdx, details, recoveryRanges, retryChecksum, retryEdit);
        }
        return buildConflictMessage({
            filePath,
            reason,
            revision: currentSnapshot.revision,
            fileChecksum: currentSnapshot.fileChecksum,
            lines,
            centerIdx,
            changedRanges: staleRevision && hasBaseSnapshot ? changedRanges : null,
            recoveryRanges,
            retryChecksum,
            retryEdit,
            remaps,
            details,
        });
    };

    const trackRemap = (ref, idx) => {
        pushRemap(remaps, remapKeys, lines, ref, idx);
    };

    const locateOrConflict = (ref, reason = "stale_anchor", retryEditBuilder = null) => {
        try {
            const idx = findLine(lines, ref.line, ref.tag, hashIndex, baseSnapshot?.lineHashes?.[ref.line - 1]);
            trackRemap(ref, idx);
            return idx;
        } catch (e) {
            if (conflictPolicy !== "conservative" || !staleRevision) throw e;
            const centerIdx = Math.max(0, Math.min(lines.length - 1, ref.line - 1));
            return conflictIfNeeded(
                reason,
                centerIdx,
                null,
                e.message,
                [`${ref.line}-${ref.line}`],
                typeof retryEditBuilder === "function" ? retryEditBuilder() : null,
            );
        }
    };

    const ensureRevisionContext = (actualStart, actualEnd, centerIdx, retryEdit = null) => {
        if (!staleRevision || conflictPolicy !== "conservative") return null;
        if (!hasBaseSnapshot) {
            return conflictIfNeeded(
                "base_revision_evicted",
                centerIdx,
                null,
                `Base revision ${opts.baseRevision} is not available in the local revision cache. Recovery: re-read the file with read_file to get a fresh revision, then retry.`,
                [`${actualStart}-${actualEnd}`],
                retryEdit,
            );
        }
        if (overlapsChangedRanges(changedRanges, actualStart, actualEnd)) {
            return conflictIfNeeded(
                "overlap",
                centerIdx,
                null,
                `Changes since ${opts.baseRevision} overlap edit range ${actualStart}-${actualEnd}. Recovery: re-read lines ${actualStart}-${actualEnd} with read_file, then retry with fresh anchors and checksum.`,
                [`${actualStart}-${actualEnd}`],
                retryEdit,
            );
        }
        autoRebased = true;
        return null;
    };

    const buildStrictChecksumMismatchError = (details, checksumStart, actual) => buildStrictConflictError(
        "stale_checksum",
        checksumStart - 1,
        details,
        [`${checksumStart}-${checksumStart}`],
        actual,
        null,
    );

    const editContext = {
        baseSnapshot,
        buildStrictChecksumMismatchError,
        conflictIfNeeded,
        currentSnapshot,
        ensureRevisionContext,
        hasBaseSnapshot,
        lines,
        lineEndings,
        defaultEol,
        locateOrConflict,
        opts,
        origLines,
        staleRevision,
        corrections: [],
        warnings: [],
    };

    const batchConflicts = collectBatchConflicts({
        edits: anchored,
        baseSnapshot,
        changedRanges,
        conflictPolicy,
        currentSnapshot,
        hasBaseSnapshot,
        opts,
        staleRevision,
    });
    if (batchConflicts.length > 0) {
        return buildBatchConflictMessage({
            filePath,
            revision: currentSnapshot.revision,
            fileChecksum: currentSnapshot.fileChecksum,
            lines,
            changedRanges: staleRevision && hasBaseSnapshot ? changedRanges : null,
            conflicts: batchConflicts,
        });
    }

    for (let _ei = 0; _ei < sorted.length; _ei++) {
        const e = sorted[_ei];
        try {
            let conflictResult = null;
            if (e.set_line) conflictResult = applySetLineEdit(e, editContext);
            else if (e.insert_after) conflictResult = applyInsertAfterEdit(e, editContext);
            else if (e.replace_lines) conflictResult = applyReplaceLinesEdit(e, editContext);
            else if (e.replace_between) conflictResult = applyReplaceBetweenEdit(e, editContext);
            if (typeof conflictResult === "string") return conflictResult;
        } catch (editErr) {
            if (sorted.length > 1) editErr.message = `Edit ${_ei + 1}/${sorted.length}: ${editErr.message}`;
            throw editErr;
        }
    }

    const content = composeRawText(lines, lineEndings);

    if (originalRaw === content) {
        throw new Error("NOOP_EDIT: File already contains the desired content. No changes needed.");
    }


    const fullDiff = simpleDiff(origLines, lines);
    const newLinesAll = lines;
    let minLine = Infinity, maxLine = 0;
    if (fullDiff) {
        for (const dl of fullDiff.split("\n")) {
            const m = dl.match(/^[+-](\d+)\|/);
            if (m) {
                const n = +m[1];
                if (n < minLine) minLine = n;
                if (n > maxLine) maxLine = n;
            }
        }
    }
    const changedSpan = summarizeChangedSpan(minLine, maxLine);

    if (opts.dryRun) {
        let msg = `status: ${autoRebased ? STATUS.AUTO_REBASED : STATUS.OK}\nreason: ${REASON.DRY_RUN_PREVIEW}\nrevision: ${currentSnapshot.revision}`;
        if (staleRevision && hasBaseSnapshot) msg += `\nchanged_ranges: ${describeChangedRanges(changedRanges)}`;
        msg += `\nsummary: lines_changed=${changedSpan} lines_after=${lines.length}`;
        const hint = graphUnavailableHint(real);
        if (hint.length > 0) msg += `\n${hint.join("\n")}`;
        msg += `\nDry run: ${filePath} would change (${lines.length} lines)`;
        return msg;
    }

    writeFileSync(real, content, "utf-8");
    const nextStat = statSync(real);
    const nextSnapshot = rememberSnapshot(real, content, { mtimeMs: nextStat.mtimeMs, size: nextStat.size });
    // Determine single canonical next_action: warnings take precedence over the
    // auto-rebased KEEP_USING hint (reread_range when anchor ambiguity detected,
    // review_risks for structural heuristic signals).
    const warnings = editContext.warnings;
    let warningsNextAction = null;
    if (warnings.length > 0) {
        const codes = new Set(warnings.map(w => w.code));
        if (codes.has("lone_delimiter_anchors")) warningsNextAction = ACTION.REREAD_RANGE;
        else if (codes.has("brace_imbalance") || codes.has("boundary_echo_skipped")) warningsNextAction = ACTION.REVIEW_RISKS;
    }
    const nextActionValue = warningsNextAction || (autoRebased && staleRevision && hasBaseSnapshot ? ACTION.KEEP_USING : null);

    let msg =
        `status: ${autoRebased ? STATUS.AUTO_REBASED : STATUS.OK}\n` +
        `revision: ${nextSnapshot.revision}`;
    if (autoRebased && staleRevision && hasBaseSnapshot) {
        msg += `\nchanged_ranges: ${describeChangedRanges(changedRanges)}`;
    }
    if (nextActionValue) {
        msg += `\nnext_action: ${nextActionValue}`;
    }
    if (remaps.length > 0) {
        msg += `\nremapped_refs:\n${remaps.map(({ from, to }) => `${from} -> ${to}`).join("\n")}`;
    }
    if (warnings.length > 0) {
        msg += `\nwarnings: ${JSON.stringify(warnings)}`;
    }
    let semanticImpacts = [];
    let cloneWarnings = [];
    let graphDbAvailable = false;

    // Post-edit context (before diff — always visible even if output truncated)
    if (fullDiff && minLine <= maxLine) {
        const ctxStart = Math.max(0, minLine - 4) + 1; // 1-indexed for snapshot (±3 lines context)
        const ctxEnd = Math.min(newLinesAll.length, maxLine + 3);
        const entries = createSnapshotEntries(nextSnapshot, ctxStart, ctxEnd);
        if (entries.length > 0) {
            const block = buildEditReadyBlock({
                path: real,
                kind: "post_edit",
                entries,
                meta: {
                    eol: nextSnapshot.eol,
                    trailing_newline: nextSnapshot.trailingNewline,
                },
            });
            msg += `\n\n${serializeReadBlock(block)}`;
        }
    }

    // Graph enrichment: semantic impact + clone warnings
    try {
        const db = getGraphDB(real, { allowStale: true });
        const relFile = db ? getRelativePath(real) : null;
        if (db && relFile && fullDiff && minLine <= maxLine) {
            graphDbAvailable = true;
            semanticImpacts = semanticImpact(db, relFile, minLine, maxLine);
            if (semanticImpacts.length > 0) {
                const sections = semanticImpacts.map(impact => {
                    const totals = [];
                    if (impact.counts.publicApi > 0) totals.push("public API");
                    if (impact.counts.frameworkEntrypoints > 0) totals.push(`${impact.counts.frameworkEntrypoints} framework entrypoint`);
                    if (impact.counts.externalCallers > 0) totals.push(`${impact.counts.externalCallers} external callers`);
                    if (impact.counts.downstreamReturnFlow > 0) totals.push(`${impact.counts.downstreamReturnFlow} downstream return-flow`);
                    if (impact.counts.downstreamPropertyFlow > 0) totals.push(`${impact.counts.downstreamPropertyFlow} property-flow`);
                    if (impact.counts.sinkReach > 0) totals.push(`${impact.counts.sinkReach} terminal flow reach`);
                    if (impact.counts.cloneSiblings > 0) totals.push(`${impact.counts.cloneSiblings} clone siblings`);
                    if (impact.counts.sameNameSymbols > 0) totals.push(`${impact.counts.sameNameSymbols} same-name siblings`);
                    const headline = totals.length > 0 ? totals.join(", ") : "no downstream graph facts";
                    const factLines = impact.facts.slice(0, 6).map(fact => {
                        if (fact.fact_kind === "public_api") return null;
                        const location = fact.target_file && fact.target_line
                            ? ` (${fact.target_file}:${fact.target_line})`
                            : "";
                        const target = fact.target_display_name
                            ? `${fact.target_display_name}${location}`
                            : `${fact.target_file}:${fact.target_line}`;
                        const via = fact.path_kind ? ` via ${fact.path_kind}` : "";
                        return `${fact.fact_kind}: ${target}${via}`;
                    }).filter(Boolean);
                    return [
                        `${impact.symbol}: ${headline}`,
                        ...factLines.map(line => `.${line}`),
                    ].join("\n");
                });
                msg += `\n\n#semantic_impact\n${sections.join("\n")}`;
            }
            cloneWarnings = cloneWarning(db, relFile, minLine, maxLine);
            if (cloneWarnings.length > 0) {
                const list = cloneWarnings.map(c => `${c.file}:${c.line}${c.cloneType ? ` (${c.cloneType})` : ""}`).join(", ");
                msg += `\n\n!clone_siblings count=${cloneWarnings.length} list=${list}`;
            }
        }
    } catch { /* silent */ }

    const summaryLineParts = [
        `summary: lines_changed=${changedSpan} lines_after=${lines.length}`,
    ];
    if (!graphDbAvailable) summaryLineParts.push(...graphUnavailableHint(real));
    const summaryLines = summaryLineParts.join("\n");
    msg = msg.replace(/\nrevision: ([^\n]+)/, `\nrevision: $1\n${summaryLines}`);

    return msg;
}
