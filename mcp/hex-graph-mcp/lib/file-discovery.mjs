/**
 * Project file inventory for graph indexing.
 *
 * Git repositories use Git's own exclude engine so .gitignore, info/exclude,
 * and global excludes are interpreted exactly as the working tree sees them.
 * Non-Git fixtures fall back to a deterministic walker with common generated
 * directories and root .gitignore rules.
 */

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import picomatch from "picomatch";
import { CODEGRAPH_DIR } from "./store.mjs";

const WALK_IGNORE_DIRS = new Set([
    "node_modules", ".git", "dist", "build", "out", ".next",
    "__pycache__", ".venv", "venv", "vendor", "target",
    CODEGRAPH_DIR, ".vs", "bin", "obj",
]);

function normalizeRelPath(path) {
    return path.replace(/\\/g, "/").replace(/^\.\//, "").replace(/\/+$/, "");
}

function isInsideProject(relPath) {
    return relPath && relPath !== "." && !relPath.startsWith("../") && !relPath.startsWith("..\\");
}

function gitInventory(projectPath) {
    try {
        const output = execFileSync("git", ["ls-files", "-co", "--exclude-standard", "--", "."], {
            cwd: projectPath,
            encoding: "utf8",
            stdio: ["ignore", "pipe", "ignore"],
            timeout: 10_000,
            maxBuffer: 50 * 1024 * 1024,
        });
        return output
            .split(/\r?\n/)
            .map(normalizeRelPath)
            .filter(isInsideProject)
            .filter(relPath => existsSync(join(projectPath, relPath)));
    } catch {
        return null;
    }
}

function gitignorePatternVariants(pattern, { anchored, directoryOnly }) {
    const variants = [];
    const pathPattern = pattern.replace(/^\/+/, "").replace(/\/+$/, "");
    if (!pathPattern) return variants;

    const hasSlash = pathPattern.includes("/");
    const bases = anchored || hasSlash
        ? [pathPattern]
        : [pathPattern, `**/${pathPattern}`];

    for (const base of bases) {
        variants.push(base);
        if (directoryOnly) variants.push(`${base}/**`);
    }
    return variants;
}

function loadRootGitignoreRules(projectPath) {
    const gitignorePath = join(projectPath, ".gitignore");
    if (!existsSync(gitignorePath)) return [];

    let lines;
    try {
        lines = readFileSync(gitignorePath, "utf8").split(/\r?\n/);
    } catch {
        return [];
    }

    const rules = [];
    for (let raw of lines) {
        raw = raw.trimEnd();
        if (!raw || raw.startsWith("#")) continue;

        const negated = raw.startsWith("!");
        if (negated) raw = raw.slice(1);
        if (!raw || raw.startsWith("#")) continue;

        const anchored = raw.startsWith("/");
        const directoryOnly = raw.endsWith("/");
        const variants = gitignorePatternVariants(raw, { anchored, directoryOnly });
        if (variants.length === 0) continue;

        rules.push({
            negated,
            isMatch: picomatch(variants, { dot: true }),
        });
    }
    return rules;
}

function isIgnoredByRules(relPath, rules) {
    let ignored = false;
    const normalized = normalizeRelPath(relPath);
    for (const rule of rules) {
        if (rule.isMatch(normalized)) ignored = !rule.negated;
    }
    return ignored;
}

function fallbackInventory(projectPath) {
    const results = [];
    const rules = loadRootGitignoreRules(projectPath);

    function walk(dir, depth = 0) {
        if (depth > 12) return;
        let entries;
        try {
            entries = readdirSync(dir, { withFileTypes: true });
        } catch {
            return;
        }

        for (const entry of entries) {
            const fullPath = resolve(dir, entry.name);
            const relPath = normalizeRelPath(relative(projectPath, fullPath));
            if (!isInsideProject(relPath)) continue;

            if (entry.isDirectory()) {
                if (WALK_IGNORE_DIRS.has(entry.name) || entry.name.startsWith(".")) continue;
                if (isIgnoredByRules(relPath, rules)) continue;
                walk(fullPath, depth + 1);
                continue;
            }

            if (!entry.isFile()) continue;
            if (isIgnoredByRules(relPath, rules)) continue;
            results.push(relPath);
        }
    }

    walk(projectPath);
    return results;
}

export function listProjectFiles(projectPath) {
    const absPath = resolve(projectPath);
    return gitInventory(absPath) ?? fallbackInventory(absPath);
}
