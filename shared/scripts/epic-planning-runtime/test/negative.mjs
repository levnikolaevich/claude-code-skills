#!/usr/bin/env node

import { rmSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
    createJsonCliRunner,
    createProjectRoot,
    writeJson,
} from "../../coordinator-runtime/test/cli-test-helpers.mjs";
import { PHASES } from "../lib/phases.mjs";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const cliPath = join(__dirname, "..", "cli.mjs");
const projectRoot = createProjectRoot("epic-planning-runtime-negative-");
const run = createJsonCliRunner(cliPath, projectRoot);

try {
    const manifestPath = join(projectRoot, "manifest.json");
    writeJson(manifestPath, { auto_approve: false });

    run(["start", "--identifier", "scope", "--manifest-file", manifestPath]);
    const missingCheckpoint = run(["advance", "--identifier", "scope", "--to", PHASES.DISCOVERY], { allowFailure: true });
    if (missingCheckpoint.error !== `Checkpoint missing for ${PHASES.CONFIG}`) {
        throw new Error(`Expected config checkpoint failure, got: ${JSON.stringify(missingCheckpoint)}`);
    }

    run(["checkpoint", "--identifier", "scope", "--phase", PHASES.CONFIG, "--payload", "{\"config_ready\":true}"]);
    run(["advance", "--identifier", "scope", "--to", PHASES.DISCOVERY]);
    run(["checkpoint", "--identifier", "scope", "--phase", PHASES.DISCOVERY, "--payload", "{\"discovery_summary\":{\"scope\":\"ok\"}}"]);
    run(["advance", "--identifier", "scope", "--to", PHASES.RESEARCH]);
    run(["checkpoint", "--identifier", "scope", "--phase", PHASES.RESEARCH, "--payload", "{\"research_summary\":{\"researched\":true}}"]);
    run(["advance", "--identifier", "scope", "--to", PHASES.PLAN]);
    run(["checkpoint", "--identifier", "scope", "--phase", PHASES.PLAN, "--payload", "{\"ideal_plan_summary\":{\"epics\":3}}"]);
    run(["advance", "--identifier", "scope", "--to", PHASES.MODE_DETECTION]);
    run(["checkpoint", "--identifier", "scope", "--phase", PHASES.MODE_DETECTION, "--payload", "{\"mode_detection\":{\"mode\":\"CREATE\"}}"]);
    run(["advance", "--identifier", "scope", "--to", PHASES.PREVIEW]);
    run(["checkpoint", "--identifier", "scope", "--phase", PHASES.PREVIEW, "--payload", "{\"preview_ready\":true}"]);

    const missingDecision = run(["advance", "--identifier", "scope", "--to", PHASES.DELEGATE], { allowFailure: true });
    if (missingDecision.error !== "Preview confirmation decision missing") {
        throw new Error(`Expected epic preview decision failure, got: ${JSON.stringify(missingDecision)}`);
    }

    process.stdout.write("epic-planning-runtime negative passed\n");
} finally {
    rmSync(projectRoot, { recursive: true, force: true });
}
