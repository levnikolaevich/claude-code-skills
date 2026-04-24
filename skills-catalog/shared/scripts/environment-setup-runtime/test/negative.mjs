#!/usr/bin/env node

import { rmSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
    createJsonCliRunner,
    createProjectRoot,
    writeJson,
} from "../../coordinator-runtime/test/cli-test-helpers.mjs";
import { ENVIRONMENT_SETUP_FINAL_RESULTS } from "../../coordinator-runtime/lib/runtime-constants.mjs";
import { PHASES } from "../lib/phases.mjs";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const cliPath = join(__dirname, "..", "cli.mjs");
const projectRoot = createProjectRoot("environment-setup-runtime-negative-");
const run = createJsonCliRunner(cliPath, projectRoot);

try {
    const manifestPath = join(projectRoot, "manifest.json");
    writeJson(manifestPath, { targets: ["both"], dry_run: false });

    run(["start", "--project-root", projectRoot, "--identifier", "targets-both", "--manifest-file", manifestPath]);
    run(["checkpoint", "--project-root", projectRoot, "--identifier", "targets-both", "--phase", PHASES.CONFIG]);
    run(["advance", "--project-root", projectRoot, "--identifier", "targets-both", "--to", PHASES.ASSESS]);
    run(["checkpoint", "--project-root", projectRoot, "--identifier", "targets-both", "--phase", PHASES.ASSESS, "--payload", "{\"assess_summary\":{\"node\":true}}"]);
    run(["advance", "--project-root", projectRoot, "--identifier", "targets-both", "--to", PHASES.DISPATCH_PLAN]);
    run(["checkpoint", "--project-root", projectRoot, "--identifier", "targets-both", "--phase", PHASES.DISPATCH_PLAN, "--payload", "{}"]);
    const missingDispatch = run(["advance", "--project-root", projectRoot, "--identifier", "targets-both", "--to", PHASES.WORKER_EXECUTION], { allowFailure: true });
    if (missingDispatch.error !== "Dispatch plan missing") {
        throw new Error(`Expected dispatch plan failure, got: ${JSON.stringify(missingDispatch)}`);
    }

    const invalidWorker = run(["record-worker", "--project-root", projectRoot, "--identifier", "targets-both", "--payload", "{\"producer_skill\":\"ln-011\"}"], { allowFailure: true });
    if (!String(invalidWorker.error || "").includes("environment worker summary")) {
        throw new Error(`Expected invalid worker summary failure, got: ${JSON.stringify(invalidWorker)}`);
    }

    const dryRunManifestPath = join(projectRoot, "manifest-dry.json");
    writeJson(dryRunManifestPath, { targets: ["codex"], dry_run: true });
    run(["start", "--project-root", projectRoot, "--identifier", "targets-codex", "--manifest-file", dryRunManifestPath]);
    run(["checkpoint", "--project-root", projectRoot, "--identifier", "targets-codex", "--phase", PHASES.CONFIG]);
    run(["advance", "--project-root", projectRoot, "--identifier", "targets-codex", "--to", PHASES.ASSESS]);
    run(["checkpoint", "--project-root", projectRoot, "--identifier", "targets-codex", "--phase", PHASES.ASSESS, "--payload", "{\"assess_summary\":{\"node\":true}}"]);
    run(["advance", "--project-root", projectRoot, "--identifier", "targets-codex", "--to", PHASES.DISPATCH_PLAN]);
    run(["checkpoint", "--project-root", projectRoot, "--identifier", "targets-codex", "--phase", PHASES.DISPATCH_PLAN, "--payload", "{\"dispatch_plan\":{\"workers_to_run\":[]}}"]);
    run(["advance", "--project-root", projectRoot, "--identifier", "targets-codex", "--to", PHASES.WORKER_EXECUTION]);
    run(["checkpoint", "--project-root", projectRoot, "--identifier", "targets-codex", "--phase", PHASES.WORKER_EXECUTION]);
    run(["advance", "--project-root", projectRoot, "--identifier", "targets-codex", "--to", PHASES.VERIFY]);
    run(["checkpoint", "--project-root", projectRoot, "--identifier", "targets-codex", "--phase", PHASES.VERIFY, "--payload", "{\"verification_summary\":{\"status\":\"dry-run\"}}"]);
    run(["advance", "--project-root", projectRoot, "--identifier", "targets-codex", "--to", PHASES.WRITE_ENV_STATE]);
    run(["checkpoint", "--project-root", projectRoot, "--identifier", "targets-codex", "--phase", PHASES.WRITE_ENV_STATE, "--payload", JSON.stringify({ env_state_written: false, final_result: ENVIRONMENT_SETUP_FINAL_RESULTS.DRY_RUN_PLAN })]);
    run(["advance", "--project-root", projectRoot, "--identifier", "targets-codex", "--to", PHASES.SELF_CHECK]);
    run(["checkpoint", "--project-root", projectRoot, "--identifier", "targets-codex", "--phase", PHASES.SELF_CHECK, "--payload", JSON.stringify({ pass: true, final_result: ENVIRONMENT_SETUP_FINAL_RESULTS.DRY_RUN_PLAN })]);
    const completed = run(["complete", "--project-root", projectRoot, "--identifier", "targets-codex"]);
    if (!completed.ok || completed.state.final_result !== ENVIRONMENT_SETUP_FINAL_RESULTS.DRY_RUN_PLAN) {
        throw new Error("Dry-run environment setup should complete without env_state_written");
    }

    const secondManifestPath = join(projectRoot, "manifest-second.json");
    writeJson(secondManifestPath, { targets: ["claude"], dry_run: false });
    run(["start", "--project-root", projectRoot, "--identifier", "targets-claude", "--manifest-file", secondManifestPath]);
    const ambiguousStatus = run(["status", "--project-root", projectRoot], { allowFailure: true });
    if (!String(ambiguousStatus.error || "").includes("Multiple active ln-010 runs found")) {
        throw new Error(`Expected ambiguous status failure, got: ${JSON.stringify(ambiguousStatus)}`);
    }

    process.stdout.write("environment-setup-runtime negative passed\n");
} finally {
    rmSync(projectRoot, { recursive: true, force: true });
}
