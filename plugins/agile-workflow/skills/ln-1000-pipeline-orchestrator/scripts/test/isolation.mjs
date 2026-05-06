#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const cliPath = join(__dirname, "..", "cli.mjs");
const projectRoot = mkdtempSync(join(tmpdir(), "pipeline-isolation-"));

function run(args) {
    return JSON.parse(execFileSync("node", [cliPath, ...args], {
        cwd: projectRoot,
        encoding: "utf8",
    }));
}

function runFail(args) {
    try {
        execFileSync("node", [cliPath, ...args], {
            cwd: projectRoot,
            encoding: "utf8",
            stdio: ["ignore", "pipe", "pipe"],
        });
        throw new Error("Expected command to fail");
    } catch (error) {
        return JSON.parse(error.stdout || error.stderr);
    }
}

try {
    const alpha = run(["start", "--story", "ALPHA-1", "--title", "Alpha"]);
    const beta = run(["start", "--story", "BETA-2", "--title", "Beta"]);

    if (!alpha.ok || !beta.ok) {
        throw new Error("Failed to start isolated pipeline runs");
    }

    const ambiguous = runFail(["status"]);
    if (!/Multiple active pipeline runs/.test(ambiguous.error || "")) {
        throw new Error("Ambiguous status without --story should fail explicitly");
    }

    const alphaStatus = run(["status", "--story", "ALPHA-1"]);
    const betaStatus = run(["status", "--story", "BETA-2"]);

    if (alphaStatus.state.story_id !== "ALPHA-1") {
        throw new Error("ALPHA status resolved to wrong story");
    }
    if (betaStatus.state.story_id !== "BETA-2") {
        throw new Error("BETA status resolved to wrong story");
    }
    if (alphaStatus.paths.active === betaStatus.paths.active) {
        throw new Error("Active pointer paths must be story-scoped");
    }

    process.stdout.write("pipeline-runtime isolation passed\n");
} finally {
    rmSync(projectRoot, { recursive: true, force: true });
}
