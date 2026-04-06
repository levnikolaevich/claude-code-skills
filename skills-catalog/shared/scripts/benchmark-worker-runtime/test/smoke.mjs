#!/usr/bin/env node

import { rmSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
    createJsonCliRunner,
    createProjectRoot,
    writeJson,
} from "../../coordinator-runtime/test/cli-test-helpers.mjs";
import { getWorkerPhases } from "../lib/phases.mjs";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const cliPath = join(__dirname, "..", "cli.mjs");
const projectRoot = createProjectRoot("benchmark-worker-runtime-");
const run = createJsonCliRunner(cliPath, projectRoot);

function buildSummary(runId) {
    return {
        schema_version: "1.0.0",
        summary_kind: "benchmark-worker",
        run_id: runId,
        identifier: "suite-default",
        producer_skill: "ln-840-benchmark-compare",
        produced_at: "2026-04-06T00:00:00Z",
        payload: {
            worker: "ln-840-benchmark-compare",
            status: "completed",
            scenarios_total: 3,
            scenarios_passed: 3,
            scenarios_failed: 0,
            activation_valid: true,
            validity_verdict: "valid",
            report_path: "skills-catalog/ln-840-benchmark-compare/results/2026-04-06-comparison.md",
            artifact_path: null,
            scenario_ids: ["tool-activation", "diff-correctness", "cost-tokens"],
            warnings: [],
            metrics: {
                wall_time_ms: 1200,
                cost_usd: 0.12,
            },
            metadata: {
                suite: "default",
            },
        },
    };
}

try {
    const manifestPath = join(projectRoot, "benchmark.manifest.json");
    writeJson(manifestPath, {
        benchmark_root: "skills-catalog/ln-840-benchmark-compare",
        goals_path: "skills-catalog/ln-840-benchmark-compare/references/goals.md",
        expectations_path: "skills-catalog/ln-840-benchmark-compare/references/expectations.json",
        report_path: "skills-catalog/ln-840-benchmark-compare/results/2026-04-06-comparison.md",
        results_root: "skills-catalog/ln-840-benchmark-compare/results",
        scenario_count: 3,
    });

    const started = run([
        "start",
        "--skill", "ln-840-benchmark-compare",
        "--identifier", "suite-default",
        "--manifest-file", manifestPath,
    ]);
    if (!started.ok) {
        throw new Error("Failed to start benchmark worker runtime");
    }

    const phases = getWorkerPhases("ln-840-benchmark-compare");
    for (let index = 0; index < phases.length; index += 1) {
        const phase = phases[index];
        let payload = {};
        if (phase === "PHASE_5_WRITE_REPORT") {
            payload = {
                ready: true,
                report_path: "skills-catalog/ln-840-benchmark-compare/results/2026-04-06-comparison.md",
            };
        }
        if (phase === "PHASE_7_SELF_CHECK") {
            payload = {
                pass: true,
                final_result: "BENCHMARK_VALID",
            };
        }
        run([
            "checkpoint",
            "--skill", "ln-840-benchmark-compare",
            "--identifier", "suite-default",
            "--phase", phase,
            "--payload", JSON.stringify(payload),
        ]);
        if (phase === "PHASE_6_WRITE_SUMMARY") {
            run([
                "record-summary",
                "--skill", "ln-840-benchmark-compare",
                "--identifier", "suite-default",
                "--payload", JSON.stringify(buildSummary(started.run_id)),
            ]);
        }
        if (phases[index + 1]) {
            run([
                "advance",
                "--skill", "ln-840-benchmark-compare",
                "--identifier", "suite-default",
                "--to", phases[index + 1],
            ]);
        }
    }

    const completed = run([
        "complete",
        "--skill", "ln-840-benchmark-compare",
        "--identifier", "suite-default",
    ]);
    if (!completed.ok || completed.state.phase !== "DONE") {
        throw new Error("Benchmark worker runtime did not complete successfully");
    }
    const artifactPath = completed.state.summary_artifact_path.replaceAll("\\", "/");
    if (!artifactPath.includes("/benchmark-worker/")) {
        throw new Error("Benchmark worker artifact path mismatch");
    }
    const artifact = JSON.parse(readFileSync(completed.state.summary_artifact_path, "utf8"));
    if (artifact.summary_kind !== "benchmark-worker" || artifact.producer_skill !== "ln-840-benchmark-compare") {
        throw new Error("Benchmark worker summary artifact mismatch");
    }

    process.stdout.write("benchmark-worker-runtime smoke passed\n");
} finally {
    rmSync(projectRoot, { recursive: true, force: true });
}
