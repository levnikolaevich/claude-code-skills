#!/usr/bin/env node
// SOURCE-OF-TRUTH: shared/scripts/planning-worker-runtime/test/smoke.mjs. Edit ONLY here; run `node tools/marketplace/shared.mjs sync`

import { rmSync } from "node:fs";
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
const projectRoot = createProjectRoot("planning-worker-runtime-");
const run = createJsonCliRunner(cliPath, projectRoot);

function buildSummary(skill, runId, identifier) {
    if (skill === "ln-201") {
        return {
            schema_version: "1.0.0",
            summary_kind: "opportunity-discovery-worker",
            run_id: runId,
            identifier,
            producer_skill: skill,
            produced_at: "2026-04-08T00:00:00Z",
            payload: {
                input_mode: "ideas",
                ideas_analyzed: 3,
                generated_ideas: 0,
                survivors_count: 1,
                killed_count: 2,
                top_recommendation: "AI onboarding audits",
                report_path: "docs/reference/research/2026-04-08-discovery.md",
                warnings: [],
                artifact_path: null,
            },
        };
    }
    if (skill === "ln-230") {
        return {
            schema_version: "1.0.0",
            summary_kind: "story-prioritization-worker",
            run_id: runId,
            identifier,
            producer_skill: skill,
            produced_at: "2026-04-08T00:00:00Z",
            payload: {
                epic_id: "7",
                depth: "standard",
                stories_analyzed: 3,
                priority_distribution: { p0: 1, p1: 1, p2: 1, p3: 0 },
                top_story_ids: ["ST-1", "ST-2"],
                prioritization_path: "docs/market/epic-7/prioritization.md",
                warnings: [],
                artifact_path: null,
            },
        };
    }
    return {
        schema_version: "1.0.0",
        summary_kind: "story-plan-worker",
        run_id: runId,
        identifier,
        producer_skill: skill,
        produced_at: "2026-04-08T00:00:00Z",
        payload: {
            mode: skill === "ln-221" ? "CREATE" : "REPLAN",
            epic_id: "7",
            stories_planned: 3,
            stories_created: skill === "ln-221" ? 3 : 1,
            stories_updated: skill === "ln-222" ? 2 : 0,
            stories_canceled: 0,
            story_urls: ["ST-1", "ST-2", "ST-3"],
            warnings: [],
            kanban_updated: true,
            research_path_used: "docs/research/rsh-007-auth.md",
        },
    };
}

try {
    for (const skill of ["ln-201", "ln-221", "ln-222", "ln-230"]) {
        const identifier = skill === "ln-201" ? "ideas-abc123" : "epic-7";
        const manifestPath = join(projectRoot, `${skill}.manifest.json`);
        writeJson(manifestPath, skill === "ln-201"
            ? { input_mode: "ideas" }
            : { epic_id: "7", auto_approve: true });
        const parentRunId = "parent-ln-200";
        const childRunId = `${parentRunId}--${skill}--${identifier}`;
        const summaryKind = skill === "ln-201"
            ? "opportunity-discovery-worker"
            : skill === "ln-230"
                ? "story-prioritization-worker"
                : "story-plan-worker";
        const artifactPath = `.hex-skills/runtime-artifacts/runs/${parentRunId}/${summaryKind}/${skill}--${identifier}.json`;
        const started = run([
            "start", "--skill", skill, "--identifier", identifier, "--manifest-file", manifestPath,
            "--run-id", childRunId, "--summary-artifact-path", artifactPath,
        ]);
        if (!started.ok) {
            throw new Error(`Failed to start ${skill}`);
        }
        const phases = getWorkerPhases(skill);
        for (let index = 0; index < phases.length; index += 1) {
            const phase = phases[index];
            run(["checkpoint", "--skill", skill, "--identifier", identifier, "--phase", phase, "--payload", phase.endsWith("SELF_CHECK")
                ? "{\"pass\":true,\"final_result\":\"READY\"}"
                : "{}"]);
            if (phase.includes("WRITE_SUMMARY")) {
                run(["record-summary", "--skill", skill, "--identifier", identifier, "--payload", JSON.stringify(buildSummary(skill, childRunId, identifier))]);
            }
            if (phases[index + 1]) {
                run(["advance", "--skill", skill, "--identifier", identifier, "--to", phases[index + 1]]);
            }
        }
        const completed = run(["complete", "--skill", skill, "--identifier", identifier]);
        if (!completed.ok || completed.state.phase !== "DONE") {
            throw new Error(`Planning worker runtime did not complete for ${skill}`);
        }
    }
    process.stdout.write("planning-worker-runtime smoke passed\n");
} finally {
    rmSync(projectRoot, { recursive: true, force: true });
}
