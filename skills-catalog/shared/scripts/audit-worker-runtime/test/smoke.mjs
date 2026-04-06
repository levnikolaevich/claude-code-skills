#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const cliPath = join(__dirname, "..", "cli.mjs");
const projectRoot = mkdtempSync(join(tmpdir(), "audit-worker-runtime-smoke-"));

function run(args) {
    return JSON.parse(execFileSync("node", [cliPath, ...args], {
        cwd: projectRoot,
        encoding: "utf8",
    }));
}

try {
    const manifestPath = join(projectRoot, "manifest.json");
    writeFileSync(manifestPath, JSON.stringify({
        codebase_root: ".",
        output_dir: ".hex-skills/runtime-artifacts/runs/demo/audit-report",
        report_path: ".hex-skills/runtime-artifacts/runs/demo/audit-report/ln-621--global.md",
        category: "Security",
    }, null, 2));

    const started = run([
        "start",
        "--project-root", projectRoot,
        "--skill", "ln-621",
        "--identifier", "global",
        "--manifest-file", manifestPath,
    ]);
    if (!started.ok) {
        throw new Error("Failed to start audit worker runtime");
    }

    run(["checkpoint", "--project-root", projectRoot, "--skill", "ln-621", "--identifier", "global", "--phase", "PHASE_0_CONFIG"]);
    run(["advance", "--project-root", projectRoot, "--skill", "ln-621", "--identifier", "global", "--to", "PHASE_1_RESOLVE_SCOPE"]);
    run(["checkpoint", "--project-root", projectRoot, "--skill", "ln-621", "--identifier", "global", "--phase", "PHASE_1_RESOLVE_SCOPE"]);
    run(["advance", "--project-root", projectRoot, "--skill", "ln-621", "--identifier", "global", "--to", "PHASE_2_LOAD_CONTEXT"]);
    run(["checkpoint", "--project-root", projectRoot, "--skill", "ln-621", "--identifier", "global", "--phase", "PHASE_2_LOAD_CONTEXT"]);
    run(["advance", "--project-root", projectRoot, "--skill", "ln-621", "--identifier", "global", "--to", "PHASE_3_LAYER1_SCAN"]);
    run(["checkpoint", "--project-root", projectRoot, "--skill", "ln-621", "--identifier", "global", "--phase", "PHASE_3_LAYER1_SCAN"]);
    run(["advance", "--project-root", projectRoot, "--skill", "ln-621", "--identifier", "global", "--to", "PHASE_4_LAYER2_ANALYSIS"]);
    run(["checkpoint", "--project-root", projectRoot, "--skill", "ln-621", "--identifier", "global", "--phase", "PHASE_4_LAYER2_ANALYSIS"]);
    run(["advance", "--project-root", projectRoot, "--skill", "ln-621", "--identifier", "global", "--to", "PHASE_5_SCORE_FINDINGS"]);
    run(["checkpoint", "--project-root", projectRoot, "--skill", "ln-621", "--identifier", "global", "--phase", "PHASE_5_SCORE_FINDINGS"]);
    run(["advance", "--project-root", projectRoot, "--skill", "ln-621", "--identifier", "global", "--to", "PHASE_6_WRITE_REPORT"]);
    run(["checkpoint", "--project-root", projectRoot, "--skill", "ln-621", "--identifier", "global", "--phase", "PHASE_6_WRITE_REPORT"]);
    run(["advance", "--project-root", projectRoot, "--skill", "ln-621", "--identifier", "global", "--to", "PHASE_7_WRITE_SUMMARY"]);
    run([
        "record-summary",
        "--project-root", projectRoot,
        "--skill", "ln-621",
        "--identifier", "global",
        "--payload",
        JSON.stringify({
            schema_version: "1.0.0",
            summary_kind: "audit-worker",
            run_id: started.run_id,
            identifier: "global",
            producer_skill: "ln-621",
            produced_at: "2026-04-06T00:00:00Z",
            payload: {
                status: "completed",
                category: "Security",
                report_path: ".hex-skills/runtime-artifacts/runs/demo/audit-report/ln-621--global.md",
                score: 8.6,
                issues_total: 1,
                severity_counts: { critical: 0, high: 1, medium: 0, low: 0 },
                warnings: [],
            },
        }),
    ]);
    run(["checkpoint", "--project-root", projectRoot, "--skill", "ln-621", "--identifier", "global", "--phase", "PHASE_7_WRITE_SUMMARY"]);
    run(["advance", "--project-root", projectRoot, "--skill", "ln-621", "--identifier", "global", "--to", "PHASE_8_SELF_CHECK"]);
    run(["checkpoint", "--project-root", projectRoot, "--skill", "ln-621", "--identifier", "global", "--phase", "PHASE_8_SELF_CHECK", "--payload", "{\"pass\":true,\"final_result\":\"AUDIT_COMPLETE\"}"]);

    const completed = run(["complete", "--project-root", projectRoot, "--skill", "ln-621", "--identifier", "global"]);
    if (!completed.ok || completed.state.phase !== "DONE") {
        throw new Error("Audit worker runtime did not complete successfully");
    }
    const artifact = JSON.parse(readFileSync(completed.state.summary_artifact_path, "utf8"));
    if (artifact.identifier !== "global" || artifact.producer_skill !== "ln-621") {
        throw new Error("Audit worker summary artifact mismatch");
    }

    process.stdout.write("audit-worker-runtime smoke passed\n");
} finally {
    rmSync(projectRoot, { recursive: true, force: true });
}
