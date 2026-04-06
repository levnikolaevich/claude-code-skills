#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const cliPath = join(__dirname, "..", "cli.mjs");
const projectRoot = mkdtempSync(join(tmpdir(), "audit-worker-guards-"));

let passed = 0;
let failed = 0;

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

function expect(name, result, expectedOk) {
    if (result.ok === expectedOk) {
        passed += 1;
        process.stdout.write(`  PASS: ${name}\n`);
        return;
    }
    failed += 1;
    process.stdout.write(`  FAIL: ${name} (expected ok=${expectedOk}, got ok=${result.ok}, error=${result.error})\n`);
}

try {
    const manifestPath = join(projectRoot, "manifest.json");
    writeFileSync(manifestPath, JSON.stringify({
        codebase_root: ".",
        output_dir: ".hex-skills/runtime-artifacts/runs/demo/audit-report",
        report_path: ".hex-skills/runtime-artifacts/runs/demo/audit-report/ln-631--global.md",
        category: "Business Logic Focus",
    }, null, 2));

    const started = run(["start", "--project-root", projectRoot, "--skill", "ln-631", "--identifier", "global", "--manifest-file", manifestPath]);
    run(["checkpoint", "--project-root", projectRoot, "--skill", "ln-631", "--identifier", "global", "--phase", "PHASE_0_CONFIG"]);
    run(["advance", "--project-root", projectRoot, "--skill", "ln-631", "--identifier", "global", "--to", "PHASE_1_RESOLVE_SCOPE"]);
    run(["checkpoint", "--project-root", projectRoot, "--skill", "ln-631", "--identifier", "global", "--phase", "PHASE_1_RESOLVE_SCOPE"]);
    run(["advance", "--project-root", projectRoot, "--skill", "ln-631", "--identifier", "global", "--to", "PHASE_2_LOAD_CONTEXT"]);
    run(["checkpoint", "--project-root", projectRoot, "--skill", "ln-631", "--identifier", "global", "--phase", "PHASE_2_LOAD_CONTEXT"]);
    run(["advance", "--project-root", projectRoot, "--skill", "ln-631", "--identifier", "global", "--to", "PHASE_3_LAYER1_SCAN"]);
    run(["checkpoint", "--project-root", projectRoot, "--skill", "ln-631", "--identifier", "global", "--phase", "PHASE_3_LAYER1_SCAN"]);
    run(["advance", "--project-root", projectRoot, "--skill", "ln-631", "--identifier", "global", "--to", "PHASE_4_LAYER2_ANALYSIS"]);
    run(["checkpoint", "--project-root", projectRoot, "--skill", "ln-631", "--identifier", "global", "--phase", "PHASE_4_LAYER2_ANALYSIS"]);
    run(["advance", "--project-root", projectRoot, "--skill", "ln-631", "--identifier", "global", "--to", "PHASE_5_SCORE_FINDINGS"]);
    run(["checkpoint", "--project-root", projectRoot, "--skill", "ln-631", "--identifier", "global", "--phase", "PHASE_5_SCORE_FINDINGS"]);
    run(["advance", "--project-root", projectRoot, "--skill", "ln-631", "--identifier", "global", "--to", "PHASE_6_WRITE_REPORT"]);
    run(["checkpoint", "--project-root", projectRoot, "--skill", "ln-631", "--identifier", "global", "--phase", "PHASE_6_WRITE_REPORT"]);
    run(["advance", "--project-root", projectRoot, "--skill", "ln-631", "--identifier", "global", "--to", "PHASE_7_WRITE_SUMMARY"]);
    run(["checkpoint", "--project-root", projectRoot, "--skill", "ln-631", "--identifier", "global", "--phase", "PHASE_7_WRITE_SUMMARY"]);
    run(["advance", "--project-root", projectRoot, "--skill", "ln-631", "--identifier", "global", "--to", "PHASE_8_SELF_CHECK"]);

    const blockedWithoutSummary = run(["complete", "--project-root", projectRoot, "--skill", "ln-631", "--identifier", "global"], { allowFailure: true });
    expect("DONE blocked without summary", blockedWithoutSummary, false);

    run([
        "record-summary",
        "--project-root", projectRoot,
        "--skill", "ln-631",
        "--identifier", "global",
        "--payload",
        JSON.stringify({
            schema_version: "1.0.0",
            summary_kind: "audit-worker",
            run_id: started.run_id,
            identifier: "global",
            producer_skill: "ln-631",
            produced_at: "2026-04-06T00:00:00Z",
            payload: {
                status: "completed",
                category: "Business Logic Focus",
                report_path: ".hex-skills/runtime-artifacts/runs/demo/audit-report/ln-631--global.md",
                score: 9.2,
                issues_total: 0,
                severity_counts: { critical: 0, high: 0, medium: 0, low: 0 },
                warnings: [],
            },
        }),
    ], { allowFailure: true });
    const missingSelfCheck = run(["complete", "--project-root", projectRoot, "--skill", "ln-631", "--identifier", "global"], { allowFailure: true });
    expect("DONE blocked without self-check", missingSelfCheck, false);

    run(["checkpoint", "--project-root", projectRoot, "--skill", "ln-631", "--identifier", "global", "--phase", "PHASE_8_SELF_CHECK", "--payload", "{\"pass\":true,\"final_result\":\"AUDIT_COMPLETE\"}"]);
    const allowed = run(["complete", "--project-root", projectRoot, "--skill", "ln-631", "--identifier", "global"]);
    expect("DONE allowed with summary and self-check", allowed, true);

    process.stdout.write(`\naudit-worker-runtime guards: ${passed} passed, ${failed} failed\n`);
    if (failed > 0) {
        process.exit(1);
    }
} finally {
    rmSync(projectRoot, { recursive: true, force: true });
}
