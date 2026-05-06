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

const P = "--project-root";
const I = "--identifier";

try {
    // Scenario 1: skipping Phase 1b -> DISPATCH_PLAN must fail
    const manifestPath = join(projectRoot, "manifest.json");
    writeJson(manifestPath, { targets: ["both"], dry_run: false });

    run(["start", P, projectRoot, I, "targets-both", "--manifest-file", manifestPath]);
    run(["checkpoint", P, projectRoot, I, "targets-both", "--phase", PHASES.CONFIG]);
    run(["advance", P, projectRoot, I, "targets-both", "--to", PHASES.ASSESS]);
    run(["checkpoint", P, projectRoot, I, "targets-both", "--phase", PHASES.ASSESS, "--payload", "{\"assess_summary\":{\"node\":true}}"]);

    // Skipping PROVIDER_SELECTION (try ASSESS -> DISPATCH_PLAN directly)
    const directDispatch = run(["advance", P, projectRoot, I, "targets-both", "--to", PHASES.DISPATCH_PLAN], { allowFailure: true });
    if (!String(directDispatch.error || "").includes(`Invalid transition: ${PHASES.ASSESS}`)) {
        throw new Error(`Expected invalid-transition failure when skipping Phase 1b, got: ${JSON.stringify(directDispatch)}`);
    }

    // Now go through Phase 1b but record empty checkpoint (no chosen)
    run(["advance", P, projectRoot, I, "targets-both", "--to", PHASES.PROVIDER_SELECTION]);
    run(["checkpoint", P, projectRoot, I, "targets-both", "--phase", PHASES.PROVIDER_SELECTION, "--payload", "{}"]);
    const missingChosen = run(["advance", P, projectRoot, I, "targets-both", "--to", PHASES.DISPATCH_PLAN], { allowFailure: true });
    if (!String(missingChosen.error || "").includes("Tracker provider selection missing")) {
        throw new Error(`Expected tracker-provider-missing failure, got: ${JSON.stringify(missingChosen)}`);
    }

    // Recover: record provider_selection.chosen
    run(["checkpoint", P, projectRoot, I, "targets-both", "--phase", PHASES.PROVIDER_SELECTION, "--payload", "{\"provider_selection\":{\"chosen\":\"file\",\"available\":[\"file\"],\"reason\":\"recovery\",\"selected_by\":\"single_option\"}}"]);
    run(["advance", P, projectRoot, I, "targets-both", "--to", PHASES.DISPATCH_PLAN]);
    run(["checkpoint", P, projectRoot, I, "targets-both", "--phase", PHASES.DISPATCH_PLAN, "--payload", "{}"]);
    const missingDispatch = run(["advance", P, projectRoot, I, "targets-both", "--to", PHASES.WORKER_EXECUTION], { allowFailure: true });
    if (missingDispatch.error !== "Dispatch plan missing") {
        throw new Error(`Expected dispatch plan failure, got: ${JSON.stringify(missingDispatch)}`);
    }

    const invalidWorker = run(["record-worker", P, projectRoot, I, "targets-both", "--payload", "{\"producer_skill\":\"ln-011\"}"], { allowFailure: true });
    if (!String(invalidWorker.error || "").includes("environment worker summary")) {
        throw new Error(`Expected invalid worker summary failure, got: ${JSON.stringify(invalidWorker)}`);
    }

    // Scenario 2: dry-run completion path (with Phase 1b)
    const dryRunManifestPath = join(projectRoot, "manifest-dry.json");
    writeJson(dryRunManifestPath, { targets: ["codex"], dry_run: true });
    run(["start", P, projectRoot, I, "targets-codex", "--manifest-file", dryRunManifestPath]);
    run(["checkpoint", P, projectRoot, I, "targets-codex", "--phase", PHASES.CONFIG]);
    run(["advance", P, projectRoot, I, "targets-codex", "--to", PHASES.ASSESS]);
    run(["checkpoint", P, projectRoot, I, "targets-codex", "--phase", PHASES.ASSESS, "--payload", "{\"assess_summary\":{\"node\":true}}"]);
    run(["advance", P, projectRoot, I, "targets-codex", "--to", PHASES.PROVIDER_SELECTION]);
    run(["checkpoint", P, projectRoot, I, "targets-codex", "--phase", PHASES.PROVIDER_SELECTION, "--payload", "{\"provider_selection\":{\"chosen\":\"file\",\"available\":[\"file\"],\"reason\":\"dry-run\",\"selected_by\":\"single_option\"}}"]);
    run(["advance", P, projectRoot, I, "targets-codex", "--to", PHASES.DISPATCH_PLAN]);
    run(["checkpoint", P, projectRoot, I, "targets-codex", "--phase", PHASES.DISPATCH_PLAN, "--payload", "{\"dispatch_plan\":{\"workers_to_run\":[]}}"]);
    run(["advance", P, projectRoot, I, "targets-codex", "--to", PHASES.WORKER_EXECUTION]);
    run(["checkpoint", P, projectRoot, I, "targets-codex", "--phase", PHASES.WORKER_EXECUTION]);
    run(["advance", P, projectRoot, I, "targets-codex", "--to", PHASES.VERIFY]);
    run(["checkpoint", P, projectRoot, I, "targets-codex", "--phase", PHASES.VERIFY, "--payload", "{\"verification_summary\":{\"status\":\"dry-run\"}}"]);
    run(["advance", P, projectRoot, I, "targets-codex", "--to", PHASES.WRITE_ENV_STATE]);
    run(["checkpoint", P, projectRoot, I, "targets-codex", "--phase", PHASES.WRITE_ENV_STATE, "--payload", JSON.stringify({ env_state_written: false, final_result: ENVIRONMENT_SETUP_FINAL_RESULTS.DRY_RUN_PLAN })]);
    run(["advance", P, projectRoot, I, "targets-codex", "--to", PHASES.SELF_CHECK]);
    run(["checkpoint", P, projectRoot, I, "targets-codex", "--phase", PHASES.SELF_CHECK, "--payload", JSON.stringify({ pass: true, final_result: ENVIRONMENT_SETUP_FINAL_RESULTS.DRY_RUN_PLAN })]);
    const completed = run(["complete", P, projectRoot, I, "targets-codex"]);
    if (!completed.ok || completed.state.final_result !== ENVIRONMENT_SETUP_FINAL_RESULTS.DRY_RUN_PLAN) {
        throw new Error("Dry-run environment setup should complete without env_state_written");
    }

    // Scenario 3: ambiguous status when multiple active runs
    const secondManifestPath = join(projectRoot, "manifest-second.json");
    writeJson(secondManifestPath, { targets: ["claude"], dry_run: false });
    run(["start", P, projectRoot, I, "targets-claude", "--manifest-file", secondManifestPath]);
    const ambiguousStatus = run(["status", P, projectRoot], { allowFailure: true });
    if (!String(ambiguousStatus.error || "").includes("Multiple active ln-010 runs found")) {
        throw new Error(`Expected ambiguous status failure, got: ${JSON.stringify(ambiguousStatus)}`);
    }

    process.stdout.write("environment-setup-runtime negative passed\n");
} finally {
    rmSync(projectRoot, { recursive: true, force: true });
}
