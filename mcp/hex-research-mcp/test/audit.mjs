import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { copyFixture, cleanup } from "./helpers.mjs";
import { auditGoalAlignment, auditOrphans, indexHypotheses } from "../lib/tools.mjs";

describe("audits", () => {
    it("surfaces orphan, drift, task, source, stale, and goal-run categories", () => {
        const dir = copyFixture("audit");
        try {
            indexHypotheses({ path: dir });
            const audit = auditOrphans({ path: dir });
            const categories = new Set(audit.summary.categories);
            for (const category of [
                "missing_goal",
                "missing_source",
                "status_verdict_drift",
                "implementation_gap",
                "task_status_stale",
                "stale_hypothesis",
                "missing_goal_run",
            ]) {
                assert.ok(categories.has(category), `expected ${category}`);
            }
        } finally {
            cleanup(dir);
        }
    });

    it("audits goal alignment", () => {
        const dir = copyFixture("goal-audit");
        try {
            indexHypotheses({ path: dir });
            const audit = auditGoalAlignment({ path: dir });
            assert.equal(audit.status, "STALE");
            assert.ok(audit.summary.categories.includes("goal_without_hypotheses"));
            assert.ok(audit.summary.categories.includes("missing_goal"));
        } finally {
            cleanup(dir);
        }
    });
});

