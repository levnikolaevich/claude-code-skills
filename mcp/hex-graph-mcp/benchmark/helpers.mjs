/**
 * Shared helpers for hex-graph benchmark modules.
 */

import { execFileSync, execSync } from "node:child_process";
import { statSync } from "node:fs";
import { resolve, extname } from "node:path";
import { listProjectFiles } from "../lib/file-discovery.mjs";

export const CODE_EXTS = new Set([".js", ".mjs", ".cjs", ".jsx", ".ts", ".tsx", ".py", ".cs", ".php"]);
export const RUNS = 3;

export function fmt(n) {
    return n.toLocaleString("en-US", { maximumFractionDigits: 0 });
}

export function pctSavings(without, withG) {
    if (without === 0) return "N/A";
    const pct = ((without - withG) / without) * 100;
    return pct >= 0 ? `${pct.toFixed(0)}%` : `-${Math.abs(pct).toFixed(0)}%`;
}

export function walkDir(dir) {
    const root = resolve(dir);
    const results = [];
    for (const relPath of listProjectFiles(root)) {
        if (!CODE_EXTS.has(extname(relPath).toLowerCase())) continue;
        const full = resolve(root, relPath);
        try {
            const st = statSync(full);
            if (st.size > 0 && st.size < 1_000_000) results.push(full);
        } catch { /* skip */ }
    }
    return results;
}

export function median(arr) {
    const sorted = [...arr].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

export function runN(fn, n = RUNS) {
    const results = [];
    for (let i = 0; i < n; i++) results.push(fn());
    return median(results);
}

/** Safely extract string result from a graph function (may return error object) */
export function graphResult(result) {
    if (result && typeof result === "object" && result.isError) {
        const text = result.content?.map(c => c.text).join("\n") || "ERROR";
        return { text, isError: true };
    }
    return { text: String(result), isError: false };
}

/** Run ripgrep safely, return stdout string */
export function rg(rgArgs) {
    try {
        return execSync(`rg ${rgArgs}`, { encoding: "utf-8", maxBuffer: 10 * 1024 * 1024 });
    } catch (e) {
        // rg exits 1 when no matches found
        return e.stdout || "";
    }
}

export function git(args, cwd, allowFailure = false) {
    try {
        return execFileSync("git", args, {
            cwd,
            encoding: "utf8",
            timeout: 10000,
        }).replace(/\r\n/g, "\n");
    } catch (error) {
        if (allowFailure) return "";
        throw error;
    }
}
