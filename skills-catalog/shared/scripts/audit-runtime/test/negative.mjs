#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const cliPath = join(__dirname, "..", "cli.mjs");
const projectRoot = mkdtempSync(join(tmpdir(), "audit-runtime-negative-"));

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
        phase_order: [
            "PHASE_0_CONFIG",
            "PHASE_1_DISCOVERY",
            "PHASE_2_DELEGATE",
            "PHASE_3_AGGREGATE",
            "PHASE_4_REPORT",
            "PHASE_5_SELF_CHECK",
        ],
        phase_policy: {
            delegate_phases: ["PHASE_2_DELEGATE"],
            aggregate_phase: "PHASE_3_AGGREGATE",
            report_phase: "PHASE_4_REPORT",
            self_check_phase: "PHASE_5_SELF_CHECK",
        },
        report_path: "docs/project/docs_audit.md",
    }, null, 2));

    run([
        "start",
        "--project-root", projectRoot,
        "--skill", "ln-610",
        "--identifier", "full",
        "--manifest-file", manifestPath,
    ]);

    run(["checkpoint", "--project-root", projectRoot, "--skill", "ln-610", "--identifier", "full", "--phase", "PHASE_0_CONFIG"]);
    run(["advance", "--project-root", projectRoot, "--skill", "ln-610", "--identifier", "full", "--to", "PHASE_1_DISCOVERY"]);
    run(["checkpoint", "--project-root", projectRoot, "--skill", "ln-610", "--identifier", "full", "--phase", "PHASE_1_DISCOVERY"]);
    run(["advance", "--project-root", projectRoot, "--skill", "ln-610", "--identifier", "full", "--to", "PHASE_2_DELEGATE"]);
    run(["checkpoint", "--project-root", projectRoot, "--skill", "ln-610", "--identifier", "full", "--phase", "PHASE_2_DELEGATE"]);

    const blocked = run([
        "advance",
        "--project-root", projectRoot,
        "--skill", "ln-610",
        "--identifier", "full",
        "--to", "PHASE_3_AGGREGATE",
    ], { allowFailure: true });

    if (blocked.ok !== false || !String(blocked.error || "").includes("Worker summaries missing")) {
        throw new Error("Expected aggregate transition to be blocked without worker summaries");
    }

    const invalidSummaryPath = join(projectRoot, "invalid-summary.json");
    writeFileSync(invalidSummaryPath, JSON.stringify({
        schema_version: "1.0.0",
        summary_kind: "audit-worker",
        run_id: "demo--ln-611--global",
        identifier: "global",
        producer_skill: "ln-611",
        produced_at: "2026-03-27T10:00:00Z",
        payload: {
            status: "complete",
            category: "Documentation Structure",
            report_path: ".hex-skills/runtime-artifacts/runs/demo/audit-report/611-structure.md",
            score: 8.5,
            issues_total: 1,
            severity_counts: { critical: 0, high: 0, medium: 1, low: 0 },
            warnings: [],
        },
    }, null, 2));

    const invalidSummary = run([
        "record-worker-result",
        "--project-root", projectRoot,
        "--skill", "ln-610",
        "--identifier", "full",
        "--payload-file", invalidSummaryPath,
    ], { allowFailure: true });

    if (invalidSummary.ok !== false || !String(invalidSummary.error || "").includes("audit worker summary")) {
        throw new Error("Expected invalid audit worker status to be rejected");
    }

    const invalidCoordinatorSummary = run([
        "record-summary",
        "--project-root", projectRoot,
        "--skill", "ln-610",
        "--identifier", "full",
        "--payload",
        "{\"schema_version\":\"1.0.0\",\"summary_kind\":\"audit-coordinator\",\"run_id\":\"wrong-run\",\"identifier\":\"full\",\"producer_skill\":\"ln-610\",\"produced_at\":\"2026-04-06T00:00:00Z\",\"payload\":{\"status\":\"completed\",\"final_result\":\"AUDIT_COMPLETE\",\"report_path\":\"docs/project/docs_audit.md\",\"worker_count\":0,\"issues_total\":0,\"severity_counts\":{\"critical\":0,\"high\":0,\"medium\":0,\"low\":0},\"warnings\":[]}}",
    ], { allowFailure: true });

    if (invalidCoordinatorSummary.ok !== false || !String(invalidCoordinatorSummary.error || "").includes("run_id")) {
        throw new Error("Expected invalid audit coordinator summary run_id to be rejected");
    }

    process.stdout.write("audit-runtime negative passed\n");
} finally {
    rmSync(projectRoot, { recursive: true, force: true });
}
