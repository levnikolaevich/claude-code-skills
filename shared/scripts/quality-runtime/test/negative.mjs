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
const projectRoot = createProjectRoot("quality-runtime-negative-");
const run = createJsonCliRunner(cliPath, projectRoot);

try {
    const manifestPath = join(projectRoot, "manifest.json");
    writeJson(manifestPath, { fast_track: false });

    run(["start", "--story", "PROJ-123", "--manifest-file", manifestPath]);
    run(["checkpoint", "--story", "PROJ-123", "--phase", PHASES.CONFIG, "--payload", "{\"config_ready\":true}"]);
    run(["advance", "--story", "PROJ-123", "--to", PHASES.DISCOVERY]);
    run(["checkpoint", "--story", "PROJ-123", "--phase", PHASES.DISCOVERY, "--payload", "{\"discovery_ready\":true}"]);
    run(["advance", "--story", "PROJ-123", "--to", PHASES.CODE_QUALITY]);
    run(["checkpoint", "--story", "PROJ-123", "--phase", PHASES.CODE_QUALITY, "--payload", "{\"quality_checked\":true}"]);

    const missingSummary = run(["advance", "--story", "PROJ-123", "--to", PHASES.CLEANUP], { allowFailure: true });
    if (missingSummary.error !== "ln-511 summary missing") {
        throw new Error(`Expected ln-511 summary failure, got: ${JSON.stringify(missingSummary)}`);
    }

    const invalidWorker = run(["record-worker", "--story", "PROJ-123", "--payload", "{\"producer_skill\":\"ln-511\"}"], { allowFailure: true });
    if (!String(invalidWorker.error || "").includes("quality worker summary")) {
        throw new Error(`Expected invalid quality worker summary failure, got: ${JSON.stringify(invalidWorker)}`);
    }

    process.stdout.write("quality-runtime negative passed\n");
} finally {
    rmSync(projectRoot, { recursive: true, force: true });
}
