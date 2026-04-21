/**
 * Session-derived graph workflows based on recent real refactor/review tasks.
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { runN, rg, git } from "./helpers.mjs";
import { semanticGitDiff } from "@levnikolaevich/hex-common/git/semantic-diff";
import {
    findSymbols,
    getSymbol,
    tracePaths,
    getArchitectureReport,
    getHotspots,
    getModuleMetricsReport,
    getReferencesBySelector,
} from "../lib/store.mjs";
import { findCycles } from "../lib/cycles.mjs";
import { getPrImpact } from "../lib/pr-impact.mjs";
import { runAuditWorkspaceUseCase } from "../lib/use-cases.mjs";

/**
 * @param {object} store  — initialized graph store
 * @param {object} config — { repoRoot, allFiles, searchSym, contextSym, impactSym, traceSym }
 * @returns {object[]}    — array of workflow result rows
 */
export async function runWorkflows(store, config) {
    const workflows = [];
    const { repoRoot, allFiles, searchSym, impactSym, prBaseRef, prHeadRef } = config;
    const selectorFor = (sym) => ({ name: sym.name, file: sym.file });

    // W1: derived from "Merge scanner and synchronizer into system configurator"
    {
        const withoutChars = runN(() => {
            let total = 0;
            const subset = allFiles.slice(0, 10);
            for (const f of subset) {
                try { total += readFileSync(f, "utf-8").length; } catch {}
            }
            total += rg(`-n "function " --type js "${repoRoot}" --max-count 30`).length;
            total += rg(`-n "class " --type js "${repoRoot}" --max-count 30`).length;
            return total;
        });

        const withChars = runN(() => {
            let total = 0;
            total += JSON.stringify(getArchitectureReport()).length;
            total += JSON.stringify(findSymbols("main", { limit: 5 })).length;
            if (searchSym) total += JSON.stringify(getSymbol(selectorFor(searchSym))).length;
            return total;
        });

        workflows.push({
            id: "W1", scenario: "Explore unfamiliar MCP before refactor",
            without: withoutChars, withG: withChars,
            opsWithout: 12, opsWith: 3,
            stepsWithout: 12, stepsWith: 3,
        });
    }

    // W2: derived from "Estimate blast radius before semantic/server refactor"
    {
        const name = impactSym?.name || searchSym.name;
        const withoutChars = runN(() => {
            let total = 0;
            total += rg(`-n "${name}" --type js "${repoRoot}"`).length;
            total += rg(`-l "${name}" --type js "${repoRoot}"`).length;
            const files = rg(`-l "${name}" --type js "${repoRoot}"`).trim().split("\n").filter(Boolean).slice(0, 5);
            for (const f of files) {
                try { total += readFileSync(f, "utf-8").length; } catch {}
            }
            return total;
        });

        const withChars = runN(() => {
            let total = 0;
            total += JSON.stringify(tracePaths(selectorFor(impactSym || searchSym), { path_kind: "mixed", direction: "reverse", depth: 3, limit: 50 })).length;
            total += JSON.stringify(getReferencesBySelector(selectorFor(impactSym || searchSym))).length;
            total += JSON.stringify(tracePaths(selectorFor(impactSym || searchSym), { path_kind: "calls", direction: "reverse", depth: 2, limit: 50 })).length;
            return total;
        });

        workflows.push({
            id: "W2", scenario: "Estimate blast radius before refactor",
            without: withoutChars, withG: withChars,
            opsWithout: 7, opsWith: 3,
            stepsWithout: 5, stepsWith: 3,
        });
    }

    // W3: derived from "Review and assess coding skills"
    {
        const withoutChars = runN(() => {
            let total = 0;
            total += rg(`-n "export " --type js "${repoRoot}"`).length;
            for (const f of allFiles.slice(0, 20)) {
                total += rg(`-n "import " "${f}"`).length;
            }
            total += rg(`-n "function " --type js "${repoRoot}"`).length;
            return total;
        });

        const withChars = runN(() => {
            let total = 0;
            total += JSON.stringify(runAuditWorkspaceUseCase({
                path: repoRoot,
                verbosity: "minimal",
                limit: 5,
                cloneMemberLimit: 3,
            })).length;
            total += JSON.stringify(findCycles(store)).length;
            total += JSON.stringify(getHotspots({ limit: 10 })).length;
            total += JSON.stringify(getModuleMetricsReport()).length;
            return total;
        });

        workflows.push({
            id: "W3", scenario: "Audit cycles, dead exports, hotspots",
            without: withoutChars, withG: withChars,
            opsWithout: 22, opsWith: 4,
            stepsWithout: 22, stepsWith: 4,
        });
    }

    // W4: derived from PR/review sessions over server/store changes
    {
        const diffRef = prHeadRef ? `${prBaseRef}...${prHeadRef}` : prBaseRef;
        const semanticDiff = await semanticGitDiff(repoRoot, { baseRef: prBaseRef, headRef: prHeadRef || null });
        const changedFiles = semanticDiff.changed_files.map(file => resolve(semanticDiff.repo_root, file.path));
        const withoutChars = runN(() => {
            let total = 0;
            total += git(["diff", "--stat", "-M", ...(prHeadRef ? [`${prBaseRef}...${prHeadRef}`] : [prBaseRef]), "--", "."], repoRoot, true).length;
            total += git(["diff", "--unified=0", "-M", ...(prHeadRef ? [`${prBaseRef}...${prHeadRef}`] : [prBaseRef]), "--", "."], repoRoot, true).length;
            for (const file of changedFiles.slice(0, 5)) {
                total += rg(`-n "function |class |export |def |public " "${file}" --max-count 20`).length;
            }
            return total;
        });

        const withResult = await getPrImpact({
            path: repoRoot,
            baseRef: prBaseRef,
            headRef: prHeadRef || null,
            includePaths: false,
            maxSymbols: 12,
            maxPaths: 5,
        });
        const withChars = runN(() => JSON.stringify(withResult).length, 1);

        workflows.push({
            id: "W4", scenario: "Review PR semantic risk snapshot",
            without: withoutChars, withG: withChars,
            opsWithout: 4, opsWith: 1,
            stepsWithout: 4, stepsWith: 1,
            refs: diffRef,
        });
    }

    return workflows;
}
