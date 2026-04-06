#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const cliPath = join(__dirname, "..", "cli.mjs");
const projectRoot = mkdtempSync(join(tmpdir(), "audit-worker-negative-"));

function run(args, options = {}) {
    try {
        return JSON.parse(execFileSync("node", [cliPath, ...args], {
            cwd: projectRoot,
            encoding: "utf8",
            stdio: ["ignore", "pipe", "pipe"],
        }));
    } catch (error) {
        if (options.allowFailure) {
            return JSON.parse(error.stdout || error.stderr);
        }
        throw error;
    }
}

try {
    const manifestPath = join(projectRoot, "manifest.json");
    writeFileSync(manifestPath, JSON.stringify({
        codebase_root: ".",
        output_dir: ".hex-skills/runtime-artifacts/runs/demo/audit-report",
        report_path: ".hex-skills/runtime-artifacts/runs/demo/audit-report/ln-645--payments.md",
        category: "Open Source Replacement",
    }, null, 2));

    const started = run([
        "start",
        "--project-root", projectRoot,
        "--skill", "ln-645",
        "--identifier", "payments",
        "--manifest-file", manifestPath,
    ]);

    const invalidRunId = run([
        "record-summary",
        "--project-root", projectRoot,
        "--skill", "ln-645",
        "--identifier", "payments",
        "--payload",
        JSON.stringify({
            schema_version: "1.0.0",
            summary_kind: "audit-worker",
            run_id: "wrong-run-id",
            identifier: "payments",
            producer_skill: "ln-645",
            produced_at: "2026-04-06T00:00:00Z",
            payload: {
                status: "completed",
                category: "Open Source Replacement",
                report_path: ".hex-skills/runtime-artifacts/runs/demo/audit-report/ln-645--payments.md",
                score: 7.8,
                issues_total: 2,
                severity_counts: { critical: 0, high: 0, medium: 2, low: 0 },
                warnings: [],
            },
        }),
    ], { allowFailure: true });

    if (invalidRunId.ok !== false || !String(invalidRunId.error || "").includes("run_id")) {
        throw new Error("Expected mismatched run_id to be rejected");
    }

    const invalidManagedStart = run([
        "start",
        "--project-root", projectRoot,
        "--skill", "ln-621",
        "--identifier", "global",
        "--run-id", `${started.run_id}--ln-621--global`,
        "--manifest-file", manifestPath,
    ], { allowFailure: true });

    if (invalidManagedStart.ok !== false || !String(invalidManagedStart.error || "").includes("--summary-artifact-path")) {
        throw new Error("Expected managed start without summary path to be rejected");
    }

    process.stdout.write("audit-worker-runtime negative passed\n");
} finally {
    rmSync(projectRoot, { recursive: true, force: true });
}
