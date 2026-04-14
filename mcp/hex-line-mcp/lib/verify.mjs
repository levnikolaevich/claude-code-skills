/**
 * Canonical checksum verification against the snapshot kernel.
 * Reports valid/stale/invalid checksum state deterministically.
 */

import { parseChecksum } from "@levnikolaevich/hex-common/text-protocol/hash";
import { validatePath, normalizePath } from "./security.mjs";
import {
    buildRangeChecksum,
    computeChangedRanges,
    describeChangedRanges,
    getSnapshotByRevision,
    readSnapshot,
} from "./snapshot.mjs";
import { ACTION, REASON, STATUS } from "./output-contract.mjs";

function parseChecksumEntry(raw) {
    try {
        return { ok: true, raw, parsed: parseChecksum(raw) };
    } catch (error) {
        return {
            ok: false,
            raw,
            error: error instanceof Error ? error.message : String(error),
        };
    }
}

function classifyChecksum(currentSnapshot, entry) {
    if (!entry.ok) {
        return {
            status: "INVALID",
            checksum: entry.raw,
            span: null,
            currentChecksum: null,
            reason: entry.error.replace(/^Bad checksum:\s*/, "format error: "),
        };
    }
    const { start, end } = entry.parsed;
    if (start < 1 || end < start) {
        return {
            status: "INVALID",
            checksum: entry.raw,
            span: `${start}-${end}`,
            currentChecksum: null,
            reason: `invalid range ${start}-${end}`,
        };
    }
    if (end > currentSnapshot.lines.length) {
        return {
            status: "INVALID",
            checksum: entry.raw,
            span: `${start}-${end}`,
            currentChecksum: null,
            reason: `range ${start}-${end} exceeds file length ${currentSnapshot.lines.length}`,
        };
    }
    const currentChecksum = buildRangeChecksum(currentSnapshot, start, end);
    if (currentChecksum === entry.raw) {
        return {
            status: "VALID",
            checksum: entry.raw,
            span: `${start}-${end}`,
            currentChecksum,
            reason: null,
        };
    }
    return {
        status: "STALE",
        checksum: entry.raw,
        span: `${start}-${end}`,
        currentChecksum,
        reason: `content changed since the checksum was captured. Recovery: read_file ranges=["${start}-${end}"] to get fresh content.`,
    };
}

function summarizeStatuses(entries) {
    return entries.reduce((acc, entry) => {
        const key = entry.status.toLowerCase();
        acc[key] += 1;
        return acc;
    }, { valid: 0, stale: 0, invalid: 0 });
}

function buildSuggestedReadCall(filePath, ranges) {
    const deduped = [...new Set((ranges || []).filter(Boolean))];
    if (!filePath || deduped.length === 0) return null;
    return JSON.stringify({
        tool: "mcp__hex-line__read_file",
        arguments: {
            path: filePath,
            ranges: deduped,
        }
    });
}

function entryNextAction(entry) {
    if (entry.status === "VALID") return ACTION.KEEP_USING;
    if (entry.status === "STALE") return ACTION.REREAD_RANGE;
    if (entry.span) return ACTION.FIX_INPUT_OR_REREAD;
    return ACTION.FIX_INPUT;
}

function overallNextAction(summary) {
    if (summary.invalid > 0 && summary.stale > 0) return ACTION.FIX_INPUTS_THEN_REREAD;
    if (summary.invalid > 0) return ACTION.FIX_INPUTS;
    if (summary.stale > 0) return ACTION.REREAD_RANGES;
    return ACTION.KEEP_USING;
}

function overallReason(status) {
    if (status === STATUS.OK) return REASON.CHECKSUMS_CURRENT;
    if (status === STATUS.STALE) return REASON.CHECKSUMS_STALE;
    return REASON.CHECKSUMS_INVALID;
}

function entrySummary(entry) {
    if (entry.status === "VALID") return "checksum still current";
    if (entry.status === "STALE") return "content changed since checksum capture";
    return entry.reason;
}

function renderEntry(entry, index, total, topLevelNextAction) {
    const parts = [
        `entry: ${index}/${total}`,
        `status: ${entry.status}`,
        entry.span ? `span: ${entry.span}` : null,
        `checksum: ${entry.checksum}`,
        entry.currentChecksum && entry.currentChecksum !== entry.checksum ? `current_checksum: ${entry.currentChecksum}` : null,
    ].filter(Boolean);
    const action = entryNextAction(entry);
    if (action !== topLevelNextAction) parts.push(`next_action: ${action}`);
    if (entry.status !== "VALID") parts.push(`summary: ${entrySummary(entry)}`);
    return parts.join(" | ");
}

export function verifyChecksums(filePath, checksums, opts = {}) {
    filePath = normalizePath(filePath);
    const real = validatePath(filePath);
    const currentSnapshot = readSnapshot(real);
    const baseSnapshot = opts.baseRevision ? getSnapshotByRevision(opts.baseRevision) : null;
    const hasBaseSnapshot = !!(baseSnapshot && baseSnapshot.path === real);
    const parsedEntries = (checksums || []).map(parseChecksumEntry);
    const results = parsedEntries.map(entry => classifyChecksum(currentSnapshot, entry));
    const summary = summarizeStatuses(results);
    const status = summary.invalid > 0 ? STATUS.INVALID
        : summary.stale > 0 ? STATUS.STALE
            : STATUS.OK;
    const staleRanges = results.filter((entry) => entry.status === "STALE" && entry.span).map((entry) => entry.span);
    const topLevelNextAction = overallNextAction(summary);
    const verboseSummary = results.length > 1 || summary.stale > 0 || summary.invalid > 0;
    const lines = [
        `status: ${status}`,
        `reason: ${overallReason(status)}`,
        `revision: ${currentSnapshot.revision}`,
    ];
    if (verboseSummary) lines.push(`summary: valid=${summary.valid} stale=${summary.stale} invalid=${summary.invalid}`);
    lines.push(`next_action: ${topLevelNextAction}`);

    if (opts.baseRevision && opts.baseRevision !== currentSnapshot.revision) {
        lines.push(`base_revision: ${opts.baseRevision}`);
        if (hasBaseSnapshot) {
            const changed = describeChangedRanges(computeChangedRanges(baseSnapshot.lines, currentSnapshot.lines));
            if (changed !== "none") lines.push(`changed_ranges: ${changed}`);
        } else {
            lines.push("base_revision_status: evicted");
        }
    }

    const suggestedReadCall = buildSuggestedReadCall(filePath, staleRanges);
    if (suggestedReadCall) lines.push(`suggested_read_call: ${suggestedReadCall}`);

    if (results.length > 0) {
        lines.push("", ...results.map((entry, index) => renderEntry(entry, index + 1, results.length, topLevelNextAction)));
    }

    return lines.join("\n");
}
