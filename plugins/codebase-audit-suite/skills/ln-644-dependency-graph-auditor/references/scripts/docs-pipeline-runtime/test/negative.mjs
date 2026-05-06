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
const projectRoot = createProjectRoot("docs-pipeline-runtime-negative-");
const run = createJsonCliRunner(cliPath, projectRoot);

try {
    const manifestPath = join(projectRoot, "manifest.json");
    writeJson(manifestPath, { auto_approve: false });

    run(["start", "--identifier", "docs-pipeline", "--manifest-file", manifestPath]);
    run(["checkpoint", "--identifier", "docs-pipeline", "--phase", PHASES.CONFIG, "--payload", "{\"config_ready\":true}"]);
    run(["advance", "--identifier", "docs-pipeline", "--to", PHASES.SOURCE_SCAN]);
    run(["checkpoint", "--identifier", "docs-pipeline", "--phase", PHASES.SOURCE_SCAN, "--payload", "{\"source_manifest\":[]}"]);
    run(["advance", "--identifier", "docs-pipeline", "--to", PHASES.CONFIRMATION]);
    run(["checkpoint", "--identifier", "docs-pipeline", "--phase", PHASES.CONFIRMATION, "--payload", "{\"source_mode\":\"skip\"}"]);

    const missingDecision = run(["advance", "--identifier", "docs-pipeline", "--to", PHASES.DELEGATE], { allowFailure: true });
    if (missingDecision.error !== "Source cleanup confirmation decision missing") {
        throw new Error(`Expected docs pipeline decision failure, got: ${JSON.stringify(missingDecision)}`);
    }

    run(["pause", "--identifier", "docs-pipeline", "--reason", "Need approval", "--payload", "{\"kind\":\"confirm_docs_pipeline\",\"question\":\"Continue docs pipeline?\",\"choices\":[\"continue\",\"cancel\"],\"default_choice\":\"continue\",\"context\":{\"identifier\":\"docs-pipeline\"},\"resume_to_phase\":\"PHASE_3_DELEGATE\",\"blocking\":true}"]);
    run(["set-decision", "--identifier", "docs-pipeline", "--payload", "{\"selected_choice\":\"continue\"}"]);
    run(["checkpoint", "--identifier", "docs-pipeline", "--phase", PHASES.DELEGATE, "--payload", "{\"delegated\":true}"]);

    const missingComponents = run(["advance", "--identifier", "docs-pipeline", "--to", PHASES.QUALITY_GATE], { allowFailure: true });
    if (missingComponents.error !== "No docs component summaries recorded") {
        throw new Error(`Expected missing docs component failure, got: ${JSON.stringify(missingComponents)}`);
    }

    const invalidComponent = run(["record-component", "--identifier", "docs-pipeline", "--payload", "{\"producer_skill\":\"ln-110\"}"], { allowFailure: true });
    if (!String(invalidComponent.error || "").includes("docs pipeline component summary")) {
        throw new Error(`Expected invalid docs pipeline component failure, got: ${JSON.stringify(invalidComponent)}`);
    }

    process.stdout.write("docs-pipeline-runtime negative passed\n");
} finally {
    rmSync(projectRoot, { recursive: true, force: true });
}
