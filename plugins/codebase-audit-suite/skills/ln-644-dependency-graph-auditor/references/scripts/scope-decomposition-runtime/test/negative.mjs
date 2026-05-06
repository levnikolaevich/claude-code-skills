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
const projectRoot = createProjectRoot("scope-decomposition-runtime-negative-");
const run = createJsonCliRunner(cliPath, projectRoot);

try {
    const manifestPath = join(projectRoot, "manifest.json");
    writeJson(manifestPath, { auto_approve: true });

    run(["start", "--identifier", "scope", "--manifest-file", manifestPath]);
    const missingCheckpoint = run(["advance", "--identifier", "scope", "--to", PHASES.DISCOVERY], { allowFailure: true });
    if (missingCheckpoint.error !== `Checkpoint missing for ${PHASES.CONFIG}`) {
        throw new Error(`Expected config checkpoint failure, got: ${JSON.stringify(missingCheckpoint)}`);
    }

    run(["checkpoint", "--identifier", "scope", "--phase", PHASES.CONFIG, "--payload", "{\"config_ready\":true}"]);
    run(["advance", "--identifier", "scope", "--to", PHASES.DISCOVERY]);
    run(["checkpoint", "--identifier", "scope", "--phase", PHASES.DISCOVERY, "--payload", "{\"discovery_summary\":{\"scope\":\"ok\"}}"]);
    run(["advance", "--identifier", "scope", "--to", PHASES.EPIC_DECOMPOSITION]);
    run(["checkpoint", "--identifier", "scope", "--phase", PHASES.EPIC_DECOMPOSITION, "--payload", "{\"epics_ready\":true}"]);

    const missingEpicSummary = run(["advance", "--identifier", "scope", "--to", PHASES.STORY_LOOP], { allowFailure: true });
    if (missingEpicSummary.error !== "Epic planning summary missing") {
        throw new Error(`Expected epic summary failure, got: ${JSON.stringify(missingEpicSummary)}`);
    }

    const invalidStorySummary = run(["record-story-summary", "--identifier", "scope", "--payload", "{\"producer_skill\":\"ln-221\"}"], { allowFailure: true });
    if (!String(invalidStorySummary.error || "").includes("story planning summary")) {
        throw new Error(`Expected invalid story planning summary failure, got: ${JSON.stringify(invalidStorySummary)}`);
    }

    process.stdout.write("scope-decomposition-runtime negative passed\n");
} finally {
    rmSync(projectRoot, { recursive: true, force: true });
}
