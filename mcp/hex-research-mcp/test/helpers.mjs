import assert from "node:assert/strict";
import { cpSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { closeAllStores } from "../lib/store.mjs";

export const __dirname = dirname(fileURLToPath(import.meta.url));
export const PACKAGE_ROOT = resolve(__dirname, "..");
export const FIXTURE_ROOT = join(__dirname, "fixtures", "project");
export const INVALID_FIXTURE_ROOT = join(__dirname, "fixtures", "invalid");

export function copyFixture(name = "research") {
    const dir = mkdtempSync(join(tmpdir(), `hex-${name}-`));
    cpSync(FIXTURE_ROOT, dir, { recursive: true });
    return dir;
}

export function copyInvalidFixture(name = "research-invalid") {
    const dir = mkdtempSync(join(tmpdir(), `hex-${name}-`));
    cpSync(INVALID_FIXTURE_ROOT, dir, { recursive: true });
    return dir;
}

export function cleanup(dir) {
    closeAllStores();
    rmSync(dir, { recursive: true, force: true });
}

export function assertStructuredMirror(result) {
    assert.equal(result.content[0].text, JSON.stringify(result.structuredContent));
}

