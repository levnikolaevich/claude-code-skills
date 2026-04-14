/**
 * Security boundaries for file operations.
 *
 * Claude Code provides its own sandbox (permissions, project scope).
 * This module handles: path canonicalization, symlink resolution,
 * binary file detection, and size limits.
 */

import { realpathSync, statSync, existsSync, openSync, readSync, closeSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve, isAbsolute, dirname } from "node:path";
import { listDirectory } from "./format.mjs";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

// Folders whose contents are runtime/config artifacts, not project files.
// Edits inside these folders are allowed even when the path is outside the
// current project root (e.g. ~/.claude/plans/, project-foreign .hex-skills/).
const EXTERNAL_SAFE_FOLDERS = [
    ".hex-skills/",
    ".claude/",
];

function isInExternalSafeFolder(absPath) {
    return EXTERNAL_SAFE_FOLDERS.some((folder) => absPath.includes(folder));
}

/**
 * Convert Git Bash /c/Users/... → c:/Users/... on Windows.
 * Node.js resolve() treats /c/ as absolute from current drive root, producing D:\c\Users.
 */
export function normalizePath(p) {
    if (process.platform === "win32") {
        if (p === "/tmp" || p.startsWith("/tmp/")) {
            const suffix = p.slice("/tmp".length).replace(/^\/+/, "");
            p = suffix ? resolve(tmpdir(), suffix) : tmpdir();
        } else if (p === "/var/tmp" || p.startsWith("/var/tmp/")) {
            const suffix = p.slice("/var/tmp".length).replace(/^\/+/, "");
            p = suffix ? resolve(tmpdir(), suffix) : tmpdir();
        } else if (/^\/[a-zA-Z]\//.test(p)) {
            p = p[1] + ":" + p.slice(2);
        }
    }
    return p.replace(/\\/g, "/");
}

function normalizeScopeValue(value) {
    const normalized = value.replace(/\\/g, "/");
    return process.platform === "win32" ? normalized.toLowerCase() : normalized;
}

function resolveInputPath(filePath) {
    const normalized = normalizePath(filePath);
    const abs = isAbsolute(normalized) ? normalized : resolve(process.cwd(), normalized);
    return abs.replace(/\\/g, "/");
}

function isWithinRoot(rootPath, targetPath) {
    const root = normalizeScopeValue(rootPath).replace(/\/+$/, "");
    const target = normalizeScopeValue(targetPath);
    return target === root || target.startsWith(`${root}/`);
}

export function assertProjectScopedPath(filePath, { allowExternal = false } = {}) {
    if (!filePath) throw new Error("Empty file path");
    const abs = resolveInputPath(filePath);
    if (allowExternal) return abs;
    if (isInExternalSafeFolder(abs)) return abs;
    const projectRoot = resolve(process.cwd()).replace(/\\/g, "/");
    if (isWithinRoot(projectRoot, abs)) return abs;

    throw new Error(
        `PATH_OUTSIDE_PROJECT: ${abs}. Editing is restricted to the current project by default. ` +
        "If you intentionally need a temp or external path, retry with allow_external=true."
    );
}

/**
 * Validate a file path against security boundaries.
 * Returns the canonicalized absolute path.
 * Throws on violation.
 */
export function validatePath(filePath) {
    if (!filePath) throw new Error("Empty file path");

    const normalized = normalizePath(filePath);
    const abs = isAbsolute(normalized) ? normalized : resolve(process.cwd(), normalized);

    // Check existence — show parent directory contents as fallback
    if (!existsSync(abs)) {
        let hint = "";
        try {
            const parent = dirname(abs);
            if (existsSync(parent)) {
                const { text, total } = listDirectory(parent, { limit: 20, metadata: true });
                hint = `\n\nParent directory ${parent} contains:\n${text}`;
                if (total > 20) hint += `\n  ... (${total - 20} more)`;
            }
        } catch {}
        throw new Error(`FILE_NOT_FOUND: ${abs}${hint}`);
    }

    // Canonicalize (resolves symlinks)
    let real;
    try {
        real = realpathSync(abs);
    } catch (e) {
        throw new Error(`Cannot resolve path: ${abs} (${e.message})`);
    }

    // Check file type
    const stat = statSync(real);
    if (stat.isDirectory()) return real; // directories allowed for listing
    if (!stat.isFile()) {
        const type = stat.isSymbolicLink() ? "symlink" : "special";
        throw new Error(`NOT_REGULAR_FILE: ${real} (${type}). Cannot read special files.`);
    }

    // Size check
    if (stat.size > MAX_FILE_SIZE) {
        throw new Error(`FILE_TOO_LARGE: ${real} (${(stat.size / 1024 / 1024).toFixed(1)}MB, max ${MAX_FILE_SIZE / 1024 / 1024}MB). Use offset/limit to read a range.`);
    }

    // Binary detection (check first 8KB for null bytes — only read 8KB, not whole file)
    const bfd = openSync(real, "r");
    const probe = Buffer.alloc(8192);
    const bytesRead = readSync(bfd, probe, 0, 8192, 0);
    closeSync(bfd);
    for (let i = 0; i < bytesRead; i++) {
        if (probe[i] === 0) {
            throw new Error(`BINARY_FILE: ${real}. Use built-in Read tool (supports images, PDFs, notebooks).`);
        }
    }

    return real.replace(/\\/g, "/");
}

/**
 * Validate path for write (does NOT require file to exist).
 * Resolves to absolute path, validates parent exists or can be created.
 */
export function validateWritePath(filePath) {
    if (!filePath) throw new Error("Empty file path");

    const normalized = normalizePath(filePath);
    const abs = isAbsolute(normalized) ? normalized : resolve(process.cwd(), normalized);

    // For write, the file might not exist yet — validate the parent directory
    if (!existsSync(abs)) {
        const parent = resolve(abs, "..");
        if (!existsSync(parent)) {
            // Walk up to find an existing ancestor (parent dirs will be created by write_file)
            let ancestor = resolve(parent, "..");
            while (!existsSync(ancestor) && ancestor !== resolve(ancestor, "..")) {
                ancestor = resolve(ancestor, "..");
            }
            if (!existsSync(ancestor)) {
                throw new Error(`No existing ancestor directory for: ${abs}`);
            }
        }
    }

    return abs.replace(/\\/g, "/");
}
