import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { copyFixture, cleanup } from "./helpers.mjs";
import { indexHypotheses } from "../lib/tools.mjs";
import { getStore } from "../lib/store.mjs";

describe("indexing", () => {
    it("builds schema, FTS tables, synthetic nodes, and normalized tasks", () => {
        const dir = copyFixture("indexing");
        try {
            const indexed = indexHypotheses({ path: dir });
            assert.equal(indexed.status, "OK");
            assert.equal(indexed.summary.hypotheses, 7);
            assert.equal(indexed.summary.goals, 3);
            assert.equal(indexed.summary.runs, 2);

            const store = getStore(dir);
            assert.equal(store.one("SELECT count(*) AS count FROM hypotheses").count, 7);
            assert.equal(store.one("SELECT count(*) AS count FROM goals").count, 3);
            assert.equal(store.one("SELECT count(*) AS count FROM runs").count, 2);
            assert.ok(store.one("SELECT count(*) AS count FROM hypothesis_fts WHERE hypothesis_fts MATCH 'drift'").count > 0);
            assert.equal(store.one("SELECT count(*) AS count FROM nodes WHERE kind = 'task'").count, 6);
            assert.ok(store.one("SELECT count(*) AS count FROM edges WHERE kind = 'serves_goal'").count >= 6);
            assert.ok(store.one("SELECT count(*) AS count FROM sources").count >= 6);

            const targetRun = store.one("SELECT raw_manifest FROM runs WHERE id = 'R-target-h01'");
            assert.equal(JSON.parse(targetRun.raw_manifest).runner_environment.sdk, "opaque-runner-sdk");
        } finally {
            cleanup(dir);
        }
    });

    it("reports refine and non-refine drift invariants", () => {
        const dir = copyFixture("invariants");
        try {
            const indexed = indexHypotheses({ path: dir });
            const codes = indexed.warnings.map(w => `${w.id || ""}:${w.code}`);
            assert.ok(codes.includes("H04:status_verdict_drift"));
            assert.ok(codes.includes("H05:status_verdict_drift"));
            assert.ok(codes.includes("H06:implementation_gap"));
            assert.ok(!codes.includes("H03:implementation_gap"));
        } finally {
            cleanup(dir);
        }
    });
});

