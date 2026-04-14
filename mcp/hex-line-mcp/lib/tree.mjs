/**
 * Compact directory tree with root .gitignore support.
 *
 * Skips common build/cache dirs by default.
 * Uses `ignore` package for spec-compliant .gitignore matching (path-based, negation, dir-only).
 * Only root .gitignore is loaded — nested .gitignore files are not supported.
 */

import { readdirSync, readFileSync, statSync, existsSync } from "node:fs";
import { resolve, basename, join, relative } from "node:path";
import { formatSize, relativeTime, countFileLines } from "./format.mjs";
import { normalizePath } from "./security.mjs";
import ignore from "ignore";

const SKIP_DIRS = new Set([
    "node_modules", ".git", "dist", "build", "__pycache__", ".next", "coverage",
]);

/**
 * Convert a simple glob pattern to a RegExp for name matching.
 * Used by pattern-mode to match entry names.
 */
function globToRegex(pat) {
    return new RegExp(
        "^" + pat.replace(/[.+^${}()|[\]\\]/g, "\\$&")
                  .replace(/\*\*/g, "\0")
                  .replace(/\*/g, "[^/]*")
                  .replace(/\0/g, ".*")
                  .replace(/\?/g, ".") + "$"
    );
}

/**
 * Load root .gitignore into an `ignore` instance.
 * @param {string} rootDir - absolute path to tree root
 * @returns {ReturnType<typeof ignore>|null}
 */
function loadGitignore(rootDir) {
    const gi = join(rootDir, ".gitignore");
    if (!existsSync(gi)) return null;
    try {
        const content = readFileSync(gi, "utf-8");
        return ignore().add(content);
    } catch { return null; }
}

/**
 * Check if a relative path should be ignored.
 * @param {ReturnType<typeof ignore>|null} ig - ignore instance (null = no gitignore)
 * @param {string} relPath - POSIX relative path from tree root
 * @param {boolean} isDir - true if directory
 * @returns {boolean}
 */
function isIgnored(ig, relPath, isDir) {
    if (!ig) return false;
    // ignore package expects dir paths to end with /
    return ig.ignores(isDir ? relPath + "/" : relPath);
}

function topPatternGroups(matches) {
    const groups = new Map();
    for (const entry of matches) {
        const trimmed = entry.endsWith("/") ? entry.slice(0, -1) : entry;
        const [head] = trimmed.split("/");
        const key = trimmed.includes("/") ? head : ".";
        groups.set(key, (groups.get(key) || 0) + 1);
    }
    return [...groups.entries()]
        .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
        .slice(0, 4);
}

function buildPatternRefineCall(absRoot, pattern, type, groups) {
    const bestGroup = groups.find(([key]) => key !== ".")?.[0];
    const args = { path: bestGroup ? join(absRoot, bestGroup) : absRoot, pattern };
    if (type && type !== "all") args.type = type;
    return JSON.stringify({
        tool: "mcp__hex-line__inspect_path",
        arguments: args,
    });
}

/**
 * Find files/dirs by glob pattern. Returns flat list of relative paths.
 * @param {string} dirPath - Root directory to search
 * @param {object} opts - { pattern, type, max_depth, gitignore }
 * @returns {string} Formatted match list
 */
function findByPattern(dirPath, opts) {
    const re = globToRegex(opts.pattern);
    const filterType = opts.type || "all";
    const maxDepth = opts.max_depth ?? 20;
    const maxEntries = opts.max_entries === 0
        ? 0
        : Math.max(1, Number(opts.max_entries ?? 60));

    const abs = resolve(normalizePath(dirPath));
    if (!existsSync(abs)) throw new Error(`DIRECTORY_NOT_FOUND: ${abs}`);
    if (!statSync(abs).isDirectory()) throw new Error(`Not a directory: ${abs}`);

    const ig = (opts.gitignore ?? true) ? loadGitignore(abs) : null;
    const matches = [];

    function walk(dir, depth) {
        if (depth > maxDepth) return;
        let entries;
        try { entries = readdirSync(dir, { withFileTypes: true }); } catch { return; }

        for (const entry of entries) {
            const isDir = entry.isDirectory();
            if (SKIP_DIRS.has(entry.name) && isDir) continue;

            const full = join(dir, entry.name);
            const rel = relative(abs, full).replace(/\\/g, "/");
            if (isIgnored(ig, rel, isDir)) continue;

            if (re.test(entry.name)) {
                if (filterType === "all" ||
                    (filterType === "dir" && isDir) ||
                    (filterType === "file" && !isDir)) {
                    matches.push(isDir ? rel + "/" : rel);
                }
            }

            if (isDir) walk(full, depth + 1);
        }
    }

    walk(abs, 1);
    matches.sort();

    const rootName = basename(abs);
    if (matches.length === 0) {
        return `No matches for "${opts.pattern}" in ${rootName}/`;
    }
    const shown = maxEntries === 0 ? matches : matches.slice(0, maxEntries);
    const truncated = shown.length < matches.length;
    const groups = topPatternGroups(matches);
    const lines = [
        `Found ${matches.length} match${matches.length === 1 ? "" : "es"} for "${opts.pattern}" in ${rootName}/`,
    ];
    if (truncated) {
        lines.push(`shown_count: ${shown.length}`);
        lines.push(`truncated: true`);
    }
    if (groups.length > 1) {
        lines.push(`top_groups: ${groups.map(([group, count]) => `${group} (${count})`).join(", ")}`);
    }
    if (truncated) {
        lines.push("next_action: narrow_path");
        lines.push(`suggested_refine_call: ${buildPatternRefineCall(abs, opts.pattern, filterType, groups)}`);
    }
    lines.push("");
    lines.push(...shown);
    return lines.join("\n");
}

/**
 * Build directory tree recursively, or find by pattern.
 * @param {string} dirPath - Absolute directory path
 * @param {object} opts - { max_depth, gitignore, format, pattern, type }
 * @returns {string} Formatted tree or match list
 */
export function directoryTree(dirPath, opts = {}) {
    if (opts.pattern) return findByPattern(dirPath, opts);

    const compact = opts.format === "compact";
    const maxDepth = compact ? 1 : (opts.max_depth ?? 3);

    const abs = resolve(normalizePath(dirPath));
    if (!existsSync(abs)) throw new Error(`DIRECTORY_NOT_FOUND: ${abs}. Check path or use inspect_path on the parent directory.`);
    const rootStat = statSync(abs);
    if (!rootStat.isDirectory()) throw new Error(`Not a directory: ${abs}`);

    const ig = (opts.gitignore ?? true) ? loadGitignore(abs) : null;

    let totalFiles = 0;
    let totalSize = 0;
    const lines = [];

    /**
     * Recursive walk. Returns total file count for entire subtree
     * (including beyond maxDepth — count is always full, display is depth-limited).
     * Output order: pre-order (dir line before children).
     */
    function walk(dir, prefix, depth) {
        let entries;
        try {
            entries = readdirSync(dir, { withFileTypes: true });
        } catch { return 0; }

        // Sort: directories first, then files, alphabetical
        entries.sort((a, b) => {
            const aDir = a.isDirectory() ? 0 : 1;
            const bDir = b.isDirectory() ? 0 : 1;
            if (aDir !== bDir) return aDir - bDir;
            return a.name.localeCompare(b.name);
        });

        let subTotal = 0;

        for (const entry of entries) {
            const name = entry.name;
            const isDir = entry.isDirectory();

            if (SKIP_DIRS.has(name) && isDir) continue;

            const full = join(dir, name);
            const rel = relative(abs, full).replace(/\\/g, "/");
            if (isIgnored(ig, rel, isDir)) continue;

            if (isDir) {
                if (compact) {
                    lines.push(`${prefix}${name}/`);
                } else {
                    // Pre-order: placeholder for dir line, patch after recursion
                    const lineIdx = lines.length;
                    lines.push("");
                    const count = depth < maxDepth
                        ? walk(full, prefix + "  ", depth + 1)
                        : countSubtreeFiles(full, ig, abs);
                    lines[lineIdx] = `${prefix}${name}/ (${count} files)`;
                    subTotal += count;
                }
                if (compact) walk(full, prefix + "  ", depth + 1);
            } else {
                totalFiles++;
                subTotal++;
                if (compact) {
                    lines.push(`${prefix}${name}`);
                } else {
                    let size = 0, mtime = null, lineCount = null;
                    try {
                        const st = statSync(full);
                        size = st.size;
                        mtime = st.mtime;
                    } catch { /* skip */ }
                    totalSize += size;
                    lineCount = countFileLines(full, size);
                    const parts = [];
                    if (lineCount !== null) parts.push(`${lineCount}L`);
                    parts.push(formatSize(size));
                    if (mtime) parts.push(relativeTime(mtime, true));
                    lines.push(`${prefix}${name} (${parts.join(", ")})`);
                }
            }
        }

        return subTotal;
    }

    /**
     * Count files in subtree without emitting lines (for dirs beyond maxDepth).
     */
    function countSubtreeFiles(dir, ig, rootAbs, depth = 0) {
        if (depth > 10) return 0;
        let entries;
        try { entries = readdirSync(dir, { withFileTypes: true }); } catch { return 0; }
        let count = 0;
        for (const entry of entries) {
            if (SKIP_DIRS.has(entry.name) && entry.isDirectory()) continue;
            const full = join(dir, entry.name);
            const rel = relative(rootAbs, full).replace(/\\/g, "/");
            if (isIgnored(ig, rel, entry.isDirectory())) continue;
            if (entry.isDirectory()) {
                count += countSubtreeFiles(full, ig, rootAbs, depth + 1);
            } else {
                count++;
            }
        }
        return count;
    }

    const rootName = basename(abs);
    walk(abs, "  ", 1);

    const header = compact
        ? `Directory: ${rootName}/ (${totalFiles} files)`
        : `Directory: ${rootName}/ (${totalFiles} files, ${formatSize(totalSize)})`;
    return `${header}\n\n${rootName}/\n${lines.join("\n")}`;
}
