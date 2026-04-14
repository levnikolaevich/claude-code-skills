/**
 * Semantic diff formatting over the shared git-ref semantic diff substrate.
 */

import { statSync } from "node:fs";
import { validatePath, normalizePath } from "./security.mjs";
import { semanticGitDiff } from "@levnikolaevich/hex-common/git/semantic-diff";
import { getGraphDB, getGraphDBForProject, getRelativePath, semanticImpact, graphUnavailableHint, graphUnavailableHintForProject } from "./graph-enrich.mjs";
import { ACTION, REASON } from "./output-contract.mjs";

function payloadSections(sections) {
    return sections.length > 0 ? sections.join(",") : "summary_only";
}

function exportedLooking(symbol) {
    return /^\s*(export|public)\b/.test(symbol.text || "");
}

function summarizeGraphRisk(db, relFile, file) {
    if (!db || !relFile || !file.semantic_supported) return [];
    const lines = [];
    const seen = new Set();
    for (const symbol of [...file.added_symbols, ...file.modified_symbols].slice(0, 6)) {
        const impacts = semanticImpact(db, relFile, symbol.start, symbol.end);
        for (const impact of impacts) {
            const riskParts = [];
            if (impact.counts.publicApi > 0) riskParts.push("public API");
            if (impact.counts.frameworkEntrypoints > 0) riskParts.push(`${impact.counts.frameworkEntrypoints} framework entrypoint`);
            if (impact.counts.externalCallers > 0) riskParts.push(`${impact.counts.externalCallers} external callers`);
            if (impact.counts.downstreamReturnFlow > 0) riskParts.push(`${impact.counts.downstreamReturnFlow} return-flow`);
            if (impact.counts.downstreamPropertyFlow > 0) riskParts.push(`${impact.counts.downstreamPropertyFlow} property-flow`);
            if (impact.counts.sinkReach > 0) riskParts.push(`${impact.counts.sinkReach} terminal flow`);
            if (impact.counts.cloneSiblings > 0) riskParts.push(`${impact.counts.cloneSiblings} clone siblings`);
            if (impact.counts.sameNameSymbols > 0) riskParts.push(`${impact.counts.sameNameSymbols} same-name siblings`);
            if (riskParts.length === 0) continue;
            const key = `${impact.symbol}|${riskParts.join(",")}`;
            if (seen.has(key)) continue;
            seen.add(key);
            lines.push(`- ${impact.symbol}: ${riskParts.join(", ")}`);
            if (lines.length >= 6) return lines;
        }
    }
    return lines;
}

function symbolCountSummary(file) {
    return `added=${file.added_symbols.length} removed=${file.removed_symbols.length} modified=${file.modified_symbols.length}`;
}

function summarizeRiskLine(line) {
    return String(line).replace(/^- /, "").trim();
}

/**
 * Compare file against git ref, returning semantic symbol diff.
 *
 * @param {string} filePath        File path (absolute or relative)
 * @param {string} compareAgainst  Git ref (default: "HEAD")
 * @returns {Promise<string>}      Formatted diff
 */
export async function fileChanges(filePath, compareAgainst = "HEAD") {
    filePath = normalizePath(filePath);
    const real = validatePath(filePath);

    // Directory: return git diff --stat (compact file list, no content reads)
    if (statSync(real).isDirectory()) {
        const db = getGraphDBForProject(real);
        const diff = await semanticGitDiff(real, { baseRef: compareAgainst });
        const graphHint = graphUnavailableHintForProject(real);
        if (diff.summary.changed_file_count === 0) {
            return [
                "status: NO_CHANGES",
                `reason: ${REASON.DIRECTORY_UNCHANGED}`,
                `path: ${filePath}`,
                `compare_against: ${compareAgainst}`,
                "scope: directory",
                ...graphHint,
            ].join("\n");
        }
        let emittedRiskCount = 0;
        let emittedRemovedApiWarnings = 0;
        const sectionKinds = ["files"];
        const sections = [
            "status: CHANGED",
            `reason: ${REASON.DIRECTORY_CHANGED}`,
            `path: ${filePath}`,
            `compare_against: ${compareAgainst}`,
            "scope: directory",
            `summary: changed_files=${diff.summary.changed_file_count}`,
            `next_action: ${ACTION.INSPECT_FILE}`,
            ...graphHint,
            "",
        ];
        for (const file of diff.changed_files) {
            const parts = [
                `file: ${file.path}${file.old_path ? ` (from ${file.old_path})` : ""}`,
                `summary: ${file.semantic_supported ? symbolCountSummary(file) : "semantic_diff=unsupported"}`,
            ];
            sections.push(parts.join(" | "));
            const riskLines = summarizeGraphRisk(db, file.path.replace(/\\/g, "/"), file);
            const visibleRiskLines = riskLines.slice(0, 2);
            emittedRiskCount += visibleRiskLines.length;
            for (const line of visibleRiskLines) sections.push(`risk_summary: ${summarizeRiskLine(line)}`);
            for (const symbol of file.removed_symbols.slice(0, 2)) {
                if (exportedLooking(symbol)) {
                    emittedRemovedApiWarnings += 1;
                    sections.push(`removed_api_warning: ${symbol.text}`);
                }
            }
        }
        if (emittedRiskCount > 0) sectionKinds.push("risk_summary");
        if (emittedRemovedApiWarnings > 0) sectionKinds.push("removed_api_warning");
        const spliceLines = [];
        if (sectionKinds.length > 0) spliceLines.push(`payload_sections: ${payloadSections(sectionKinds)}`);
        sections.splice(7 + graphHint.length, 0, ...spliceLines);
        return sections.join("\n");
    }

    const db = getGraphDB(real);
    const diff = await semanticGitDiff(real, { baseRef: compareAgainst });
    const file = diff.changed_files[0];
    const graphHint = graphUnavailableHint(real);
    if (!file) {
        return [
            "status: NO_CHANGES",
            `reason: ${REASON.FILE_UNCHANGED}`,
            `path: ${filePath}`,
            `compare_against: ${compareAgainst}`,
            "scope: file",
            ...graphHint,
        ].join("\n");
    }
    if (!file.semantic_supported) {
        return [
            "status: UNSUPPORTED",
            `reason: ${REASON.SEMANTIC_DIFF_UNSUPPORTED}`,
            `path: ${filePath}`,
            `compare_against: ${compareAgainst}`,
            "scope: file",
            `summary: semantic diff unavailable for ${file.extension} files`,
            `next_action: ${ACTION.INSPECT_RAW_DIFF}`,
            ...graphHint,
        ].join("\n");
    }

    const relFile = getRelativePath(real) || file.path?.replace(/\\/g, "/");
    const riskLines = summarizeGraphRisk(db, relFile, file);
    const removedApiWarnings = file.removed_symbols.filter(exportedLooking).slice(0, 4);
    const sectionKinds = [];
    const parts = [
        "status: CHANGED",
        `reason: ${REASON.FILE_CHANGED}`,
        `path: ${filePath}`,
        `compare_against: ${compareAgainst}`,
        "scope: file",
        `summary: ${symbolCountSummary(file)}`,
        ...graphHint,
    ];

    if (file.added_symbols.length) {
        sectionKinds.push("added");
        parts.push(`next_action: ${ACTION.REVIEW_RISKS}`);
        parts.push("");
        parts.push("added:");
        for (const symbol of file.added_symbols) parts.push(`  + ${symbol.start}-${symbol.end}: ${symbol.text}`);
    }
    if (file.removed_symbols.length) {
        sectionKinds.push("removed");
        if (!parts.includes(`next_action: ${ACTION.REVIEW_RISKS}`)) parts.push(`next_action: ${ACTION.REVIEW_RISKS}`);
        parts.push("");
        parts.push("removed:");
        for (const symbol of file.removed_symbols) parts.push(`  - ${symbol.start}-${symbol.end}: ${symbol.text}`);
    }
    if (file.modified_symbols.length) {
        sectionKinds.push("modified");
        if (!parts.includes(`next_action: ${ACTION.REVIEW_RISKS}`)) parts.push(`next_action: ${ACTION.REVIEW_RISKS}`);
        parts.push("");
        parts.push("modified:");
        for (const symbol of file.modified_symbols) {
            const delta = symbol.lines - symbol.previous.lines;
            const sign = delta > 0 ? "+" : "";
            parts.push(`  ~ ${symbol.start}-${symbol.end}: ${symbol.text}  (${sign}${delta} lines)`);
        }
    }

    if (!file.added_symbols.length && !file.removed_symbols.length && !file.modified_symbols.length) {
        parts.push(`next_action: ${ACTION.INSPECT_RAW_DIFF}`);
        parts.push("");
        parts.push("summary_detail: no symbol changes detected");
    }
    if (riskLines.length > 0) sectionKinds.push("risk_summary");
    if (removedApiWarnings.length > 0) sectionKinds.push("removed_api_warning");
    if (sectionKinds.length > 0) {
        const insertIdx = 6 + graphHint.length;
        parts.splice(insertIdx, 0, `payload_sections: ${payloadSections(sectionKinds)}`);
    }
    if (riskLines.length || removedApiWarnings.length) {
        parts.push("");
        parts.push("risk_summary:");
        for (const line of riskLines) parts.push(`  - ${summarizeRiskLine(line)}`);
        for (const symbol of removedApiWarnings) parts.push(`  - removed_api_warning: ${symbol.text}`);
    }

    return parts.join("\n");
}
