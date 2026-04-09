#!/usr/bin/env node

import { rmSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
    createJsonCliRunner,
    createProjectRoot,
    writeJson,
} from "../../coordinator-runtime/test/cli-test-helpers.mjs";
import { PLANNING_PROGRESS_STATUSES } from "../../coordinator-runtime/lib/runtime-constants.mjs";
import { PHASES } from "../lib/phases.mjs";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const cliPath = join(__dirname, "..", "cli.mjs");
const projectRoot = createProjectRoot("story-planning-runtime-");
const run = createJsonCliRunner(cliPath, projectRoot);

try {
    const manifestPath = join(projectRoot, "manifest.json");
    writeJson(manifestPath, {
        task_provider: "file",
        auto_approve: false,
    });

    const started = run(["start", "--project-root", projectRoot, "--epic", "7", "--manifest-file", manifestPath]);
    if (!started.ok) {
        throw new Error("Failed to start story planning runtime");
    }
    const parentRunId = started.run_id;

    run(["checkpoint", "--project-root", projectRoot, "--epic", "7", "--phase", PHASES.CONFIG]);
    run(["advance", "--project-root", projectRoot, "--epic", "7", "--to", PHASES.CONTEXT_ASSEMBLY]);
    run(["checkpoint", "--project-root", projectRoot, "--epic", "7", "--phase", PHASES.CONTEXT_ASSEMBLY, "--payload", "{\"context_ready\":true}"]);
    run(["advance", "--project-root", projectRoot, "--epic", "7", "--to", PHASES.RESEARCH]);
    run(["checkpoint", "--project-root", projectRoot, "--epic", "7", "--phase", PHASES.RESEARCH, "--payload", JSON.stringify({ research_status: PLANNING_PROGRESS_STATUSES.COMPLETED, research_file: "docs/research/rsh-007-auth.md" })]);
    run(["advance", "--project-root", projectRoot, "--epic", "7", "--to", PHASES.PLAN]);
    run(["checkpoint", "--project-root", projectRoot, "--epic", "7", "--phase", "PHASE_3_PLAN", "--payload", "{\"ideal_plan_summary\":{\"stories_planned\":3}}"]);
    run(["advance", "--project-root", projectRoot, "--epic", "7", "--to", PHASES.ROUTING]);
    run(["checkpoint", "--project-root", projectRoot, "--epic", "7", "--phase", PHASES.ROUTING, "--payload", "{\"routing_summary\":{\"groups\":[\"7\"]}}"]);
    run(["advance", "--project-root", projectRoot, "--epic", "7", "--to", PHASES.MODE_DETECTION]);
    run(["checkpoint", "--project-root", projectRoot, "--epic", "7", "--phase", PHASES.MODE_DETECTION, "--payload", "{\"epic_group_modes\":{\"7\":\"CREATE\"}}"]);
    run(["pause", "--project-root", projectRoot, "--epic", "7", "--reason", "Preview confirmation", "--payload", "{\"kind\":\"preview_confirmation\",\"question\":\"Confirm preview?\",\"choices\":[\"confirm_preview\",\"cancel\"],\"default_choice\":\"confirm_preview\",\"context\":{\"epic_id\":\"7\"},\"resume_to_phase\":\"PHASE_6_DELEGATE\",\"blocking\":true}"]);
    run(["set-decision", "--project-root", projectRoot, "--epic", "7", "--payload", "{\"selected_choice\":\"confirm_preview\"}"]);
    run(["record-epic", "--project-root", projectRoot, "--epic", "7", "--payload", "{\"schema_version\":\"1.0\",\"summary_kind\":\"story-plan-worker\",\"run_id\":\"child-ln-221-epic-7\",\"identifier\":\"epic-7\",\"producer_skill\":\"ln-221\",\"produced_at\":\"2026-03-26T00:00:00Z\",\"payload\":{\"mode\":\"CREATE\",\"epic_id\":\"7\",\"stories_planned\":3,\"stories_created\":3,\"stories_updated\":0,\"stories_canceled\":0,\"story_urls\":[\"US001\",\"US002\",\"US003\"],\"warnings\":[],\"kanban_updated\":true,\"research_path_used\":\"docs/research/rsh-007-auth.md\"}}"]);
    run(["checkpoint", "--project-root", projectRoot, "--epic", "7", "--phase", PHASES.DELEGATE]);
    run(["advance", "--project-root", projectRoot, "--epic", "7", "--to", PHASES.FINALIZE]);
    run(["checkpoint", "--project-root", projectRoot, "--epic", "7", "--phase", PHASES.FINALIZE, "--payload", "{\"final_result\":\"CREATED\",\"template_compliance_passed\":true}"]);
    run(["record-plan-summary", "--project-root", projectRoot, "--epic", "7", "--payload", JSON.stringify({
        schema_version: "1.0.0",
        summary_kind: "story-plan",
        run_id: parentRunId,
        identifier: "epic-7",
        producer_skill: "ln-220",
        produced_at: "2026-04-08T00:00:00Z",
        payload: {
            mode: "CREATE",
            epic_id: "7",
            stories_planned: 3,
            stories_created: 3,
            stories_updated: 0,
            stories_canceled: 0,
            story_urls: ["US001", "US002", "US003"],
            warnings: [],
            kanban_updated: true,
            research_path_used: "docs/research/rsh-007-auth.md",
            worker_runs_completed: 1,
            artifact_path: null,
        },
    })]);
    run(["advance", "--project-root", projectRoot, "--epic", "7", "--to", PHASES.SELF_CHECK]);
    run(["checkpoint", "--project-root", projectRoot, "--epic", "7", "--phase", PHASES.SELF_CHECK, "--payload", "{\"pass\":true,\"final_result\":\"CREATED\"}"]);
    const completed = run(["complete", "--project-root", projectRoot, "--epic", "7"]);

    if (!completed.ok || completed.state.phase !== PHASES.DONE) {
        throw new Error("Story planning runtime did not complete");
    }

    process.stdout.write("story-planning-runtime smoke passed\n");
} finally {
    rmSync(projectRoot, { recursive: true, force: true });
}
