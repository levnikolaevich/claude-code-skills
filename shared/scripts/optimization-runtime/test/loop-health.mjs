#!/usr/bin/env node
// SOURCE-OF-TRUTH: shared/scripts/optimization-runtime/test/loop-health.mjs. Edit ONLY here; run `node tools/marketplace/shared.mjs sync`

import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { PHASES } from "../lib/phases.mjs";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const cliPath = join(__dirname, "..", "cli.mjs");
const projectRoot = mkdtempSync(join(tmpdir(), "optimization-loop-health-"));

function run(args) {
    return JSON.parse(execFileSync("node", [cliPath, ...args], {
        cwd: projectRoot,
        encoding: "utf8",
    }));
}

function assert(condition, message) {
    if (!condition) {
        throw new Error(message);
    }
}

try {
    const manifestPath = join(projectRoot, "manifest.json");
    writeFileSync(manifestPath, JSON.stringify({
        slug: "align-endpoint",
        target: "src/api/alignment.py::align_endpoint",
        observed_metric: { type: "response_time", value: 6300, unit: "ms" },
        cycle_config: { max_cycles: 3, plateau_threshold: 5 },
        execution_mode: "execute",
    }, null, 2));

    const started = run(["start", "--project-root", projectRoot, "--slug", "align-endpoint", "--manifest-file", manifestPath]);
    assert(started.ok === true, "optimization runtime should start");

    let third = null;
    for (let i = 0; i < 3; i += 1) {
        third = run([
            "record-loop-health",
            "--project-root", projectRoot,
            "--slug", "align-endpoint",
            "--scope", "cycle_1",
            "--payload", JSON.stringify({ error: "same bottleneck and failed hypothesis", progress_detected: false }),
        ]);
    }

    assert(third.pause.pause === true, "same bottleneck loop should pause");
    assert(third.state.phase === PHASES.PAUSED, "optimization runtime should pause on plateau");

    process.stdout.write("optimization loop-health tests passed\n");
} finally {
    rmSync(projectRoot, { recursive: true, force: true });
}
