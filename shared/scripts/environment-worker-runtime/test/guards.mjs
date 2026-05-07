#!/usr/bin/env node
// SOURCE-OF-TRUTH: shared/scripts/environment-worker-runtime/test/guards.mjs. Edit ONLY here; run `node tools/marketplace/shared.mjs sync`

import { rmSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
    createJsonCliRunner,
    createProjectRoot,
    writeJson,
} from "../../coordinator-runtime/test/cli-test-helpers.mjs";
import { WORKER_SUMMARY_STATUSES } from "../../coordinator-runtime/lib/runtime-constants.mjs";
import { WORKER_PHASES } from "../lib/phases.mjs";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const cliPath = join(__dirname, "..", "cli.mjs");
const projectRoot = createProjectRoot("environment-worker-runtime-guards-");
const run = createJsonCliRunner(cliPath, projectRoot);

function summary(runId) {
    return {
        schema_version: "1.0.0",
        summary_kind: "env-instructions",
        run_id: runId,
        identifier: "instructions-global",
        producer_skill: "ln-014",
        produced_at: "2026-04-10T00:00:00Z",
        payload: {
            status: WORKER_SUMMARY_STATUSES.COMPLETED,
            targets: [],
            changes: [],
            warnings: [],
            detail: "ok",
        },
    };
}

try {
    const manifestPath = join(projectRoot, "manifest.json");
    writeJson(manifestPath, {});
    const started = run(["start", "--project-root", projectRoot, "--skill", "ln-014", "--identifier", "instructions-global", "--manifest-file", manifestPath]);
    const runId = started.run_id;
    const phases = WORKER_PHASES["ln-014"];

    run(["checkpoint", "--project-root", projectRoot, "--skill", "ln-014", "--run-id", runId, "--phase", phases[0], "--payload", "{}"]);
    run(["advance", "--project-root", projectRoot, "--skill", "ln-014", "--run-id", runId, "--to", phases[1]]);

    const missingCheckpoint = run(["advance", "--project-root", projectRoot, "--skill", "ln-014", "--run-id", runId, "--to", phases[2]], { allowFailure: true });
    if (!String(missingCheckpoint.error || "").includes(`Checkpoint missing for ${phases[1]}`)) {
        throw new Error(`Expected checkpoint guard failure, got: ${JSON.stringify(missingCheckpoint)}`);
    }

    for (let i = 1; i < phases.length; i += 1) {
        const phase = phases[i];
        const payload = phase.endsWith("SELF_CHECK")
            ? { pass: true, final_result: "ALIGNED" }
            : {};
        run(["checkpoint", "--project-root", projectRoot, "--skill", "ln-014", "--run-id", runId, "--phase", phase, "--payload", JSON.stringify(payload)]);
        if (phase !== phases.at(-1)) {
            run(["advance", "--project-root", projectRoot, "--skill", "ln-014", "--run-id", runId, "--to", phases[i + 1]]);
        }
    }

    const noSummaryDone = run(["complete", "--project-root", projectRoot, "--skill", "ln-014", "--run-id", runId], { allowFailure: true });
    if (!String(noSummaryDone.error || "").includes("Worker summary must be recorded before completion")) {
        throw new Error(`Expected summary guard failure, got: ${JSON.stringify(noSummaryDone)}`);
    }

    run(["record-summary", "--project-root", projectRoot, "--skill", "ln-014", "--run-id", runId, "--payload", JSON.stringify(summary(runId))]);
    const completed = run(["complete", "--project-root", projectRoot, "--skill", "ln-014", "--run-id", runId]);
    if (!completed.ok || completed.state.phase !== "DONE") {
        throw new Error("Environment worker runtime should complete after summary + self-check");
    }

    process.stdout.write("environment-worker-runtime guards passed\n");
} finally {
    rmSync(projectRoot, { recursive: true, force: true });
}
