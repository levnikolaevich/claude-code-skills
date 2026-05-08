import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { copyFixture, cleanup } from "./helpers.mjs";
import {
    analyzeProgress,
    findEvidence,
    findHypotheses,
    findRuns,
    indexHypotheses,
    inspectGoal,
    inspectHypothesis,
    traceGoalTree,
    traceLineage,
} from "../lib/tools.mjs";

function configureGitLf(dir) {
    execFileSync("git", ["-C", dir, "config", "core.autocrlf", "false"], { stdio: "ignore" });
    execFileSync("git", ["-C", dir, "config", "core.eol", "lf"], { stdio: "ignore" });
    execFileSync("git", ["-C", dir, "config", "core.safecrlf", "false"], { stdio: "ignore" });
}

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
            assert.ok(h01.hypothesis.evidence_depth.score >= 3.7);
            assert.ok(h01.sources.some(s => s.id === "source:rag-2024" && s.type === "paper"));
            assert.ok(h01.sources.some(s => s.id === "source:carver-2015" && s.type === "book"));

            const evidence = findEvidence({ path: dir, id: "H01" });
            assert.ok(evidence.evidence.some(e => e.ref === "R-target-h01"));

            const runs = findRuns({ path: dir, comprehensive: true });
            assert.equal(runs.runs[0].id, "R-comprehensive-g1");

            const goal = inspectGoal({ path: dir, id: "G1" });
            assert.ok(goal.hypotheses.some(h => h.id === "H01"));
            assert.equal(goal.goal.metrics_current.provenance.run_id, "R-comprehensive-g1");

            const lineage = traceLineage({ path: dir, id: "H03" });
            assert.ok(lineage.edges.some(e => e.kind === "parent_of"));

            const tree = traceGoalTree({ path: dir, id: "G1" });
            assert.ok(tree.goals.some(g => g.id === "G1.1"));
        } finally {
            cleanup(dir);
        }
    });

    it("reports field-level researchgraph deltas", () => {
        const dir = copyFixture("progress");
        try {
            execFileSync("git", ["-C", dir, "init"], { stdio: "ignore" });
            configureGitLf(dir);
            execFileSync("git", ["-C", dir, "config", "user.email", "test@example.com"], { stdio: "ignore" });
            execFileSync("git", ["-C", dir, "config", "user.name", "Test"], { stdio: "ignore" });
            execFileSync("git", ["-C", dir, "add", "."], { stdio: "ignore" });
            execFileSync("git", ["-C", dir, "commit", "-m", "fixture"], { stdio: "ignore" });
            const file = join(dir, "docs", "hypotheses", "H02.md");
            const text = readFileSync(file, "utf8").replace("status: pending_implementation", "status: in_progress");
            writeFileSync(file, text, "utf8");
            const progress = analyzeProgress({ path: dir });
            assert.equal(progress.status, "OK");
            assert.ok(progress.field_deltas.some(delta => delta.id === "H02" && delta.field === "status" && delta.old === "pending_implementation" && delta.new === "in_progress"));
        } finally {
            cleanup(dir);
        }
    });
});
