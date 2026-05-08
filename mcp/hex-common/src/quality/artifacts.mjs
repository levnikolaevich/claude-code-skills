import assert from "node:assert/strict";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, relative } from "node:path";

export function stableJson(value) {
    return `${JSON.stringify(value, null, 2)}\n`;
}

export function readJson(path) {
    return JSON.parse(readFileSync(path, "utf8"));
}

export function writeJson(path, value) {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, stableJson(value), "utf8");
}

export function ensureDir(path) {
    mkdirSync(path, { recursive: true });
}

export function compareOrWrite(path, content, { check = false, root = process.cwd() } = {}) {
    const current = existsSync(path) ? readFileSync(path, "utf8") : null;
    if (check) {
        assert.equal(current, content, `${relative(root, path)} is out of sync`);
        return false;
    }
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, content, "utf8");
    return current !== content;
}

export function assertExactCoverage(actual, expected, message = "matrix must cover expected names exactly") {
    assert.deepEqual([...actual].sort(), [...expected].sort(), message);
}

export function textStats(value) {
    const chars = value.length;
    return { chars, estimated_tokens: Math.ceil(chars / 4) };
}

export function replaceDelimitedBlock(text, start, end, content) {
    const pattern = new RegExp(`${escapeRegExp(start)}[\\s\\S]*?${escapeRegExp(end)}`);
    assert.ok(pattern.test(text), `Generated block markers are incomplete: ${start} / ${end}`);
    return text.replace(pattern, `${start}\n${content}\n${end}`);
}

export function replaceGeneratedBlock(text, marker, content) {
    return replaceDelimitedBlock(text, `<!-- GENERATED:${marker}:START -->`, `<!-- GENERATED:${marker}:END -->`, content);
}

export function replaceSingleLine(text, pattern, replacement, description) {
    if (!pattern.test(text)) {
        throw new Error(`${description} not found`);
    }
    return text.replace(pattern, replacement);
}

export function normalizeEol(text) {
    return text.replace(/\r\n/g, "\n");
}

function escapeRegExp(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
