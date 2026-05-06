#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { PHASES } from "../lib/phases.mjs";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const cliPath = join(__dirname, "..", "cli.mjs");
const projectRoot = mkdtempSync(join(tmpdir(), "test-planning-runtime-"));
const manifestPath = join(projectRoot, "manifest.json");

writeFileSync(manifestPath, JSON.stringify({ simplified: false }, null, 2));

function run(args) {
    return JSON.parse(execFileSync("node", [cliPath, ...args], {
        cwd: projectRoot,
        encoding: "utf8",
    }));
}

function summary(worker, extra = {}) {
    return JSON.stringify({
        schema_version: "1.0.0",
        summary_kind: "test-planning-worker",
        run_id: "test-planning-runtime-test",
        identifier: "PROJ-123",
        producer_skill: worker,
        produced_at: "2026-03-27T00:00:00Z",
        payload: {
            worker,
            status: "completed",
            warnings: [],
            planned_scenarios: [],
            ...extra,
        },
    });
}

try {
    const started = run(["start", "--story", "PROJ-123", "--manifest-file", manifestPath]);
    if (!started.ok) {
        throw new Error("Failed to start test-planning runtime");
    }
    run(["checkpoint", "--story", "PROJ-123", "--phase", PHASES.CONFIG, "--payload", "{\"config_ready\":true}"]);
    run(["advance", "--story", "PROJ-123", "--to", PHASES.DISCOVERY]);
    run(["checkpoint", "--story", "PROJ-123", "--phase", PHASES.DISCOVERY, "--payload", "{\"discovery_ready\":true}"]);
    run(["advance", "--story", "PROJ-123", "--to", PHASES.RESEARCH]);
    run(["record-worker", "--story", "PROJ-123", "--payload", summary("ln-521", { research_comment_path: "comment.md" })]);
    run(["checkpoint", "--story", "PROJ-123", "--phase", PHASES.RESEARCH, "--payload", "{\"research_status\":\"completed\"}"]);
    run(["advance", "--story", "PROJ-123", "--to", PHASES.MANUAL_TESTING]);
    run(["record-worker", "--story", "PROJ-123", "--payload", summary("ln-522", { manual_result_path: "manual.md" })]);
    run(["checkpoint", "--story", "PROJ-123", "--phase", PHASES.MANUAL_TESTING, "--payload", "{\"manual_status\":\"passed\"}"]);
    run(["advance", "--story", "PROJ-123", "--to", PHASES.AUTO_TEST_PLANNING]);
    run(["record-worker", "--story", "PROJ-123", "--payload", summary("ln-523", { test_task_id: "TASK-1", test_task_url: "http://example.test/TASK-1", coverage_summary: "E2E + unit" })]);
    run(["checkpoint", "--story", "PROJ-123", "--phase", PHASES.AUTO_TEST_PLANNING, "--payload", "{\"planner_status\":\"completed\"}"]);
    run(["advance", "--story", "PROJ-123", "--to", PHASES.FINALIZE]);
    run(["checkpoint", "--story", "PROJ-123", "--phase", PHASES.FINALIZE, "--payload", "{\"test_task_id\":\"TASK-1\",\"test_task_url\":\"http://example.test/TASK-1\",\"coverage_summary\":\"E2E + unit\",\"final_result\":\"READY\"}"]);
    run(["advance", "--story", "PROJ-123", "--to", PHASES.SELF_CHECK]);
    run(["checkpoint", "--story", "PROJ-123", "--phase", PHASES.SELF_CHECK, "--payload", "{\"pass\":true,\"final_result\":\"READY\"}"]);
    const completed = run(["complete", "--story", "PROJ-123"]);
    if (!completed.ok || completed.state.phase !== "DONE") {
        throw new Error("Test-planning runtime did not complete");
    }
    process.stdout.write("test-planning-runtime smoke passed\n");
} finally {
    rmSync(projectRoot, { recursive: true, force: true });
}
