import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { copyFixture, cleanup } from "./helpers.mjs";
import {
    findEvidence,
    findHypotheses,
    findRuns,
    indexHypotheses,
    inspectGoal,
    inspectHypothesis,
    traceGoalTree,
    traceLineage,
} from "../lib/tools.mjs";

describe("query tools", () => {
    it("answers acceptance queries for statuses, tasks, sources, goals, and lineage", () => {
        const dir = copyFixture("tools");
        try {
            indexHypotheses({ path: dir });
            assert.equal(findHypotheses({ path: dir, status: "live" }).hypotheses[0].id, "H01");
            assert.equal(findHypotheses({ path: dir, status: "pending_implementation" }).hypotheses[0].id, "H02");
            assert.ok(findHypotheses({ path: dir, task_state: "open" }).hypotheses.some(h => h.id === "H02"));
            assert.ok(findHypotheses({ path: dir, cited_source_type: "paper", cited_source_year_min: 2024 }).hypotheses.some(h => h.id === "H01"));

            const h01 = inspectHypothesis({ path: dir, id: "H01" });
            assert.equal(h01.status, "OK");
            assert.equal(h01.tasks[0].state, "done");

            const evidence = findEvidence({ path: dir, id: "H01" });
            assert.ok(evidence.evidence.some(e => e.ref === "R-target-h01"));

            const runs = findRuns({ path: dir, comprehensive: true });
            assert.equal(runs.runs[0].id, "R-comprehensive-g1");

            const goal = inspectGoal({ path: dir, id: "G1" });
            assert.ok(goal.hypotheses.some(h => h.id === "H01"));

            const lineage = traceLineage({ path: dir, id: "H03" });
            assert.ok(lineage.edges.some(e => e.kind === "parent_of"));

            const tree = traceGoalTree({ path: dir, id: "G1" });
            assert.ok(tree.goals.some(g => g.id === "G1.1"));
        } finally {
            cleanup(dir);
        }
    });
});

