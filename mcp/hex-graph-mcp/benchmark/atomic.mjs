/**
 * TEST 1-12: Individual tool comparisons (built-in grep/read vs hex-graph).
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { runN, rg } from "./helpers.mjs";
import {
    findSymbols,
    getSymbol,
    tracePaths,
    getArchitectureReport,
    getHotspots,
    getModuleMetricsReport,
    getReferencesBySelector,
} from "../lib/store.mjs";
import { findClones } from "../lib/clones.mjs";
import { findCycles } from "../lib/cycles.mjs";
import { runAuditWorkspaceUseCase } from "../lib/use-cases.mjs";

/**
 * @param {object} store  — initialized graph store
 * @param {object} config — { repoRoot, allFiles, searchSym, contextSym, impactSym, traceSym }
 * @returns {object[]}    — array of result rows
 */
export function runAtomic(store, config) {
    const results = [];
    const { repoRoot, allFiles, searchSym, contextSym, impactSym, traceSym } = config;
    const selectorFor = (sym) => ({ name: sym.name, file: sym.file });

    // ===================================================================
    // TEST 1: Search symbols
    // ===================================================================
    {
        const name = searchSym.name;

        const withoutChars = runN(() => {
            const out = rg(`-n "${name}" --type js "${repoRoot}" --max-count 30`);
            return out.length;
        });

        const withChars = runN(() => {
            return JSON.stringify(findSymbols(name, { limit: 20 })).length;
        });

        results.push({
            id: 1,
            scenario: `Search symbols ("${name}")`,
            without: withoutChars,
            withG: withChars,
            opsWithout: 1,
            opsWith: 1,
            stepsWithout: 1,
            stepsWith: 1,
        });
    }

    // ===================================================================
    // TEST 2: Get symbol (identity-safe symbol view)
    // ===================================================================
    {
        const name = contextSym.name;
        const file = contextSym.file;
        const fullPath = resolve(repoRoot, file);

        const withoutChars = runN(() => {
            let total = 0;
            // 1. Read full source
            try { total += readFileSync(fullPath, "utf-8").length; } catch { /* skip */ }
            // 2. Grep for callers
            total += rg(`-n "${name}" --type js "${repoRoot}"`).length;
            // 3. Grep for callees within function body
            total += rg(`-n "\\b\\w+\\(" "${fullPath}"`).length;
            // 4. List other functions in same file
            total += rg(`-n "function " "${fullPath}"`).length;
            return total;
        });

        const withChars = runN(() => {
            return JSON.stringify(getSymbol(selectorFor(contextSym))).length;
        });

        results.push({
            id: 2,
            scenario: `Get symbol ("${name}")`,
            without: withoutChars,
            withG: withChars,
            opsWithout: 4,
            opsWith: 1,
            stepsWithout: 4,
            stepsWith: 1,
        });
    }

    // ===================================================================
    // TEST 3: Trace reverse mixed paths
    // ===================================================================
    {
        const name = impactSym.name;

        const withoutChars = runN(() => {
            let total = 0;
            // 1. Find files referencing the symbol
            const fileList = rg(`-l "${name}" --type js "${repoRoot}"`);
            total += fileList.length;
            // 2. For each file (max 5): grep for exact lines
            const files = fileList.trim().split("\n").filter(Boolean).slice(0, 5);
            for (const f of files) {
                total += rg(`-n "${name}" "${f}"`).length;
            }
            return total;
        });

        // Count files for ops calculation
        const fileList = rg(`-l "${name}" --type js "${repoRoot}"`);
        const refFileCount = Math.min(fileList.trim().split("\n").filter(Boolean).length, 5);

        const withChars = runN(() => {
            return JSON.stringify(
                tracePaths(selectorFor(impactSym), { path_kind: "mixed", direction: "reverse", depth: 3, limit: 50 })
            ).length;
        });

        results.push({
            id: 3,
            scenario: `Trace reverse mixed paths ("${name}")`,
            without: withoutChars,
            withG: withChars,
            opsWithout: 1 + refFileCount,
            opsWith: 1,
            stepsWithout: 3,
            stepsWith: 1,
        });
    }

    // ===================================================================
    // TEST 4: Trace call paths
    // ===================================================================
    {
        const name = traceSym.name;

        const withoutChars = runN(() => {
            let total = 0;
            // Depth 1: direct callers
            const d1 = rg(`-n "${name}\\(" --type js "${repoRoot}"`);
            total += d1.length;
            // Depth 2: for each caller, grep for ITS callers
            const d1Lines = d1.trim().split("\n").filter(Boolean).slice(0, 5);
            const callerNames = new Set();
            for (const line of d1Lines) {
                const m = line.match(/(?:function|const|let|var)\s+(\w+)/);
                if (m) callerNames.add(m[1]);
            }
            for (const cn of [...callerNames].slice(0, 3)) {
                total += rg(`-n "${cn}\\(" --type js "${repoRoot}"`).length;
            }
            return total;
        });

        const callerNames = new Set();
        const d1Lines = rg(`-n "${traceSym.name}\\(" --type js "${repoRoot}"`)
            .trim().split("\n").filter(Boolean).slice(0, 5);
        for (const line of d1Lines) {
            const m = line.match(/(?:function|const|let|var)\s+(\w+)/);
            if (m) callerNames.add(m[1]);
        }
        const depth2Ops = Math.min(callerNames.size, 3);

        const withChars = runN(() => {
            return JSON.stringify(
                tracePaths(selectorFor(traceSym), { path_kind: "calls", direction: "reverse", depth: 3, limit: 50 })
            ).length;
        });

        results.push({
            id: 4,
            scenario: `Trace call paths ("${name}")`,
            without: withoutChars,
            withG: withChars,
            opsWithout: 1 + depth2Ops,
            opsWith: 1,
            stepsWithout: 3,
            stepsWith: 1,
        });
    }

    // ===================================================================
    // TEST 5: Architecture overview
    // ===================================================================
    {
        const withoutChars = runN(() => {
            let total = 0;
            const subset = allFiles.slice(0, 50);
            for (const f of subset) {
                try { total += readFileSync(f, "utf-8").length; } catch { /* skip */ }
            }
            return total;
        });

        const filesRead = Math.min(allFiles.length, 50);

        const withChars = runN(() => {
            return JSON.stringify(getArchitectureReport()).length;
        });

        results.push({
            id: 5,
            scenario: "Architecture overview",
            without: withoutChars,
            withG: withChars,
            opsWithout: filesRead,
            opsWith: 1,
            stepsWithout: filesRead,
            stepsWith: 1,
        });
    }

    // ===================================================================
    // TEST 6: Find clones
    // ===================================================================
    {
        const withoutChars = runN(() => {
            let total = 0;
            total += rg(`-n "function " --type js "${repoRoot}" --max-count 50`).length;
            const subset = allFiles.slice(0, 10);
            for (const f of subset) {
                try { total += readFileSync(f, "utf-8").length; } catch {}
            }
            return total;
        });
        const filesRead = Math.min(allFiles.length, 10);

        const withChars = runN(() => {
            const result = findClones(store, { type: "all", threshold: 0.80, minStmts: 3, crossFile: true, format: "text", suppress: true });
            return (typeof result === "string" ? result : JSON.stringify(result)).length;
        });

        results.push({
            id: 6, scenario: "Find clones",
            without: withoutChars, withG: withChars,
            opsWithout: 1 + filesRead, opsWith: 1,
            stepsWithout: 2, stepsWith: 1,
        });
    }

    // ===================================================================
    // TEST 7: Find hotspots
    // ===================================================================
    {
        const withoutChars = runN(() => {
            let total = 0;
            total += rg(`-n "function " --type js "${repoRoot}"`).length;
            const funcNames = rg(`-o "function (\\w+)" --type js "${repoRoot}" --max-count 10`)
                .match(/function (\w+)/g)?.slice(0, 5) || [];
            for (const fn of funcNames) {
                const name = fn.replace("function ", "");
                total += rg(`-c "${name}" --type js "${repoRoot}"`).length;
            }
            return total;
        });

        const withChars = runN(() => {
            const result = getHotspots({ limit: 10 });
            return JSON.stringify(result).length;
        });

        results.push({
            id: 7, scenario: "Find hotspots",
            without: withoutChars, withG: withChars,
            opsWithout: 6, opsWith: 1,
            stepsWithout: 3, stepsWith: 1,
        });
    }

    // ===================================================================
    // TEST 8: Find unused exports
    // ===================================================================
    {
        const withoutChars = runN(() => {
            let total = 0;
            const exports = rg(`-n "export " --type js "${repoRoot}"`);
            total += exports.length;
            const syms = exports.match(/export (?:function|const|class) (\w+)/g)?.slice(0, 10) || [];
            for (const s of syms) {
                const name = s.split(" ").pop();
                total += rg(`-c "${name}" --type js "${repoRoot}"`).length;
            }
            return total;
        });

        const withChars = runN(() => {
            const result = runAuditWorkspaceUseCase({
                path: repoRoot,
                verbosity: "minimal",
                limit: 5,
                cloneMemberLimit: 3,
            });
            return JSON.stringify(result).length;
        });

        results.push({
            id: 8, scenario: "Find unused exports",
            without: withoutChars, withG: withChars,
            opsWithout: 11, opsWith: 1,
            stepsWithout: 3, stepsWith: 1,
        });
    }

    // ===================================================================
    // TEST 9: Find cycles
    // ===================================================================
    {
        const withoutChars = runN(() => {
            let total = 0;
            for (const f of allFiles.slice(0, 30)) {
                total += rg(`-n "import " "${f}"`).length;
            }
            return total;
        });
        const filesScanned = Math.min(allFiles.length, 30);

        const withChars = runN(() => {
            const result = findCycles(store);
            return JSON.stringify(result).length;
        });

        results.push({
            id: 9, scenario: "Find cycles",
            without: withoutChars, withG: withChars,
            opsWithout: filesScanned, opsWith: 1,
            stepsWithout: filesScanned + 1, stepsWith: 1,
        });
    }

    // ===================================================================
    // TEST 10: Get module metrics
    // ===================================================================
    {
        const withoutChars = runN(() => {
            let total = 0;
            for (const f of allFiles.slice(0, 30)) {
                total += rg(`-n "import " "${f}"`).length;
            }
            return total;
        });
        const filesScanned = Math.min(allFiles.length, 30);

        const withChars = runN(() => {
            const result = getModuleMetricsReport();
            return JSON.stringify(result).length;
        });

        results.push({
            id: 10, scenario: "Get module metrics",
            without: withoutChars, withG: withChars,
            opsWithout: filesScanned, opsWith: 1,
            stepsWithout: filesScanned + 2, stepsWith: 1,
        });
    }

    // ===================================================================
    // TEST 11: Find references
    // ===================================================================
    {
        const name = searchSym.name;

        const withoutChars = runN(() => {
            let total = 0;
            total += rg(`-n "${name}" --type js "${repoRoot}"`).length;
            total += rg(`-C 2 "${name}" --type js "${repoRoot}" --max-count 10`).length;
            return total;
        });

        const withChars = runN(() => {
            return JSON.stringify(getReferencesBySelector(selectorFor(searchSym))).length;
        });

        results.push({
            id: 11, scenario: `Find references ("${name}")`,
            without: withoutChars, withG: withChars,
            opsWithout: 2, opsWith: 1,
            stepsWithout: 3, stepsWith: 1,
        });
    }

    return results;
}
