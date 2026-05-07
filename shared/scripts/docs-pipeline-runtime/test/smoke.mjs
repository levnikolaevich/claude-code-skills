#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { PHASES } from "../lib/phases.mjs";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const cliPath = join(__dirname, "..", "cli.mjs");
const projectRoot = mkdtempSync(join(tmpdir(), "docs-pipeline-runtime-"));
const manifestPath = join(projectRoot, "manifest.json");

writeFileSync(manifestPath, JSON.stringify({ auto_approve: true }, null, 2));

function run(args) {
    return JSON.parse(execFileSync("node", [cliPath, ...args], {
        cwd: projectRoot,
        encoding: "utf8",
    }));
}

function component(worker) {
    return JSON.stringify({
        schema_version: "1.0.0",
        summary_kind: "docs-generation",
        run_id: "docs-pipeline-runtime-test",
        identifier: "docs-pipeline",
        producer_skill: worker,
        produced_at: "2026-03-27T00:00:00Z",
        payload: {
            worker,
            status: "completed",
            created_files: ["docs/README.md"],
            skipped_files: [],
            quality_inputs: { doc_paths: ["docs/README.md"] },
            validation_status: "passed",
            warnings: [],
        },
    });
}

try {
    const started = run(["start", "--identifier", "docs-pipeline", "--manifest-file", manifestPath]);
    if (!started.ok) {
        throw new Error("Failed to start docs-pipeline runtime");
    }
    run(["checkpoint", "--identifier", "docs-pipeline", "--phase", PHASES.CONFIG, "--payload", "{\"config_ready\":true}"]);
    run(["advance", "--identifier", "docs-pipeline", "--to", PHASES.SOURCE_SCAN]);
    run(["checkpoint", "--identifier", "docs-pipeline", "--phase", PHASES.SOURCE_SCAN, "--payload", "{\"source_manifest\":[]}"]);
    run(["advance", "--identifier", "docs-pipeline", "--to", PHASES.CONFIRMATION]);
    run(["checkpoint", "--identifier", "docs-pipeline", "--phase", PHASES.CONFIRMATION, "--payload", "{\"source_mode\":\"skip\"}"]);
    run(["advance", "--identifier", "docs-pipeline", "--to", PHASES.DELEGATE]);
    run(["record-component", "--identifier", "docs-pipeline", "--payload", component("ln-110")]);
    run(["checkpoint", "--identifier", "docs-pipeline", "--phase", PHASES.DELEGATE, "--payload", "{\"delegated\":true}"]);
    run(["advance", "--identifier", "docs-pipeline", "--to", PHASES.QUALITY_GATE]);
    run(["checkpoint", "--identifier", "docs-pipeline", "--phase", PHASES.QUALITY_GATE, "--payload", "{\"quality_summary\":{\"status\":\"passed\"},\"quality_gate_passed\":true}"]);
    run(["advance", "--identifier", "docs-pipeline", "--to", PHASES.CLEANUP]);
    run(["checkpoint", "--identifier", "docs-pipeline", "--phase", PHASES.CLEANUP, "--payload", "{\"cleanup_summary\":{\"status\":\"completed\"},\"final_result\":\"READY\"}"]);
    run(["advance", "--identifier", "docs-pipeline", "--to", PHASES.SELF_CHECK]);
    run(["checkpoint", "--identifier", "docs-pipeline", "--phase", PHASES.SELF_CHECK, "--payload", "{\"pass\":true,\"final_result\":\"READY\"}"]);
    const completed = run(["complete", "--identifier", "docs-pipeline"]);
    if (!completed.ok || completed.state.phase !== "DONE") {
        throw new Error("Docs-pipeline runtime did not complete");
    }
    process.stdout.write("docs-pipeline-runtime smoke passed\n");
} finally {
    rmSync(projectRoot, { recursive: true, force: true });
}
