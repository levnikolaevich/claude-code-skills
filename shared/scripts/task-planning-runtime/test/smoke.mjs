#!/usr/bin/env node

import { rmSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
    createJsonCliRunner,
    createProjectRoot,
    writeJson,
} from "../../coordinator-runtime/test/cli-test-helpers.mjs";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const cliPath = join(__dirname, "..", "cli.mjs");
const projectRoot = createProjectRoot("task-planning-runtime-");
const run = createJsonCliRunner(cliPath, projectRoot);

try {
    const manifestPath = join(projectRoot, "manifest.json");
    writeJson(manifestPath, {
        task_provider: "file",
        auto_approve: true,
    });

    const started = run(["start", "--project-root", projectRoot, "--story", "PROJ-42", "--manifest-file", manifestPath]);
    if (!started.ok) {
        throw new Error("Failed to start task planning runtime");
    }

    run(["checkpoint", "--project-root", projectRoot, "--story", "PROJ-42", "--phase", "PHASE_0_CONFIG"]);
    run(["advance", "--project-root", projectRoot, "--story", "PROJ-42", "--to", "PHASE_1_DISCOVERY"]);
    run(["checkpoint", "--project-root", projectRoot, "--story", "PROJ-42", "--phase", "PHASE_1_DISCOVERY", "--payload", "{\"discovery_ready\":true}"]);
    run(["advance", "--project-root", projectRoot, "--story", "PROJ-42", "--to", "PHASE_2_DECOMPOSE"]);
    run(["checkpoint", "--project-root", projectRoot, "--story", "PROJ-42", "--phase", "PHASE_2_DECOMPOSE", "--payload", "{\"ideal_plan_summary\":{\"tasks_planned\":3}}"]);
    run(["advance", "--project-root", projectRoot, "--story", "PROJ-42", "--to", "PHASE_3_READINESS_GATE"]);
    run(["checkpoint", "--project-root", projectRoot, "--story", "PROJ-42", "--phase", "PHASE_3_READINESS_GATE", "--payload", "{\"readiness_score\":6,\"readiness_findings\":[]}"]);
    run(["advance", "--project-root", projectRoot, "--story", "PROJ-42", "--to", "PHASE_4_MODE_DETECTION"]);
    run(["checkpoint", "--project-root", projectRoot, "--story", "PROJ-42", "--phase", "PHASE_4_MODE_DETECTION", "--payload", "{\"mode_detection\":\"CREATE\"}"]);
    run(["advance", "--project-root", projectRoot, "--story", "PROJ-42", "--to", "PHASE_5_DELEGATE"]);
    run(["record-plan", "--project-root", projectRoot, "--story", "PROJ-42", "--payload", "{\"schema_version\":\"1.0\",\"summary_kind\":\"task-plan\",\"run_id\":\"run-1\",\"identifier\":\"story-proj-42\",\"producer_skill\":\"ln-301\",\"produced_at\":\"2026-03-26T00:00:00Z\",\"payload\":{\"mode\":\"CREATE\",\"story_id\":\"PROJ-42\",\"task_type\":\"implementation\",\"tasks_created\":3,\"tasks_updated\":0,\"tasks_canceled\":0,\"task_urls\":[\"TASK-1\",\"TASK-2\",\"TASK-3\"],\"dry_warnings_count\":1,\"warnings\":[],\"kanban_updated\":true}}"]);
    run(["checkpoint", "--project-root", projectRoot, "--story", "PROJ-42", "--phase", "PHASE_5_DELEGATE"]);
    run(["advance", "--project-root", projectRoot, "--story", "PROJ-42", "--to", "PHASE_6_VERIFY"]);
    run(["checkpoint", "--project-root", projectRoot, "--story", "PROJ-42", "--phase", "PHASE_6_VERIFY", "--payload", "{\"verification_summary\":{\"tasks_verified\":3},\"final_result\":\"PLAN_READY\",\"template_compliance_passed\":true}"]);
    run(["advance", "--project-root", projectRoot, "--story", "PROJ-42", "--to", "PHASE_7_SELF_CHECK"]);
    run(["checkpoint", "--project-root", projectRoot, "--story", "PROJ-42", "--phase", "PHASE_7_SELF_CHECK", "--payload", "{\"pass\":true,\"final_result\":\"PLAN_READY\"}"]);
    const completed = run(["complete", "--project-root", projectRoot, "--story", "PROJ-42"]);

    if (!completed.ok || completed.state.phase !== "DONE") {
        throw new Error("Task planning runtime did not complete");
    }

    process.stdout.write("task-planning-runtime smoke passed\n");
} finally {
    rmSync(projectRoot, { recursive: true, force: true });
}
