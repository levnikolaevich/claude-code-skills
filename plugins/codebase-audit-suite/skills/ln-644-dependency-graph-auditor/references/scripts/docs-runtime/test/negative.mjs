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
const projectRoot = createProjectRoot("docs-runtime-negative-");
const run = createJsonCliRunner(cliPath, projectRoot);

try {
    const manifestPath = join(projectRoot, "manifest.json");
    writeJson(manifestPath, { expected_workers: ["ln-111", "ln-112"] });

    run(["start", "--identifier", "project-docs", "--manifest-file", manifestPath]);
    run(["checkpoint", "--identifier", "project-docs", "--phase", PHASES.CONFIG, "--payload", "{\"config_ready\":true}"]);
    run(["advance", "--identifier", "project-docs", "--to", PHASES.CONTEXT_ASSEMBLY]);
    run(["checkpoint", "--identifier", "project-docs", "--phase", PHASES.CONTEXT_ASSEMBLY, "--payload", "{}"]);

    const missingContext = run(["advance", "--identifier", "project-docs", "--to", PHASES.DETECTION], { allowFailure: true });
    if (missingContext.error !== "Context assembly not recorded") {
        throw new Error(`Expected context assembly failure, got: ${JSON.stringify(missingContext)}`);
    }

    run(["checkpoint", "--identifier", "project-docs", "--phase", PHASES.CONTEXT_ASSEMBLY, "--payload", "{\"context_ready\":true}"]);
    run(["advance", "--identifier", "project-docs", "--to", PHASES.DETECTION]);
    run(["checkpoint", "--identifier", "project-docs", "--phase", PHASES.DETECTION, "--payload", "{\"detected_flags\":{\"hasBackend\":true}}"]);
    run(["advance", "--identifier", "project-docs", "--to", PHASES.DELEGATE]);
    run(["checkpoint", "--identifier", "project-docs", "--phase", PHASES.DELEGATE, "--payload", "{\"delegated\":true}"]);

    const missingWorkers = run(["advance", "--identifier", "project-docs", "--to", PHASES.AGGREGATE], { allowFailure: true });
    if (missingWorkers.error !== "Not all docs workers produced summaries") {
        throw new Error(`Expected docs worker summary failure, got: ${JSON.stringify(missingWorkers)}`);
    }

    const invalidWorker = run(["record-worker", "--identifier", "project-docs", "--payload", "{\"producer_skill\":\"ln-111\"}"], { allowFailure: true });
    if (!String(invalidWorker.error || "").includes("docs-generation worker summary")) {
        throw new Error(`Expected invalid docs-generation summary failure, got: ${JSON.stringify(invalidWorker)}`);
    }

    process.stdout.write("docs-runtime negative passed\n");
} finally {
    rmSync(projectRoot, { recursive: true, force: true });
}
