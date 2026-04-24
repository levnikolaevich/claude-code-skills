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

try {
    const manifestPath = join(projectRoot, "manifest.json");
    writeJson(manifestPath, {
        targets: ["both"],
        dry_run: false,
        plugins: ["agile-workflow", "codebase-audit-suite"],
        auto_install_providers: true,
        apply_ide_override: true,
    });

    const started = run(["start", "--project-root", projectRoot, "--identifier", "targets-both", "--manifest-file", manifestPath]);
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

    run(["checkpoint", "--project-root", projectRoot, "--identifier", "targets-both", "--phase", PHASES.CONFIG]);
    run(["advance", "--project-root", projectRoot, "--identifier", "targets-both", "--to", PHASES.ASSESS]);
    run(["checkpoint", "--project-root", projectRoot, "--identifier", "targets-both", "--phase", PHASES.ASSESS, "--payload", "{\"assess_summary\":{\"node\":true}}"]);
    run(["advance", "--project-root", projectRoot, "--identifier", "targets-both", "--to", PHASES.DISPATCH_PLAN]);
    run(["checkpoint", "--project-root", projectRoot, "--identifier", "targets-both", "--phase", PHASES.DISPATCH_PLAN, "--payload", "{\"dispatch_plan\":{\"workers_to_run\":[\"ln-011\",\"ln-013\"]}}"]);
    run(["advance", "--project-root", projectRoot, "--identifier", "targets-both", "--to", PHASES.WORKER_EXECUTION]);
    run(["record-worker", "--project-root", projectRoot, "--identifier", "targets-both", "--payload", JSON.stringify({ schema_version: "1.0", summary_kind: "env-agent-install", run_id: started.run_id, identifier: "targets-both", producer_skill: "ln-011", produced_at: "2026-03-26T00:00:00Z", payload: { status: WORKER_SUMMARY_STATUSES.COMPLETED, targets: ["codex"] } })]);
    run(["record-worker", "--project-root", projectRoot, "--identifier", "targets-both", "--payload", JSON.stringify({ schema_version: "1.0", summary_kind: "env-marketplace-align", run_id: started.run_id, identifier: "targets-both", producer_skill: "ln-013", produced_at: "2026-03-26T00:00:00Z", payload: { status: WORKER_SUMMARY_STATUSES.COMPLETED, targets: ["claude"] } })]);
    run(["checkpoint", "--project-root", projectRoot, "--identifier", "targets-both", "--phase", PHASES.WORKER_EXECUTION]);
    run(["advance", "--project-root", projectRoot, "--identifier", "targets-both", "--to", PHASES.VERIFY]);
    run(["checkpoint", "--project-root", projectRoot, "--identifier", "targets-both", "--phase", PHASES.VERIFY, "--payload", "{\"verification_summary\":{\"hooks\":\"ok\"}}"]);
    run(["advance", "--project-root", projectRoot, "--identifier", "targets-both", "--to", PHASES.WRITE_ENV_STATE]);
    run(["checkpoint", "--project-root", projectRoot, "--identifier", "targets-both", "--phase", PHASES.WRITE_ENV_STATE, "--payload", JSON.stringify({ env_state_written: true, final_result: ENVIRONMENT_SETUP_FINAL_RESULTS.READY })]);
    run(["advance", "--project-root", projectRoot, "--identifier", "targets-both", "--to", PHASES.SELF_CHECK]);
    run(["checkpoint", "--project-root", projectRoot, "--identifier", "targets-both", "--phase", PHASES.SELF_CHECK, "--payload", JSON.stringify({ pass: true, final_result: ENVIRONMENT_SETUP_FINAL_RESULTS.READY })]);
    const completed = run(["complete", "--project-root", projectRoot, "--identifier", "targets-both"]);

    if (!completed.ok || completed.state.phase !== PHASES.DONE) {
        throw new Error("Environment setup runtime did not complete");
    }

    process.stdout.write("environment-setup-runtime smoke passed\n");
} finally {
    rmSync(projectRoot, { recursive: true, force: true });
}
