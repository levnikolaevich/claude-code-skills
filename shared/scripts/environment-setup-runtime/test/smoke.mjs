#!/usr/bin/env node

import { rmSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
    createJsonCliRunner,
    createProjectRoot,
    writeJson,
} from "../../coordinator-runtime/test/cli-test-helpers.mjs";
import {
    ENVIRONMENT_SETUP_FINAL_RESULTS,
    WORKER_SUMMARY_STATUSES,
} from "../../coordinator-runtime/lib/runtime-constants.mjs";
import { PHASES } from "../lib/phases.mjs";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const cliPath = join(__dirname, "..", "cli.mjs");
const projectRoot = createProjectRoot("environment-setup-runtime-");
const run = createJsonCliRunner(cliPath, projectRoot);

const ID = "targets-both";
const P = "--project-root";
const I = "--identifier";

try {
    const manifestPath = join(projectRoot, "manifest.json");
    writeJson(manifestPath, {
        targets: ["both"],
        dry_run: false,
        plugins: ["agile-workflow", "codebase-audit-suite"],
        auto_install_providers: true,
        apply_ide_override: true,
    });

    const started = run(["start", P, projectRoot, I, ID, "--manifest-file", manifestPath]);
    if (!started.ok) {
        throw new Error("Failed to start environment setup runtime");
    }
    if (started.manifest.plugins.join(",") !== "agile-workflow,codebase-audit-suite") {
        throw new Error("Environment setup manifest did not preserve plugin selection");
    }
    if (started.manifest.auto_install_providers !== true || started.manifest.apply_ide_override !== true) {
        throw new Error("Environment setup manifest did not preserve pass-through flags");
    }
    if (started.manifest.worker_registry.includes("ln-015")) {
        throw new Error("ln-015 must remain standalone and outside default environment setup dispatch");
    }

    run(["checkpoint", P, projectRoot, I, ID, "--phase", PHASES.CONFIG]);
    run(["advance", P, projectRoot, I, ID, "--to", PHASES.ASSESS]);
    run(["checkpoint", P, projectRoot, I, ID, "--phase", PHASES.ASSESS, "--payload", "{\"assess_summary\":{\"node\":true}}"]);
    run(["advance", P, projectRoot, I, ID, "--to", PHASES.PROVIDER_SELECTION]);
    run(["checkpoint", P, projectRoot, I, ID, "--phase", PHASES.PROVIDER_SELECTION, "--payload", "{\"provider_selection\":{\"chosen\":\"file\",\"available\":[\"linear\",\"github\",\"file\"],\"reason\":\"user choice\",\"selected_by\":\"user\"}}"]);
    run(["advance", P, projectRoot, I, ID, "--to", PHASES.DISPATCH_PLAN]);
    run(["checkpoint", P, projectRoot, I, ID, "--phase", PHASES.DISPATCH_PLAN, "--payload", "{\"dispatch_plan\":{\"workers_to_run\":[\"ln-011\",\"ln-013\"]}}"]);
    run(["advance", P, projectRoot, I, ID, "--to", PHASES.WORKER_EXECUTION]);
    run(["record-worker", P, projectRoot, I, ID, "--payload", JSON.stringify({ schema_version: "1.0", summary_kind: "env-agent-install", run_id: started.run_id, identifier: ID, producer_skill: "ln-011", produced_at: "2026-03-26T00:00:00Z", payload: { status: WORKER_SUMMARY_STATUSES.COMPLETED, targets: ["codex"] } })]);
    run(["record-worker", P, projectRoot, I, ID, "--payload", JSON.stringify({ schema_version: "1.0", summary_kind: "env-marketplace-align", run_id: started.run_id, identifier: ID, producer_skill: "ln-013", produced_at: "2026-03-26T00:00:00Z", payload: { status: WORKER_SUMMARY_STATUSES.COMPLETED, targets: ["claude"] } })]);
    run(["checkpoint", P, projectRoot, I, ID, "--phase", PHASES.WORKER_EXECUTION]);
    run(["advance", P, projectRoot, I, ID, "--to", PHASES.VERIFY]);
    run(["checkpoint", P, projectRoot, I, ID, "--phase", PHASES.VERIFY, "--payload", "{\"verification_summary\":{\"hooks\":\"ok\"}}"]);
    run(["advance", P, projectRoot, I, ID, "--to", PHASES.WRITE_ENV_STATE]);
    run(["checkpoint", P, projectRoot, I, ID, "--phase", PHASES.WRITE_ENV_STATE, "--payload", JSON.stringify({ env_state_written: true, final_result: ENVIRONMENT_SETUP_FINAL_RESULTS.READY })]);
    run(["advance", P, projectRoot, I, ID, "--to", PHASES.SELF_CHECK]);
    run(["checkpoint", P, projectRoot, I, ID, "--phase", PHASES.SELF_CHECK, "--payload", JSON.stringify({ pass: true, final_result: ENVIRONMENT_SETUP_FINAL_RESULTS.READY })]);
    const completed = run(["complete", P, projectRoot, I, ID]);

    if (!completed.ok || completed.state.phase !== PHASES.DONE) {
        throw new Error("Environment setup runtime did not complete");
    }
    if (completed.state.provider_selection?.chosen !== "file") {
        throw new Error("provider_selection.chosen was not persisted to final state");
    }

    process.stdout.write("environment-setup-runtime smoke passed\n");
} finally {
    rmSync(projectRoot, { recursive: true, force: true });
}
