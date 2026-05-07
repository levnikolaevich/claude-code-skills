#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { PHASES } from "../lib/phases.mjs";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const cliPath = join(__dirname, "..", "cli.mjs");
const projectRoot = mkdtempSync(join(tmpdir(), "quality-runtime-"));
const manifestPath = join(projectRoot, "manifest.json");

writeFileSync(manifestPath, JSON.stringify({ fast_track: false }, null, 2));

function run(args) {
    return JSON.parse(execFileSync("node", [cliPath, ...args], {
        cwd: projectRoot,
        encoding: "utf8",
    }));
}

function summary(worker, verdict) {
    return JSON.stringify({
        schema_version: "1.0.0",
        summary_kind: "quality-worker",
        run_id: "quality-runtime-test",
        identifier: "PROJ-123",
        producer_skill: worker,
        produced_at: "2026-03-27T00:00:00Z",
        payload: {
            worker,
            status: "completed",
            verdict,
            issues: [],
            warnings: [],
        },
    });
}

try {
    const started = run(["start", "--story", "PROJ-123", "--manifest-file", manifestPath]);
    if (!started.ok) {
        throw new Error("Failed to start quality runtime");
    }
    run(["checkpoint", "--story", "PROJ-123", "--phase", PHASES.CONFIG, "--payload", "{\"config_ready\":true}"]);
    run(["advance", "--story", "PROJ-123", "--to", PHASES.DISCOVERY]);
    run(["checkpoint", "--story", "PROJ-123", "--phase", PHASES.DISCOVERY, "--payload", "{\"discovery_ready\":true}"]);
    run(["advance", "--story", "PROJ-123", "--to", PHASES.CODE_QUALITY]);
    run(["record-worker", "--story", "PROJ-123", "--payload", summary("ln-511", "PASS")]);
    run(["checkpoint", "--story", "PROJ-123", "--phase", PHASES.CODE_QUALITY, "--payload", "{\"quality_checked\":true}"]);
    run(["advance", "--story", "PROJ-123", "--to", PHASES.CLEANUP]);
    run(["checkpoint", "--story", "PROJ-123", "--phase", PHASES.CLEANUP, "--payload", "{\"cleanup_status\":\"completed\"}"]);
    run(["record-worker", "--story", "PROJ-123", "--payload", summary("ln-512", "PASS")]);
    run(["advance", "--story", "PROJ-123", "--to", PHASES.AGENT_REVIEW]);
    run(["checkpoint", "--story", "PROJ-123", "--phase", PHASES.AGENT_REVIEW, "--payload", "{\"review_summary\":{\"status\":\"completed\"}}"]);
    run(["advance", "--story", "PROJ-123", "--to", PHASES.CRITERIA]);
    run(["checkpoint", "--story", "PROJ-123", "--phase", PHASES.CRITERIA, "--payload", "{\"criteria_summary\":{\"status\":\"completed\"}}"]);
    run(["advance", "--story", "PROJ-123", "--to", PHASES.LINTERS]);
    run(["checkpoint", "--story", "PROJ-123", "--phase", PHASES.LINTERS, "--payload", "{\"linters_summary\":{\"status\":\"completed\"}}"]);
    run(["advance", "--story", "PROJ-123", "--to", PHASES.REGRESSION]);
    run(["record-worker", "--story", "PROJ-123", "--payload", summary("ln-513", "PASS")]);
    run(["checkpoint", "--story", "PROJ-123", "--phase", PHASES.REGRESSION, "--payload", "{\"regression_status\":\"PASS\"}"]);
    run(["advance", "--story", "PROJ-123", "--to", PHASES.LOG_ANALYSIS]);
    run(["record-worker", "--story", "PROJ-123", "--payload", summary("ln-514", "PASS")]);
    run(["checkpoint", "--story", "PROJ-123", "--phase", PHASES.LOG_ANALYSIS, "--payload", "{\"logs_status\":\"clean\"}"]);
    run(["advance", "--story", "PROJ-123", "--to", PHASES.FINALIZE]);
    run(["checkpoint", "--story", "PROJ-123", "--phase", PHASES.FINALIZE, "--payload", "{\"quality_verdict\":\"PASS\",\"quality_score\":92,\"aggregated_issues\":[],\"final_result\":\"PASS\"}"]);
    run(["advance", "--story", "PROJ-123", "--to", PHASES.SELF_CHECK]);
    run(["checkpoint", "--story", "PROJ-123", "--phase", PHASES.SELF_CHECK, "--payload", "{\"pass\":true,\"final_result\":\"PASS\"}"]);
    const completed = run(["complete", "--story", "PROJ-123"]);
    if (!completed.ok || completed.state.phase !== "DONE") {
        throw new Error("Quality runtime did not complete");
    }
    process.stdout.write("quality-runtime smoke passed\n");
} finally {
    rmSync(projectRoot, { recursive: true, force: true });
}
