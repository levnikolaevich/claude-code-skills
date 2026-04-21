/**
 * TEST 13: Index cost and break-even calculation.
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { performance } from "node:perf_hooks";
import { RUNS, rg } from "./helpers.mjs";
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
import { indexProject } from "../lib/indexer.mjs";
import { runAuditWorkspaceUseCase } from "../lib/use-cases.mjs";

/**
 * @param {object} store  — initialized graph store
 * @param {object} config — { repoRoot, searchSym, contextSym, impactSym, traceSym }
 * @returns {{ indexTimeMs: number, avgQueryMs: number, breakEven: number, avgBuiltinMs: number }}
 */
export async function runAmortization(store, config) {
    const { repoRoot, searchSym, contextSym, impactSym, traceSym } = config;
    const selectorFor = (sym) => ({ name: sym.name, file: sym.file });

    // Measure full rebuild index time.
    const t0 = performance.now();
    await indexProject(repoRoot);
    const indexTimeMs = performance.now() - t0;

    // Measure average query time from the atomic benchmark set
    const queryTimes = [];
    const queries = [
        () => findSymbols(searchSym.name, { limit: 20 }),
        () => getSymbol(selectorFor(contextSym)),
        () => tracePaths(selectorFor(impactSym), { path_kind: "mixed", direction: "reverse", depth: 3, limit: 50 }),
        () => tracePaths(selectorFor(traceSym), { path_kind: "calls", direction: "reverse", depth: 3, limit: 50 }),
        () => getArchitectureReport(),
        () => findClones(store, { type: "all", threshold: 0.80, minStmts: 3, crossFile: true, format: "text", suppress: true }),
        () => getHotspots({ limit: 10 }),
        () => runAuditWorkspaceUseCase({ path: repoRoot, verbosity: "minimal", limit: 5, cloneMemberLimit: 3 }),
        () => findCycles(store),
        () => getModuleMetricsReport(),
        () => getReferencesBySelector(selectorFor(searchSym)),
    ];
    for (const q of queries) {
        const qt0 = performance.now();
        for (let i = 0; i < RUNS; i++) q();
        queryTimes.push((performance.now() - qt0) / RUNS);
    }
    const avgQueryMs = queryTimes.reduce((a, b) => a + b, 0) / queryTimes.length;

    // Measure average built-in query time for break-even calculation
    const builtinTimes = [];
    const builtinQueries = [
        () => rg(`-n "${searchSym.name}" --type js "${repoRoot}" --max-count 30`),
        () => { readFileSync(resolve(repoRoot, contextSym.file), "utf-8"); },
        () => rg(`-l "${impactSym.name}" --type js "${repoRoot}"`),
    ];
    for (const q of builtinQueries) {
        const qt0 = performance.now();
        for (let i = 0; i < RUNS; i++) q();
        builtinTimes.push((performance.now() - qt0) / RUNS);
    }
    const avgBuiltinMs = builtinTimes.reduce((a, b) => a + b, 0) / builtinTimes.length;

    const savingsPerQuery = avgBuiltinMs - avgQueryMs;
    const breakEven = savingsPerQuery > 0 ? Math.ceil(indexTimeMs / savingsPerQuery) : Infinity;

    return { indexTimeMs, avgQueryMs, breakEven, avgBuiltinMs };
}
