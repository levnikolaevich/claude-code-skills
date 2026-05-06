#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { PHASES } from "../lib/phases.mjs";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const cliPath = join(__dirname, "..", "cli.mjs");
const projectRoot = mkdtempSync(join(tmpdir(), "docs-runtime-"));
const manifestPath = join(projectRoot, "manifest.json");

writeFileSync(manifestPath, JSON.stringify({
    expected_workers: ["ln-111", "ln-112"],
}, null, 2));

function run(args) {
    return JSON.parse(execFileSync("node", [cliPath, ...args], {
        cwd: projectRoot,
        encoding: "utf8",
    }));
}

function summary(worker, createdFiles) {
    return JSON.stringify({
        schema_version: "1.0.0",
        summary_kind: "docs-generation",
        run_id: "docs-runtime-test",
        identifier: "project-docs",
        producer_skill: worker,
        produced_at: "2026-03-27T00:00:00Z",
        payload: {
            worker,
            status: "completed",
            created_files: createdFiles,
            skipped_files: [],
            quality_inputs: { doc_paths: createdFiles },
            validation_status: "passed",
            warnings: [],
        },
    });
}

try {
    const started = run(["start", "--identifier", "project-docs", "--manifest-file", manifestPath]);
    if (!started.ok) {
        throw new Error("Failed to start docs runtime");
    }
    run(["checkpoint", "--identifier", "project-docs", "--phase", PHASES.CONFIG, "--payload", "{\"config_ready\":true}"]);
    run(["advance", "--identifier", "project-docs", "--to", PHASES.CONTEXT_ASSEMBLY]);
    run(["checkpoint", "--identifier", "project-docs", "--phase", PHASES.CONTEXT_ASSEMBLY, "--payload", "{\"context_ready\":true}"]);
    run(["advance", "--identifier", "project-docs", "--to", PHASES.DETECTION]);
    run(["checkpoint", "--identifier", "project-docs", "--phase", PHASES.DETECTION, "--payload", "{\"detected_flags\":{\"hasBackend\":true}}"]);
    run(["advance", "--identifier", "project-docs", "--to", PHASES.DELEGATE]);
    run(["record-worker", "--identifier", "project-docs", "--payload", summary("ln-111", ["AGENTS.md"])]);
    run(["record-worker", "--identifier", "project-docs", "--payload", summary("ln-112", ["docs/project/architecture.md"])]);
    run(["checkpoint", "--identifier", "project-docs", "--phase", PHASES.DELEGATE, "--payload", "{\"delegated\":true}"]);
    run(["advance", "--identifier", "project-docs", "--to", PHASES.AGGREGATE]);
    run(["checkpoint", "--identifier", "project-docs", "--phase", PHASES.AGGREGATE, "--payload", "{\"quality_inputs\":{\"doc_paths\":[\"AGENTS.md\",\"docs/project/architecture.md\"]},\"final_result\":\"READY\"}"]);
    run(["advance", "--identifier", "project-docs", "--to", PHASES.SELF_CHECK]);
    run(["checkpoint", "--identifier", "project-docs", "--phase", PHASES.SELF_CHECK, "--payload", "{\"pass\":true,\"final_result\":\"READY\"}"]);
    const completed = run(["complete", "--identifier", "project-docs"]);
    if (!completed.ok || completed.state.phase !== "DONE") {
        throw new Error("Docs runtime did not complete");
    }
    process.stdout.write("docs-runtime smoke passed\n");
} finally {
    rmSync(projectRoot, { recursive: true, force: true });
}
