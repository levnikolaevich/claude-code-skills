#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { PHASES } from "../lib/phases.mjs";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const cliPath = join(__dirname, "..", "cli.mjs");
const projectRoot = mkdtempSync(join(tmpdir(), "scope-decomposition-runtime-"));
const manifestPath = join(projectRoot, "manifest.json");

writeFileSync(manifestPath, JSON.stringify({ auto_approve: true }, null, 2));

function run(args) {
    return JSON.parse(execFileSync("node", [cliPath, ...args], {
        cwd: projectRoot,
        encoding: "utf8",
    }));
}

try {
    const started = run(["start", "--identifier", "scope", "--manifest-file", manifestPath]);
    if (!started.ok) {
        throw new Error("Failed to start scope-decomposition runtime");
    }
    const parentRunId = started.run_id;
    run(["checkpoint", "--identifier", "scope", "--phase", PHASES.CONFIG, "--payload", "{\"config_ready\":true}"]);
    run(["advance", "--identifier", "scope", "--to", PHASES.DISCOVERY]);
    run(["checkpoint", "--identifier", "scope", "--phase", PHASES.DISCOVERY, "--payload", "{\"discovery_summary\":{\"scope\":\"ok\"}}"]);
    run(["advance", "--identifier", "scope", "--to", PHASES.EPIC_DECOMPOSITION]);
    run(["record-epic-summary", "--identifier", "scope", "--payload", "{\"schema_version\":\"1.0.0\",\"summary_kind\":\"epic-plan\",\"run_id\":\"scope-test\",\"identifier\":\"scope\",\"producer_skill\":\"ln-210\",\"produced_at\":\"2026-03-27T00:00:00Z\",\"payload\":{\"mode\":\"CREATE\",\"scope_identifier\":\"scope\",\"epics_created\":2,\"epics_updated\":0,\"epics_canceled\":0,\"epic_urls\":[\"url-1\",\"url-2\"],\"warnings\":[],\"kanban_updated\":true,\"artifact_path\":null}}"]);
    run(["checkpoint", "--identifier", "scope", "--phase", PHASES.EPIC_DECOMPOSITION, "--payload", "{\"epics_ready\":true}"]);
    run(["advance", "--identifier", "scope", "--to", PHASES.STORY_LOOP]);
    run(["record-story-summary", "--identifier", "scope", "--payload", "{\"schema_version\":\"1.0.0\",\"summary_kind\":\"story-plan\",\"run_id\":\"story-parent-run\",\"identifier\":\"epic-1\",\"producer_skill\":\"ln-220\",\"produced_at\":\"2026-03-27T00:00:00Z\",\"payload\":{\"mode\":\"CREATE\",\"epic_id\":\"1\",\"stories_planned\":5,\"stories_created\":5,\"stories_updated\":0,\"stories_canceled\":0,\"story_urls\":[\"s-1\"],\"warnings\":[],\"kanban_updated\":true,\"research_path_used\":\"docs/research/rsh-001.md\",\"worker_runs_completed\":1,\"artifact_path\":null}}"]);
    run(["checkpoint", "--identifier", "scope", "--phase", PHASES.STORY_LOOP, "--payload", "{\"stories_ready\":true}"]);
    run(["advance", "--identifier", "scope", "--to", PHASES.PRIORITIZATION_LOOP]);
    run(["record-prioritization-summary", "--identifier", "scope", "--payload", "{\"schema_version\":\"1.0.0\",\"summary_kind\":\"story-prioritization-worker\",\"run_id\":\"child-ln-230-epic-1\",\"identifier\":\"epic-1\",\"producer_skill\":\"ln-230\",\"produced_at\":\"2026-04-08T00:00:00Z\",\"payload\":{\"epic_id\":\"1\",\"depth\":\"standard\",\"stories_analyzed\":5,\"priority_distribution\":{\"p0\":1,\"p1\":1,\"p2\":2,\"p3\":1},\"top_story_ids\":[\"s-1\"],\"prioritization_path\":\"docs/market/epic-1/prioritization.md\",\"warnings\":[],\"artifact_path\":null}}"]);
    run(["checkpoint", "--identifier", "scope", "--phase", PHASES.PRIORITIZATION_LOOP, "--payload", "{\"prioritization_enabled\":true,\"expected_prioritization_epics\":[\"1\"]}"]);
    run(["advance", "--identifier", "scope", "--to", PHASES.FINALIZE]);
    run(["checkpoint", "--identifier", "scope", "--phase", PHASES.FINALIZE, "--payload", "{\"final_result\":\"READY\"}"]);
    run(["record-scope-summary", "--identifier", "scope", "--payload", JSON.stringify({
        schema_version: "1.0.0",
        summary_kind: "scope-decomposition",
        run_id: parentRunId,
        identifier: "scope",
        producer_skill: "ln-200",
        produced_at: "2026-04-08T00:00:00Z",
        payload: {
            scope_identifier: "scope",
            epic_runs_completed: 1,
            story_runs_completed: 1,
            prioritization_runs_completed: 1,
            warnings: [],
            final_result: "READY",
            artifact_path: null,
        },
    })]);
    run(["advance", "--identifier", "scope", "--to", PHASES.SELF_CHECK]);
    run(["checkpoint", "--identifier", "scope", "--phase", PHASES.SELF_CHECK, "--payload", "{\"pass\":true,\"final_result\":\"READY\"}"]);
    const completed = run(["complete", "--identifier", "scope"]);
    if (!completed.ok || completed.state.phase !== "DONE") {
        throw new Error("Scope-decomposition runtime did not complete");
    }
    process.stdout.write("scope-decomposition-runtime smoke passed\n");
} finally {
    rmSync(projectRoot, { recursive: true, force: true });
}
