/**
 * Hex-line workflow scenarios built from recent real Claude usage.
 *
 * Each workflow measures hex-line tool chain output (chars + ops).
 * No built-in simulation — pure hex-line metrics only.
 *
 * Scenarios:
 * - W1: grep tag + editFile (hook debugging)
 * - W2: readFile targeted + editFile + verifyChecksums (setup guidance)
 * - W3: bulkReplace repo-wide (wording refactor)
 * - W4: fileOutline + readFile targeted + editFile dryRun (large file review)
 * - W5: readFile targeted + editFile insert_after + editFile replace_lines with baseRevision
 */

import { copyFileSync, mkdirSync, rmSync, unlinkSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { tmpdir } from "node:os";
import { fnv1a, lineTag, rangeChecksum } from "@levnikolaevich/hex-common/text-protocol/hash";
import { readFile } from "../lib/read.mjs";
import { verifyChecksums } from "../lib/verify.mjs";
import { editFile } from "../lib/edit.mjs";
import { bulkReplace } from "../lib/bulk-replace.mjs";
import { fileOutline } from "../lib/outline.mjs";
import { getFileLines, runN } from "../lib/scenario-helpers.mjs";

function ensureLine(lines, matcher, label) {
    const idx = lines.findIndex((line) => matcher(line));
    if (idx === -1) throw new Error(`Benchmark fixture missing line for ${label}`);
    return idx;
}

function copyIntoTemp(tempRoot, sourceRoot, relPath) {
    const src = resolve(sourceRoot, relPath);
    const dst = resolve(tempRoot, relPath);
    mkdirSync(dirname(dst), { recursive: true });
    copyFileSync(src, dst);
    return dst;
}

export async function runWorkflows(config) {
    const { repoRoot, allFiles, largeFiles } = config;
    const workflowResults = [];

    // W1: grep tag + editFile (debug hex-line hook formatting)
    {
        const sourcePath = resolve(repoRoot, "hook.mjs");
        const sourceLines = getFileLines(sourcePath);
        if (!sourceLines) throw new Error("Unable to load hook.mjs for benchmark workflow W1");

        const targetIdx = ensureLine(
            sourceLines,
            (line) =>
                line.includes("ls -R, ls -laR (recursive only)")
                || line.includes("Bash redirect: blocks simple cat/head/tail/ls/grep/sed/diff"),
            "hook redirect comment",
        );
        const tempPath = resolve(tmpdir(), `hex-line-wf1-${Date.now()}.mjs`);
        copyFileSync(sourcePath, tempPath);

        const updatedLine = sourceLines[targetIdx].includes("recursive only")
            ? sourceLines[targetIdx].replace("recursive only", "recursive listing only")
            : sourceLines[targetIdx].replace("grep/sed/diff", "grep/sed/diff/find");

        const { value: chars } = runN(() => {
            let total = 0;
            const tag = lineTag(fnv1a(sourceLines[targetIdx]));
            total += `${tempPath}:>>${tag}.${targetIdx + 1}\t${sourceLines[targetIdx]}`.length;
            try {
                total += editFile(tempPath, [{ set_line: { anchor: `${tag}.${targetIdx + 1}`, new_text: updatedLine } }]).length;
            } catch (e) {
                total += e.message.length;
            }
            return total;
        });

        workflowResults.push({
            id: "W1",
            scenario: "Debug hook file-listing redirect",
            chars,
            ops: 2,
        });
        try { unlinkSync(tempPath); } catch {}
    }

    // W2: readFile targeted + editFile + verifyChecksums (setup guidance update)
    {
        const sourcePath = resolve(repoRoot, "lib", "setup.mjs");
        const sourceLines = getFileLines(sourcePath);
        if (!sourceLines) throw new Error("Unable to load lib/setup.mjs for benchmark workflow W2");

        const targetIdx = ensureLine(
            sourceLines,
            (line) =>
                line.includes("Codex: Not supported")
                || line.includes("hex-line: warning — failed to parse ${filePath}, skipping\\n"),
            "setup guidance line",
        );
        const tempPath = resolve(tmpdir(), `hex-line-wf2-${Date.now()}.mjs`);
        copyFileSync(sourcePath, tempPath);

        const updatedLine = sourceLines[targetIdx].includes("Add MCP Tool Preferences to AGENTS.md instead")
            ? sourceLines[targetIdx].replace(
                "Add MCP Tool Preferences to AGENTS.md instead",
                "Document MCP Tool Preferences in AGENTS.md instead",
            )
            : sourceLines[targetIdx].replace("skipping\\n", "ignoring\\n");
        const windowStart = Math.max(1, targetIdx - 3);
        const windowLimit = Math.min(sourceLines.length - windowStart + 1, 10);
        const hashes = sourceLines.map((line) => fnv1a(line));
        const checksum = rangeChecksum(hashes, windowStart, windowStart + windowLimit - 1);

        const { value: chars } = runN(() => {
            let total = 0;
            total += readFile(tempPath, { offset: windowStart, limit: windowLimit }).length;
            copyFileSync(sourcePath, tempPath);
            try {
                const tag = lineTag(fnv1a(sourceLines[targetIdx]));
                total += editFile(tempPath, [{ set_line: { anchor: `${tag}.${targetIdx + 1}`, new_text: updatedLine } }]).length;
            } catch (e) {
                total += e.message.length;
            }
            try {
                total += verifyChecksums(tempPath, [checksum]).length;
            } catch (e) {
                total += e.message.length;
            }
            return total;
        });

        workflowResults.push({
            id: "W2",
            scenario: "Read-edit-verify round-trip on setup module",
            chars,
            ops: 3,
        });
        try { unlinkSync(tempPath); } catch {}
    }

    // W3: bulkReplace repo-wide (benchmark wording refresh)
    {
        const tempRoot = resolve(tmpdir(), `hex-line-wf3-${Date.now()}`);
        mkdirSync(tempRoot, { recursive: true });
        const fixtureFiles = [
            "README.md",
            "package.json",
            "scenarios/index.mjs",
            "scenarios/atomic.mjs",
            "scenarios/workflows.mjs",
        ];
        const copiedFiles = fixtureFiles.map((relPath) => copyIntoTemp(tempRoot, repoRoot, relPath));
        const replacements = [{ old: "benchmark", new: "workflow benchmark" }];

        const { value: chars } = runN(() => {
            return bulkReplace(
                tempRoot,
                "**/*.{md,json,mjs}",
                replacements,
                { dryRun: true, maxFiles: 10 },
            ).length;
        });

        workflowResults.push({
            id: "W3",
            scenario: "Repo-wide benchmark wording refresh",
            chars,
            ops: 1,
        });
        try { rmSync(tempRoot, { recursive: true }); } catch {}
    }

    // W4: fileOutline + readFile targeted + editFile dryRun (large smoke test review)
    {
        const preferredLarge = allFiles.find((filePath) => filePath.replace(/\\/g, "/").endsWith("test/smoke.mjs"))
            || largeFiles[0]
            || allFiles[0];
        const largeLines = getFileLines(preferredLarge);
        if (largeLines && largeLines.length > 100) {
            const targetIdx = ensureLine(
                largeLines,
                (line) => line.includes("describe(\"hook — ls redirect\""),
                "large smoke test anchor",
            );
            const sliceStart = Math.max(0, targetIdx - 5);
            const sliceEnd = Math.min(largeLines.length, targetIdx + 15);

            let outlineLen = 500;
            try { outlineLen = (await fileOutline(preferredLarge)).length; } catch {}

            // Pre-compute real editFile dryRun result
            const hexReadW4 = readFile(preferredLarge);
            let editAnchor = null;
            for (const l of hexReadW4.split("\n")) {
                const m = l.match(/^([a-z0-9]{2})\.(\d+)\t/);
                if (m && parseInt(m[2]) === targetIdx + 1) { editAnchor = `${m[1]}.${m[2]}`; break; }
            }
            const editResultW4 = editAnchor
                ? editFile(preferredLarge, [{ set_line: { anchor: editAnchor, new_text: `${largeLines[targetIdx]} // benchmark-note` } }], { dryRun: true })
                : "edit skipped (no anchor)";

            const { value: chars } = runN(() => {
                let total = 0;
                total += outlineLen;
                total += readFile(preferredLarge, { offset: sliceStart + 1, limit: sliceEnd - sliceStart }).length;
                total += editResultW4.length;
                return total;
            });

            workflowResults.push({
                id: "W4",
                scenario: `Inspect large smoke test before edit (${largeLines.length}L)`,
                chars,
                ops: 3,
            });
        }
    }

    // W5: revision-aware follow-up edit after unrelated line shift
    {
        const tempPath = resolve(tmpdir(), `hex-line-wf5-${Date.now()}.mjs`);
        const prefix = Array.from({ length: 80 }, (_, i) => `pre-${i}`);
        const suffix = Array.from({ length: 80 }, (_, i) => `post-${i}`);
        const sourceLines = [
            ...prefix,
            "head1",
            "head2",
            "targetA",
            "targetB",
            "tail",
            ...suffix,
            "",
        ];
        const sourceText = sourceLines.join("\n");
        mkdirSync(dirname(tempPath), { recursive: true });
        writeFileSync(tempPath, sourceText, "utf-8");

        const head1Idx = prefix.length;
        const targetAIdx = prefix.length + 2;
        const targetBIdx = prefix.length + 3;

        const { value: chars } = runN(() => {
            let total = 0;
            writeFileSync(tempPath, sourceText, "utf-8");
            const baseRead = readFile(tempPath, { offset: head1Idx + 1, limit: 8 });
            total += baseRead.length;
            const baseRevision = baseRead.match(/revision: (\S+)/)?.[1];
            const headTag = lineTag(fnv1a(sourceLines[head1Idx]));
            total += editFile(tempPath, [{ insert_after: { anchor: `${headTag}.${head1Idx + 1}`, text: "inserted" } }]).length;
            const startTag = lineTag(fnv1a(sourceLines[targetAIdx]));
            const endTag = lineTag(fnv1a(sourceLines[targetBIdx]));
            const rc = rangeChecksum(
                [fnv1a(sourceLines[targetAIdx]), fnv1a(sourceLines[targetBIdx])],
                targetAIdx + 1,
                targetBIdx + 1,
            );
            total += editFile(tempPath, [{
                replace_lines: {
                    start_anchor: `${startTag}.${targetAIdx + 1}`,
                    end_anchor: `${endTag}.${targetBIdx + 1}`,
                    new_text: "targetA\nupdatedB",
                    range_checksum: rc,
                }
            }], { baseRevision, conflictPolicy: "conservative" }).length;
            return total;
        });

        workflowResults.push({
            id: "W5",
            scenario: "Follow-up edit after unrelated line shift",
            chars,
            ops: 3,
        });
        try { unlinkSync(tempPath); } catch {}
    }

    return workflowResults;
}
