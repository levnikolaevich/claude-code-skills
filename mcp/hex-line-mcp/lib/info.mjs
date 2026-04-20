/**
 * File metadata without reading content.
 *
 * Returns: size, line count, modification time, type, binary detection.
 */

import { statSync, openSync, readSync, closeSync } from "node:fs";
import { resolve, isAbsolute, extname, basename } from "node:path";
import { normalizePath } from "./security.mjs";
import { countFileLines } from "./format.mjs";

const MAX_LINE_COUNT_SIZE = 10 * 1024 * 1024; // 10 MB

const EXT_NAMES = {
    ".ts": "TypeScript source", ".tsx": "TypeScript JSX source",
    ".js": "JavaScript source", ".jsx": "JavaScript JSX source",
    ".mjs": "JavaScript ESM source", ".cjs": "JavaScript CJS source",
    ".py": "Python source", ".rb": "Ruby source", ".rs": "Rust source",
    ".go": "Go source", ".java": "Java source", ".kt": "Kotlin source",
    ".swift": "Swift source", ".c": "C source", ".cpp": "C++ source",
    ".h": "C/C++ header", ".cs": "C# source", ".php": "PHP source",
    ".sh": "Shell script", ".bash": "Bash script", ".zsh": "Zsh script",
    ".json": "JSON data", ".yaml": "YAML data", ".yml": "YAML data",
    ".toml": "TOML config", ".xml": "XML document", ".html": "HTML document",
    ".css": "CSS stylesheet", ".scss": "SCSS stylesheet", ".less": "LESS stylesheet",
    ".md": "Markdown document", ".txt": "Plain text", ".csv": "CSV data",
    ".sql": "SQL script", ".graphql": "GraphQL schema",
    ".png": "PNG image", ".jpg": "JPEG image", ".jpeg": "JPEG image",
    ".gif": "GIF image", ".svg": "SVG image", ".ico": "Icon file",
    ".pdf": "PDF document", ".zip": "ZIP archive", ".tar": "TAR archive",
    ".gz": "Gzip archive", ".wasm": "WebAssembly binary",
    ".lock": "Lock file", ".env": "Environment config",
    ".dockerfile": "Dockerfile", ".vue": "Vue component", ".svelte": "Svelte component",
};


function detectBinary(filePath, size) {
    if (size === 0) return false;
    const fd = openSync(filePath, "r");
    const probe = Buffer.alloc(Math.min(size, 8192));
    const bytesRead = readSync(fd, probe, 0, probe.length, 0);
    closeSync(fd);
    for (let i = 0; i < bytesRead; i++) {
        if (probe[i] === 0) return true;
    }
    return false;
}

/**
 * Get file metadata without reading full content.
 * @param {string} filePath
 * @returns {string} Formatted metadata
 */
export function fileInfo(filePath) {
    if (!filePath) throw new Error("Empty file path");
    const normalized = normalizePath(filePath);
    const abs = isAbsolute(normalized) ? normalized : resolve(process.cwd(), normalized);

    const stat = statSync(abs);
    if (!stat.isFile()) throw new Error(`Not a regular file: ${abs}`);

    const size = stat.size;
    const mtime = stat.mtime;
    const ext = extname(abs).toLowerCase();
    const name = basename(abs);

    // File type
    let typeName = EXT_NAMES[ext] || (ext ? `${ext.slice(1).toUpperCase()} file` : "Unknown type");
    if (name === "Dockerfile") typeName = "Dockerfile";
    if (name === "Makefile") typeName = "Makefile";

    // Binary detection
    const isBinary = size > 0 ? detectBinary(abs, size) : false;

    // Line count (only for non-binary, <=10MB)
    const lineCount = !isBinary && size > 0 ? countFileLines(abs, size, MAX_LINE_COUNT_SIZE) : null;

    // Format output (kv grammar)
    const parts = [`size=${size}`];
    if (lineCount !== null) parts.push(`lines=${lineCount}`);
    parts.push(`mtime=${mtime.toISOString()}`);
    parts.push(`type=${typeName}`);
    if (isBinary) parts.push(`binary=yes`);
    return parts.join(" ");
}
