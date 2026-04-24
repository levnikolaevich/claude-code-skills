/**
 * Deterministic edit-resolution helpers for edit_file.
 *
 * These helpers keep planning and overlap validation separate from the
 * line-location/apply phase so the edit pipeline stays explicit:
 * parse -> plan -> validate -> order -> apply.
 */

import { parseChecksum, parseRef } from "@levnikolaevich/hex-common/text-protocol/hash";

function badInput(message) {
    const err = new Error(`BAD_INPUT: ${message}`);
    err.code = "BAD_INPUT";
    err.recovery = "Use canonical edit shapes with required string fields: set_line.anchor/new_text, insert_after.anchor/text, replace_lines.start_anchor/end_anchor/range_checksum/new_text, or replace_between.start_anchor/end_anchor/new_text.";
    return err;
}

function requirePlainObject(value, path) {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
        throw badInput(`${path} must be an object`);
    }
}

function requireString(value, path) {
    if (typeof value !== "string") {
        throw badInput(`${path} must be a string`);
    }
}

function requireOptionalString(value, path) {
    if (value !== undefined && typeof value !== "string") {
        throw badInput(`${path} must be a string when provided`);
    }
}

function validateEditShape(edit) {
    requirePlainObject(edit, "edit");
    const kinds = ["set_line", "replace_lines", "insert_after", "replace_between"].filter((kind) => edit[kind] !== undefined);
    if (kinds.length !== 1) {
        if (edit.replace) {
            throw new Error("REPLACE_REMOVED: replace is no longer supported in edit_file. Use set_line/replace_lines for single edits, bulk_replace tool for rename/refactor.");
        }
        if (kinds.length === 0) throw badInput(`unknown edit type: ${JSON.stringify(edit)}`);
        throw badInput(`exactly one edit type is allowed, got ${kinds.join(", ")}`);
    }

    const kind = kinds[0];
    if (kind === "set_line") {
        requirePlainObject(edit.set_line, "set_line");
        requireString(edit.set_line.anchor, "set_line.anchor");
        requireString(edit.set_line.new_text, "set_line.new_text");
        return;
    }

    if (kind === "insert_after") {
        requirePlainObject(edit.insert_after, "insert_after");
        requireString(edit.insert_after.anchor, "insert_after.anchor");
        requireString(edit.insert_after.text, "insert_after.text");
        return;
    }

    if (kind === "replace_lines") {
        requirePlainObject(edit.replace_lines, "replace_lines");
        requireString(edit.replace_lines.start_anchor, "replace_lines.start_anchor");
        requireString(edit.replace_lines.end_anchor, "replace_lines.end_anchor");
        requireString(edit.replace_lines.range_checksum, "replace_lines.range_checksum");
        requireString(edit.replace_lines.new_text, "replace_lines.new_text");
        return;
    }

    requirePlainObject(edit.replace_between, "replace_between");
    requireString(edit.replace_between.start_anchor, "replace_between.start_anchor");
    requireString(edit.replace_between.end_anchor, "replace_between.end_anchor");
    requireString(edit.replace_between.new_text, "replace_between.new_text");
    requireOptionalString(edit.replace_between.range_checksum, "replace_between.range_checksum");
    if (edit.replace_between.boundary_mode !== undefined && !["inclusive", "exclusive"].includes(edit.replace_between.boundary_mode)) {
        throw badInput("replace_between.boundary_mode must be \"inclusive\" or \"exclusive\"");
    }
}

export function normalizeAnchoredEdits(edits) {
    if (!Array.isArray(edits)) {
        throw badInput("edits must be a non-empty array");
    }
    if (edits.length === 0) {
        throw badInput("edits must be a non-empty array");
    }
    const anchored = [];
    for (const edit of edits) {
        validateEditShape(edit);
        anchored.push(edit);
    }
    return anchored;
}

export function getEditStartLine(edit) {
    if (edit.set_line) return parseRef(edit.set_line.anchor).line;
    if (edit.replace_lines) return parseRef(edit.replace_lines.start_anchor).line;
    if (edit.insert_after) return parseRef(edit.insert_after.anchor).line;
    if (edit.replace_between) return parseRef(edit.replace_between.start_anchor).line;
    throw new Error(`BAD_INPUT: unsupported edit shape: ${JSON.stringify(edit)}`);
}

export function collectEditTargets(edits) {
    return edits.map((edit) => {
        if (edit.set_line) {
            const line = parseRef(edit.set_line.anchor).line;
            return { start: line, end: line, insert: false, kind: "set_line" };
        }
        if (edit.replace_lines) {
            const start = parseRef(edit.replace_lines.start_anchor).line;
            const end = parseRef(edit.replace_lines.end_anchor).line;
            return { start, end, insert: false, kind: "replace_lines" };
        }
        if (edit.insert_after) {
            const line = parseRef(edit.insert_after.anchor).line;
            return { start: line, end: line, insert: true, kind: "insert_after" };
        }
        if (edit.replace_between) {
            const start = parseRef(edit.replace_between.start_anchor).line;
            const end = parseRef(edit.replace_between.end_anchor).line;
            return { start, end, insert: false, kind: "replace_between" };
        }
        throw new Error(`BAD_INPUT: unsupported edit shape: ${JSON.stringify(edit)}`);
    });
}

export function assertNonOverlappingTargets(targets) {
    for (let i = 0; i < targets.length; i++) {
        for (let j = i + 1; j < targets.length; j++) {
            const a = targets[i];
            const b = targets[j];
            if (a.insert || b.insert) continue;
            if (a.start <= b.end && b.start <= a.end) {
                throw new Error(
                    `OVERLAPPING_EDITS: lines ${a.start}-${a.end} and ${b.start}-${b.end} overlap. Split into separate edit_file calls.`,
                );
            }
        }
    }
}

export function sortEditsForApply(edits) {
    return edits
        .map(edit => ({ ...edit, _k: getEditStartLine(edit) }))
        .sort((a, b) => b._k - a._k);
}

export function targetRangeForReplaceBetween(startIdx, endIdx, boundaryMode) {
    if (boundaryMode === "exclusive") {
        return { start: startIdx + 2, end: Math.max(startIdx + 1, endIdx) };
    }
    return { start: startIdx + 1, end: endIdx + 1 };
}

export function validateChecksumCoverage(rangeChecksum, actualStart, actualEnd) {
    const { start, end } = parseChecksum(rangeChecksum);
    if (start > actualStart || end < actualEnd) {
        return {
            ok: false,
            start,
            end,
            reason: `CHECKSUM_RANGE_GAP: checksum covers lines ${start}-${end} but edit spans ${actualStart}-${actualEnd} (inclusive). Checksum range must fully contain the anchor range.`,
        };
    }
    return { ok: true, start, end, reason: null };
}

/**
 * Predicate: does `line` look like a structurally-significant closing delimiter
 * whose content hash is indistinguishable from every other lone-delimiter line?
 *
 * Used to skip boundary-echo auto-strip for such lines (sibling `}` of class vs
 * method), and to signal ambiguity when both replace_between anchors land on
 * such lines (hash-only match can resolve to the wrong sibling).
 *
 * Deliberately narrow: a trimmed line that is only a closing delimiter optionally
 * followed by one `;` or `,`, plus a small set of language-agnostic block closers.
 * Does NOT match short content like `if`, `do`, `fi` when those appear as code.
 */
const AMBIGUOUS_DELIMITER_RE = /^[)\]}](?:[;,])?$|^[)\]}]{2,}[;,]?$|^\}\);?$|^\}\)\);?$/;
const KNOWN_BLOCK_CLOSERS = new Set(["end", "esac", "loop", "endif", "endfor", "endwhile"]);

export function isAmbiguousDelimiter(line) {
    const trimmed = String(line ?? "").trim();
    if (!trimmed) return false;
    if (AMBIGUOUS_DELIMITER_RE.test(trimmed)) return true;
    if (KNOWN_BLOCK_CLOSERS.has(trimmed)) return true;
    return false;
}

/**
 * Lexical character counter for structural delimiters. Used only as an
 * advisory heuristic: ignores string/template/JSX/comment lexical context,
 * so callers must gate emission on a structural-risk signal.
 */
function countDelimChars(lines) {
    let open = 0, close = 0, paren = 0, cparen = 0, bracket = 0, cbracket = 0;
    for (const line of lines) {
        const s = String(line ?? "");
        for (let i = 0; i < s.length; i++) {
            const ch = s.charCodeAt(i);
            if (ch === 123) open++;           // {
            else if (ch === 125) close++;     // }
            else if (ch === 40) paren++;      // (
            else if (ch === 41) cparen++;     // )
            else if (ch === 91) bracket++;    // [
            else if (ch === 93) cbracket++;   // ]
        }
    }
    return { open, close, paren, cparen, bracket, cbracket };
}

export function lexicalBraceCounts(lines) {
    return countDelimChars(lines);
}

export function isFileGloballyBalanced(counts) {
    return (
        counts.open === counts.close &&
        counts.paren === counts.cparen &&
        counts.bracket === counts.cbracket
    );
}

/**
 * Absolute delimiter delta between orig range and new lines (advisory only).
 */
export function braceDelta(origLines, newLines) {
    const before = countDelimChars(origLines);
    const after = countDelimChars(newLines);
    const bd = (after.open - after.close) - (before.open - before.close);
    const pd = (after.paren - after.cparen) - (before.paren - before.cparen);
    const kd = (after.bracket - after.cbracket) - (before.bracket - before.cbracket);
    return {
        brace: bd,
        paren: pd,
        bracket: kd,
        totalAbs: Math.abs(bd) + Math.abs(pd) + Math.abs(kd),
    };
}
