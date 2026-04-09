#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const cliPath = join(__dirname, "..", "cli.mjs");
const projectRoot = mkdtempSync(join(tmpdir(), "planning-worker-guards-"));

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
        work_item_id: "discovery-demo",
        input_mode: "ideas",
        depth: "standard",
        task_provider: "file",
        auto_approve: true,
    }, null, 2));

    const started = run([
        "start",
        "--project-root", projectRoot,
        "--skill", "ln-201",
        "--identifier", "discovery-demo",
        "--manifest-file", manifestPath,
    ]);

    // Walk the full ln-201 phase ladder with checkpoints after each step.
    const phases = [
        "PHASE_0_CONFIG",
        "PHASE_1_INPUT_PROCESSING",
        "PHASE_2_KILL_FUNNEL",
        "PHASE_3_RANK_SURVIVORS",
        "PHASE_4_WRITE_DISCOVERY_REPORT",
        "PHASE_5_WRITE_SUMMARY",
        "PHASE_6_SELF_CHECK",
    ];
    for (let i = 0; i < phases.length - 1; i += 1) {
        run(["checkpoint", "--project-root", projectRoot, "--skill", "ln-201", "--identifier", "discovery-demo", "--phase", phases[i]]);
        run(["advance", "--project-root", projectRoot, "--skill", "ln-201", "--identifier", "discovery-demo", "--to", phases[i + 1]]);
    }

    const blockedWithoutSummary = run(
        ["complete", "--project-root", projectRoot, "--skill", "ln-201", "--identifier", "discovery-demo"],
        { allowFailure: true },
    );
    expect("DONE blocked without summary", blockedWithoutSummary, false);

    run([
        "record-summary",
        "--project-root", projectRoot,
        "--skill", "ln-201",
        "--identifier", "discovery-demo",
        "--payload",
        JSON.stringify({
            schema_version: "1.0.0",
            summary_kind: "opportunity-discovery-worker",
            run_id: started.run_id,
            identifier: "discovery-demo",
            producer_skill: "ln-201",
            produced_at: "2026-04-09T00:00:00Z",
            payload: {
                input_mode: "ideas",
                ideas_analyzed: 5,
                survivors_count: 1,
                killed_count: 4,
                top_recommendation: "demo-idea",
                report_path: "docs/reference/research/2026-04-09-discovery.md",
                warnings: [],
            },
        }),
    ], { allowFailure: true });

    const missingSelfCheck = run(
        ["complete", "--project-root", projectRoot, "--skill", "ln-201", "--identifier", "discovery-demo"],
        { allowFailure: true },
    );
    expect("DONE blocked without self-check", missingSelfCheck, false);

    run([
        "checkpoint",
        "--project-root", projectRoot,
        "--skill", "ln-201",
        "--identifier", "discovery-demo",
        "--phase", "PHASE_6_SELF_CHECK",
        "--payload", JSON.stringify({ pass: true, final_result: "DISCOVERY_COMPLETE" }),
    ]);

    const allowed = run(["complete", "--project-root", projectRoot, "--skill", "ln-201", "--identifier", "discovery-demo"]);
    expect("DONE allowed with summary + self-check + final_result", allowed, true);

    process.stdout.write(`\nplanning-worker-runtime guards: ${passed} passed, ${failed} failed\n`);
    if (failed > 0) {
        process.exit(1);
    }
} finally {
    rmSync(projectRoot, { recursive: true, force: true });
}
