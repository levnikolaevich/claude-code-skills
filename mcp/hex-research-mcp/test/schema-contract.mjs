import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { copyFixture, copyInvalidFixture, cleanup, PACKAGE_ROOT } from "./helpers.mjs";
import { indexHypotheses, verifyIndex } from "../lib/tools.mjs";
import { researchResult } from "../lib/result.mjs";

describe("schema and result contract", () => {
    it("mirrors structuredContent into text", () => {
        const response = researchResult({ status: "OK", reason: "contract", summary: { ok: true } });
        assert.deepEqual(JSON.parse(response.content[0].text), response.structuredContent);
        assert.equal(response.isError, undefined);
    });

    it("index_hypotheses marks INVALID as tool error but verify_index keeps diagnostics non-error", () => {
        const dir = copyInvalidFixture("invalid");
        try {
            const indexed = indexHypotheses({ path: dir });
            const indexedResult = researchResult(indexed, { isError: ["INVALID", "UNSUPPORTED"].includes(indexed.status) });
            assert.equal(indexed.status, "INVALID");
            assert.equal(indexedResult.isError, true);

            const verified = verifyIndex({ path: dir });
            const verifiedResult = researchResult(verified, { isError: false });
            assert.equal(verified.status, "INVALID");
            assert.equal(verifiedResult.isError, undefined);
            assert.ok(verified.warnings.some(w => w.code === "missing_required_field"));
        } finally {
            cleanup(dir);
        }
    });

    it("wire warnings use lowercase snake_case codes", () => {
        const dir = copyFixture("wire");
        try {
            const indexed = indexHypotheses({ path: dir });
            assert.ok(indexed.warnings.length > 0);
            for (const warning of indexed.warnings) {
                assert.match(warning.code, /^[a-z][a-z0-9_]*$/);
            }
        } finally {
            cleanup(dir);
        }
    });

    it("strict validation CLI exits non-zero for invalid graph inputs", () => {
        const dir = copyInvalidFixture("invalid-cli");
        try {
            const result = spawnSync(process.execPath, [join("bin", "hex-research-validate.mjs"), "--strict", "--path", dir, "--json"], {
                cwd: PACKAGE_ROOT,
                encoding: "utf8",
            });
            assert.notEqual(result.status, 0);
            const payload = JSON.parse(result.stdout);
            assert.equal(payload.status, "INVALID");
        } finally {
            cleanup(dir);
        }
    });
});
