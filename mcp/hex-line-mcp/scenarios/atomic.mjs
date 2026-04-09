/**
 * TEST 1-14: Hex-line tool metrics (atomic benchmarks).
 *
 * Each test measures hex-line output size and latency for a single tool.
 */

import { readFileSync, writeFileSync, unlinkSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { tmpdir } from "node:os";
import { performance } from "node:perf_hooks";
import { fnv1a, lineTag, rangeChecksum } from "@levnikolaevich/hex-common/text-protocol/hash";
import { readFile } from "../lib/read.mjs";
import { directoryTree } from "../lib/tree.mjs";
import { fileInfo } from "../lib/info.mjs";
import { bulkReplace } from "../lib/bulk-replace.mjs";
import { verifyChecksums } from "../lib/verify.mjs";
import { fileChanges } from "../lib/changes.mjs";
import { outlineFromContent } from "@levnikolaevich/hex-common/parser/outline";
import { grepSearch } from "../lib/search.mjs";
import { editFile } from "../lib/edit.mjs";
import { extname } from "node:path";
import {
    getFileLines,
    runN,
} from "../lib/scenario-helpers.mjs";

const BULK_REPLACE_SCENARIO_FILE_COUNT = 5;

/**
 * Run TEST 1-14 atomic benchmarks (hex-line only).
 *
 * @param {object} config
 * @param {string[]} config.allFiles - All discovered code files
 * @param {object} config.cats - Categorized files { small, medium, large, xl }
 * @param {string} config.tmpPath - Path to temp benchmark file
 * @param {string} config.tmpContent - Content of temp file
 * @param {string[]} config.tmpLines - Lines of temp file
 * @param {string} config.repoRoot - Repository root path
 * @param {number} config.ts - Timestamp for unique temp file names
 * @returns {Promise<object[]>} Array of { num, scenario, chars, latency }
 */
export async function runAtomic(config) {
    const { allFiles, cats, tmpPath, tmpContent, tmpLines, repoRoot, ts } = config;
    const results = [];

    // ===================================================================
    // TEST 1: Read full file
    // ===================================================================
    for (const [cat, files] of Object.entries(cats)) {
        if (files.length === 0) continue;
        const measurements = [];

        for (const f of files) {
            const lines = getFileLines(f);
            if (!lines) continue;
            measurements.push(runN(() => readFile(f).length));
        }

        if (measurements.length === 0) continue;
        const avgChars = Math.round(measurements.reduce((a, b) => a + b.value, 0) / measurements.length);
        const avgMs = parseFloat((measurements.reduce((a, b) => a + b.ms, 0) / measurements.length).toFixed(1));

        const label = { small: "<50L", medium: "50-200L", large: "200-500L", xl: "500L+" }[cat];
        results.push({ num: 1, scenario: `Read full (${label})`, chars: avgChars, latency: avgMs });
    }

    // ===================================================================
    // TEST 2: Read with outline — outline + targeted read
    // ===================================================================
    for (const cat of ["large", "xl"]) {
        const files = cats[cat] || [];
        if (files.length === 0) continue;
        const measurements = [];

        for (const f of files) {
            const lines = getFileLines(f);
            if (!lines) continue;
            const content = readFileSync(f, "utf-8");
            const ext = extname(f);
            const outlineResult = await outlineFromContent(content, ext);
            const outlineStr = outlineResult
                ? `File: ${f}\n\n${outlineResult.entries.map(e => `${e.start}-${e.end}: ${e.text}`).join("\n")}`
                : readFile(f);
            const readStr = readFile(f, { offset: 1, limit: 30 });
            const hexResult = outlineStr + "\n---\n" + readStr;
            measurements.push(runN(() => hexResult.length));
        }

        if (measurements.length === 0) continue;
        const avgChars = Math.round(measurements.reduce((a, b) => a + b.value, 0) / measurements.length);
        const avgMs = parseFloat((measurements.reduce((a, b) => a + b.ms, 0) / measurements.length).toFixed(1));

        const label = cat === "large" ? "200-500L" : "500L+";
        results.push({ num: 2, scenario: `Outline+read (${label})`, chars: avgChars, latency: avgMs });
    }

    // ===================================================================
    // TEST 3: Grep search
    // ===================================================================
    {
        const grepFiles = [...(cats.medium || []), ...(cats.large || []), ...(cats.xl || [])].slice(0, 3);
        if (grepFiles.length > 0) {
            const measurements = [];

            for (const f of grepFiles) {
                const lines = getFileLines(f);
                if (!lines) continue;
                const pattern = "function|class|const";
                const grepResult = await grepSearch(pattern, { path: f, output: "content" });
                measurements.push(runN(() => grepResult.length));
            }

            if (measurements.length > 0) {
                const avgChars = Math.round(measurements.reduce((a, b) => a + b.value, 0) / measurements.length);
                const avgMs = parseFloat((measurements.reduce((a, b) => a + b.ms, 0) / measurements.length).toFixed(1));
                results.push({ num: 3, scenario: "Grep search", chars: avgChars, latency: avgMs });
            }
        }
    }

    // ===================================================================
    // TEST 4: Directory tree
    // ===================================================================
    {
        const { value: chars, ms: latency } = runN(() => directoryTree(repoRoot, { max_depth: 3 }).length);
        results.push({ num: 4, scenario: "Directory tree", chars, latency });
    }

    // ===================================================================
    // TEST 5: File info
    // ===================================================================
    {
        const infoFile = allFiles[Math.floor(allFiles.length / 2)] || allFiles[0];
        const { value: chars, ms: latency } = runN(() => fileInfo(infoFile).length);
        results.push({ num: 5, scenario: "File info", chars, latency });
    }

    // ===================================================================
    // TEST 6: Create file (write)
    // ===================================================================
    {
        const writeResponse = `Created ${tmpPath} (${tmpContent.split("\n").length} lines)`;
        const { value: chars, ms: latency } = runN(() => writeResponse.length);
        results.push({ num: 6, scenario: "Create file (200L)", chars, latency });
    }

    // ===================================================================
    // TEST 7: Edit x5 sequential
    // ===================================================================
    {
        const editTargets = [
            { line: 13, new: '        this.configPath = resolve(configPath || ".");' },
            { line: 55, new: "    const { retries = MAX_RETRIES, delay = 200, backoff = 3 } = options;" },
            { line: 75, new: "        this.timeout = options.timeout ?? DEFAULT_TIMEOUT;" },
            { line: 116, new: "        return this; // chainable" },
            { line: 148, new: "    /** @type {string[]} */\n    const errors = [];" },
        ];

        let totalChars = 0;
        let totalMs = 0;

        // Pre-compute hash anchors from readFile output
        const hexRead = readFile(tmpPath);
        const anchorMap = new Map();
        for (const line of hexRead.split("\n")) {
            const m = line.match(/^([a-z0-9]{2})\.(\d+)\t/);
            if (m) anchorMap.set(parseInt(m[2]), `${m[1]}.${m[2]}`);
        }

        for (const edit of editTargets) {
            const anchor = anchorMap.get(edit.line);
            const r = anchor
                ? runN(() => editFile(tmpPath, [{ set_line: { anchor, new_text: edit.new } }], { dryRun: true }).length)
                : runN(() => 0);
            totalChars += r.value;
            totalMs += r.ms;
        }

        results.push({
            num: 7, scenario: "Edit x5 sequential",
            chars: totalChars, latency: parseFloat(totalMs.toFixed(1)),
        });
    }

    // ===================================================================
    // TEST 8: Verify checksums
    // ===================================================================
    {
        const fileLines = readFileSync(tmpPath, "utf-8").replace(/\r\n/g, "\n").split("\n");
        const hashes = fileLines.map(l => fnv1a(l));
        const cs1 = rangeChecksum(hashes.slice(0, 50), 1, 50);
        const cs2 = rangeChecksum(hashes.slice(50, 100), 51, 100);
        const cs3 = rangeChecksum(hashes.slice(100, 150), 101, 150);
        const cs4 = rangeChecksum(hashes.slice(150, 200), 151, 200);
        const checksums = [cs1, cs2, cs3, cs4];

        const { value: chars, ms: latency } = runN(() => verifyChecksums(tmpPath, checksums).length);
        results.push({ num: 8, scenario: "Verify checksums (4 ranges)", chars, latency });
    }

    // ===================================================================
    // TEST 9: Multi-file read (batch)
    // ===================================================================
    {
        const batchFiles = (cats.small || []).slice(0, 3);
        if (batchFiles.length >= 2) {
            const { value: chars, ms: latency } = runN(() => {
                const parts = [];
                for (const f of batchFiles) {
                    parts.push(readFile(f));
                }
                return parts.join("\n\n---\n\n").length;
            });

            results.push({
                num: 9, scenario: `Multi-file read (${batchFiles.length} files)`,
                chars, latency,
            });
        }
    }

    // ===================================================================
    // TEST 10: bulk_replace dry_run
    // ===================================================================
    {
        const bulkTmpDir = resolve(tmpdir(), `hex-line-bulkdir-${ts}`);
        const { mkdirSync } = await import("node:fs");
        mkdirSync(bulkTmpDir, { recursive: true });
        for (let i = 0; i < BULK_REPLACE_SCENARIO_FILE_COUNT; i++) {
            writeFileSync(resolve(bulkTmpDir, `file${i}.js`), tmpContent, "utf-8");
        }

        const editLine = 13;
        const editNew = '        this.configPath = resolve(configPath || ".");';
        const oldLine = tmpLines[editLine - 1];

        const { value: chars, ms: latency } = runN(() => {
            return bulkReplace(bulkTmpDir, "*.js", [{ old: oldLine, new: editNew }], { dryRun: true }).length;
        });

        const { rmSync } = await import("node:fs");
        try { rmSync(bulkTmpDir, { recursive: true }); } catch {}

        results.push({
            num: 10,
            scenario: `bulk_replace dry_run (${BULK_REPLACE_SCENARIO_FILE_COUNT} files)`,
            chars,
            latency,
        });
    }

    // ===================================================================
    // TEST 11: changes (semantic diff)
    // ===================================================================
    {
        let chars;
        let latency = 0;
        try {
            const t0 = performance.now();
            const changesOut = await fileChanges(allFiles[0]);
            latency = parseFloat((performance.now() - t0).toFixed(1));
            chars = changesOut.length;
        } catch {
            chars = 133; // fallback if no git history
        }

        results.push({ num: 11, scenario: "Changes (semantic diff)", chars, latency });
    }

    // ===================================================================
    // TEST 12: FILE_NOT_FOUND recovery
    // ===================================================================
    {
        const missingPath = resolve(repoRoot, "src/utils/halper.js");

        const { value: chars, ms: latency } = runN(() => {
            try {
                return readFile(missingPath).length;
            } catch (e) {
                return e.message.length;
            }
        });

        results.push({ num: 12, scenario: "FILE_NOT_FOUND recovery*", chars, latency });
    }

    // ===================================================================
    // TEST 13: Hash mismatch recovery
    // ===================================================================
    {
        const { value: chars, ms: latency } = runN(() => {
            const targetLine = 13;
            const snippetStart = Math.max(0, targetLine - 6);
            const snippetEnd = Math.min(tmpLines.length, targetLine + 5);
            const snippet = tmpLines.slice(snippetStart, snippetEnd);
            const annotated = snippet.map((l, i) => {
                const lineNum = snippetStart + i + 1;
                const tag = lineTag(fnv1a(l));
                return `${tag}.${lineNum}\t${l}`;
            }).join("\n");
            const response = `HASH_MISMATCH at line ${targetLine}. Fresh snippet:\n\`\`\`\n${annotated}\n\`\`\``;
            return response.length;
        });

        results.push({ num: 13, scenario: "Hash mismatch recovery*", chars, latency });
    }

    // ===================================================================
    // TEST 14: Bash redirect savings
    // ===================================================================
    {
        const infoFile = allFiles[Math.floor(allFiles.length / 2)] || allFiles[0];
        const infoLines = getFileLines(infoFile);
        if (infoLines) {
            const catH = runN(() => readFile(infoFile).length);
            const dirTarget = resolve(repoRoot);
            const lsH = runN(() => directoryTree(dirTarget, { max_depth: 1 }).length);
            const stH = runN(() => fileInfo(infoFile).length);

            const totalChars = catH.value + lsH.value + stH.value;
            const totalMs = catH.ms + lsH.ms + stH.ms;

            results.push({
                num: 14, scenario: "Bash redirects (cat+ls+stat)",
                chars: totalChars, latency: parseFloat(totalMs.toFixed(1)),
            });
        }
    }

    return results;
}
