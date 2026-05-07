#!/usr/bin/env node
// SOURCE-OF-TRUTH: shared/scripts/environment-worker-runtime/test/smoke.mjs. Edit ONLY here; run `node tools/marketplace/shared.mjs sync`

import { existsSync, rmSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
    createJsonCliRunner,
    createProjectRoot,
    readJson,
    writeJson,
} from "../../coordinator-runtime/test/cli-test-helpers.mjs";
import { WORKER_SUMMARY_STATUSES } from "../../coordinator-runtime/lib/runtime-constants.mjs";
import { WORKER_PHASES } from "../lib/phases.mjs";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const cliPath = join(__dirname, "..", "cli.mjs");
const projectRoot = createProjectRoot("environment-worker-runtime-");
const run = createJsonCliRunner(cliPath, projectRoot);

function workerSummary(runId, skill, identifier, summaryKind, targets = []) {
    return {
        schema_version: "1.0.0",
        summary_kind: summaryKind,
        run_id: runId,
        identifier,
        producer_skill: skill,
        produced_at: "2026-04-10T00:00:00Z",
        payload: {
            status: WORKER_SUMMARY_STATUSES.COMPLETED,
            targets,
            changes: ["ok"],
            warnings: [],
            detail: "done",
        },
    };
}

try {
    const standaloneManifestPath = join(projectRoot, "manifest-standalone.json");
    writeJson(standaloneManifestPath, { targets: ["both"], dry_run: false, plugins: ["agile-workflow"], auto_install_providers: true });
    const started = run(["start", "--project-root", projectRoot, "--skill", "ln-011", "--identifier", "targets-both", "--manifest-file", standaloneManifestPath]);
    if (started.manifest.plugins.join(",") !== "agile-workflow" || started.manifest.auto_install_providers !== true) {
        throw new Error("Environment worker manifest did not preserve plugin/provider pass-through fields");
    }
    const runId = started.run_id;
    const phases = WORKER_PHASES["ln-011"];
    for (const phase of phases) {
        const payload = phase.endsWith("SELF_CHECK")
            ? { pass: true, final_result: "READY" }
            : {};
        run(["checkpoint", "--project-root", projectRoot, "--skill", "ln-011", "--run-id", runId, "--phase", phase, "--payload", JSON.stringify(payload)]);
        if (phase !== phases.at(-1)) {
            const nextPhase = phases[phases.indexOf(phase) + 1];
            run(["advance", "--project-root", projectRoot, "--skill", "ln-011", "--run-id", runId, "--to", nextPhase]);
        }
    }
    const recorded = run([
        "record-summary", "--project-root", projectRoot, "--skill", "ln-011", "--run-id", runId,
        "--payload", JSON.stringify(workerSummary(runId, "ln-011", "targets-both", "env-agent-install", ["both"])),
    ]);
    if (!recorded.ok || !recorded.artifact_path || !existsSync(recorded.artifact_path)) {
        throw new Error("Standalone environment worker summary was not written");
    }
    const completed = run(["complete", "--project-root", projectRoot, "--skill", "ln-011", "--run-id", runId]);
    if (!completed.ok || completed.state.phase !== "DONE") {
        throw new Error("Standalone environment worker runtime did not complete");
    }

    const managedSummaryPath = join(projectRoot, "managed", "ln-015.json");
    const managedManifestPath = join(projectRoot, "manifest-managed.json");
    writeJson(managedManifestPath, {});
    const managed = run([
        "start", "--project-root", projectRoot, "--skill", "ln-015", "--identifier", "cleanup-global",
        "--manifest-file", managedManifestPath, "--run-id", "ln-015-managed-run", "--summary-artifact-path", managedSummaryPath,
    ]);
    if (!managed.ok) {
        throw new Error("Managed environment worker runtime failed to start");
    }
    const managedPhases = WORKER_PHASES["ln-015"];
    for (const phase of managedPhases) {
        const payload = phase.endsWith("SELF_CHECK")
            ? { pass: true, final_result: "CLEANED" }
            : {};
        run(["checkpoint", "--project-root", projectRoot, "--skill", "ln-015", "--run-id", "ln-015-managed-run", "--phase", phase, "--payload", JSON.stringify(payload)]);
        if (phase !== managedPhases.at(-1)) {
            const nextPhase = managedPhases[managedPhases.indexOf(phase) + 1];
            run(["advance", "--project-root", projectRoot, "--skill", "ln-015", "--run-id", "ln-015-managed-run", "--to", nextPhase]);
        }
    }
    run([
        "record-summary", "--project-root", projectRoot, "--skill", "ln-015", "--run-id", "ln-015-managed-run",
        "--payload", JSON.stringify(workerSummary("ln-015-managed-run", "ln-015", "cleanup-global", "env-cleanup")),
    ]);
    if (!existsSync(managedSummaryPath)) {
        throw new Error("Managed summary artifact path was not written");
    }
    const managedJson = readJson(managedSummaryPath);
    if (managedJson.summary_kind !== "env-cleanup") {
        throw new Error("Managed cleanup summary kind mismatch");
    }
    run(["complete", "--project-root", projectRoot, "--skill", "ln-015", "--run-id", "ln-015-managed-run"]);

    process.stdout.write("environment-worker-runtime smoke passed\n");
} finally {
    rmSync(projectRoot, { recursive: true, force: true });
}
