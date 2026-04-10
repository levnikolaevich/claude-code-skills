#!/usr/bin/env node

import { rmSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
    createJsonCliRunner,
    createProjectRoot,
    writeJson,
} from "../../coordinator-runtime/test/cli-test-helpers.mjs";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const cliPath = join(__dirname, "..", "cli.mjs");
const projectRoot = createProjectRoot("environment-worker-runtime-negative-");
const run = createJsonCliRunner(cliPath, projectRoot);

try {
    const badManagedManifest = join(projectRoot, "manifest-bad-managed.json");
    writeJson(badManagedManifest, {});
    const managedMissingPair = run([
        "start", "--project-root", projectRoot, "--skill", "ln-011", "--identifier", "targets-both",
        "--manifest-file", badManagedManifest, "--run-id", "managed-only",
    ], { allowFailure: true });
    if (!String(managedMissingPair.error || "").includes("both --run-id and --summary-artifact-path")) {
        throw new Error(`Expected managed pair failure, got: ${JSON.stringify(managedMissingPair)}`);
    }

    const manifestPath = join(projectRoot, "manifest.json");
    writeJson(manifestPath, {});
    const started = run(["start", "--project-root", projectRoot, "--skill", "ln-012", "--identifier", "mcp-global", "--manifest-file", manifestPath]);
    run(["checkpoint", "--project-root", projectRoot, "--skill", "ln-012", "--run-id", started.run_id, "--phase", "PHASE_0_CONFIG", "--payload", "{}"]);
    const wrongSummaryKind = run([
        "record-summary", "--project-root", projectRoot, "--skill", "ln-012", "--run-id", started.run_id,
        "--payload", JSON.stringify({
            schema_version: "1.0.0",
            summary_kind: "env-config-sync",
            run_id: started.run_id,
            identifier: "mcp-global",
            producer_skill: "ln-012",
            produced_at: "2026-04-10T00:00:00Z",
            payload: { status: "completed", targets: [], changes: [], warnings: [], detail: "bad" },
        }),
    ], { allowFailure: true });
    if (!String(wrongSummaryKind.error || "").includes("env-mcp-config")) {
        throw new Error(`Expected summary kind failure, got: ${JSON.stringify(wrongSummaryKind)}`);
    }

    const firstStarted = run(["start", "--project-root", projectRoot, "--skill", "ln-013", "--identifier", "targets-gemini", "--manifest-file", manifestPath]);
    const secondStarted = run(["start", "--project-root", projectRoot, "--skill", "ln-013", "--identifier", "targets-codex", "--manifest-file", manifestPath]);
    const ambiguousStatus = run(["status", "--project-root", projectRoot, "--skill", "ln-013"], { allowFailure: true });
    if (!String(ambiguousStatus.error || "").includes("Multiple active ln-013 runs found")) {
        throw new Error(`Expected ambiguous status failure, got: ${JSON.stringify(ambiguousStatus)}`);
    }

    if (!firstStarted.ok || !secondStarted.ok) {
        throw new Error("Environment worker runtimes for ambiguous-status test did not start");
    }

    process.stdout.write("environment-worker-runtime negative passed\n");
} finally {
    rmSync(projectRoot, { recursive: true, force: true });
}
