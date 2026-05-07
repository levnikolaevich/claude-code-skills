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
const projectRoot = createProjectRoot("task-planning-runtime-negative-");
const run = createJsonCliRunner(cliPath, projectRoot);

try {
    const manifestPath = join(projectRoot, "manifest.json");
    writeJson(manifestPath, { task_provider: "file", auto_approve: true });

    run(["start", "--project-root", projectRoot, "--story", "PROJ-42", "--manifest-file", manifestPath]);
    run(["checkpoint", "--project-root", projectRoot, "--story", "PROJ-42", "--phase", "PHASE_0_CONFIG"]);
    run(["advance", "--project-root", projectRoot, "--story", "PROJ-42", "--to", "PHASE_1_DISCOVERY"]);
    run(["checkpoint", "--project-root", projectRoot, "--story", "PROJ-42", "--phase", "PHASE_1_DISCOVERY", "--payload", "{\"discovery_ready\":true}"]);
    run(["advance", "--project-root", projectRoot, "--story", "PROJ-42", "--to", "PHASE_2_DECOMPOSE"]);
    run(["checkpoint", "--project-root", projectRoot, "--story", "PROJ-42", "--phase", "PHASE_2_DECOMPOSE", "--payload", "{\"ideal_plan_summary\":{\"tasks_planned\":3}}"]);
    run(["advance", "--project-root", projectRoot, "--story", "PROJ-42", "--to", "PHASE_3_READINESS_GATE"]);
    run(["checkpoint", "--project-root", projectRoot, "--story", "PROJ-42", "--phase", "PHASE_3_READINESS_GATE", "--payload", "{\"readiness_score\":3,\"readiness_findings\":[\"missing acceptance criteria\"]}"]);
    const blockedReadiness = run(["advance", "--project-root", projectRoot, "--story", "PROJ-42", "--to", "PHASE_4_MODE_DETECTION"], { allowFailure: true });
    if (blockedReadiness.error !== "Readiness gate blocked the plan") {
        throw new Error(`Expected readiness block, got: ${JSON.stringify(blockedReadiness)}`);
    }

    const secondManifestPath = join(projectRoot, "manifest-second.json");
    writeJson(secondManifestPath, { task_provider: "file", auto_approve: false });
    run(["start", "--project-root", projectRoot, "--story", "PROJ-77", "--manifest-file", secondManifestPath]);
    run(["checkpoint", "--project-root", projectRoot, "--story", "PROJ-77", "--phase", "PHASE_0_CONFIG"]);
    run(["advance", "--project-root", projectRoot, "--story", "PROJ-77", "--to", "PHASE_1_DISCOVERY"]);
    run(["checkpoint", "--project-root", projectRoot, "--story", "PROJ-77", "--phase", "PHASE_1_DISCOVERY", "--payload", "{\"discovery_ready\":true}"]);
    run(["advance", "--project-root", projectRoot, "--story", "PROJ-77", "--to", "PHASE_2_DECOMPOSE"]);
    run(["checkpoint", "--project-root", projectRoot, "--story", "PROJ-77", "--phase", "PHASE_2_DECOMPOSE", "--payload", "{\"ideal_plan_summary\":{\"tasks_planned\":4}}"]);
    run(["advance", "--project-root", projectRoot, "--story", "PROJ-77", "--to", "PHASE_3_READINESS_GATE"]);
    run(["checkpoint", "--project-root", projectRoot, "--story", "PROJ-77", "--phase", "PHASE_3_READINESS_GATE", "--payload", "{\"readiness_score\":5,\"readiness_findings\":[\"low confidence\"]}"]);
    const missingApproval = run(["advance", "--project-root", projectRoot, "--story", "PROJ-77", "--to", "PHASE_4_MODE_DETECTION"], { allowFailure: true });
    if (missingApproval.error !== "Readiness approval decision missing") {
        throw new Error(`Expected readiness approval failure, got: ${JSON.stringify(missingApproval)}`);
    }

    run(["pause", "--project-root", projectRoot, "--story", "PROJ-77", "--reason", "Readiness approval required", "--payload", "{\"kind\":\"readiness_approval\",\"question\":\"Continue with warnings?\",\"choices\":[\"continue_with_warnings\",\"stop\"],\"default_choice\":\"stop\",\"context\":{\"story_id\":\"PROJ-77\"},\"resume_to_phase\":\"PHASE_4_MODE_DETECTION\",\"blocking\":true}"]);
    const paused = run(["status", "--project-root", projectRoot, "--story", "PROJ-77"]);
    if (paused.resume_action !== "Resolve pending decision: readiness_approval") {
        throw new Error("Paused task planning run did not expose pending decision resume action");
    }
    run(["set-decision", "--project-root", projectRoot, "--story", "PROJ-77", "--payload", "{\"selected_choice\":\"continue_with_warnings\"}"]);
    const resumed = run(["status", "--project-root", projectRoot, "--story", "PROJ-77"]);
    if (resumed.state.phase !== "PHASE_4_MODE_DETECTION") {
        throw new Error("set-decision did not resume task planning run to mode detection");
    }

    run(["checkpoint", "--project-root", projectRoot, "--story", "PROJ-77", "--phase", "PHASE_4_MODE_DETECTION", "--payload", "{\"mode_detection\":\"CREATE\"}"]);
    run(["advance", "--project-root", projectRoot, "--story", "PROJ-77", "--to", "PHASE_5_DELEGATE"]);
    run(["record-plan", "--project-root", projectRoot, "--story", "PROJ-77", "--payload", "{\"schema_version\":\"1.0.0\",\"summary_kind\":\"task-plan\",\"run_id\":\"run-77\",\"identifier\":\"PROJ-77\",\"producer_skill\":\"ln-301\",\"produced_at\":\"2026-04-09T00:00:00Z\",\"payload\":{\"mode\":\"CREATE\",\"story_id\":\"PROJ-77\",\"task_type\":\"implementation\",\"tasks_created\":2,\"tasks_updated\":0,\"tasks_canceled\":0,\"task_urls\":[\"TASK-77-1\",\"TASK-77-2\"],\"dry_warnings_count\":0,\"warnings\":[],\"kanban_updated\":true}}"]);
    run(["checkpoint", "--project-root", projectRoot, "--story", "PROJ-77", "--phase", "PHASE_5_DELEGATE"]);
    run(["advance", "--project-root", projectRoot, "--story", "PROJ-77", "--to", "PHASE_6_VERIFY"]);
    run(["checkpoint", "--project-root", projectRoot, "--story", "PROJ-77", "--phase", "PHASE_6_VERIFY", "--payload", "{\"verification_summary\":{\"tasks_verified\":2},\"final_result\":\"PLAN_READY\"}"]);
    const missingTemplateCompliance = run(["advance", "--project-root", projectRoot, "--story", "PROJ-77", "--to", "PHASE_7_SELF_CHECK"], { allowFailure: true });
    if (!String(missingTemplateCompliance.error || "").includes("Template compliance not verified")) {
        throw new Error(`Expected template compliance failure, got: ${JSON.stringify(missingTemplateCompliance)}`);
    }

    const invalidSummary = run(["record-plan", "--project-root", projectRoot, "--story", "PROJ-77", "--payload", "{\"producer_skill\":\"ln-301\"}"], { allowFailure: true });
    if (!String(invalidSummary.error || "").includes("task plan worker summary")) {
        throw new Error(`Expected invalid task summary failure, got: ${JSON.stringify(invalidSummary)}`);
    }

    const ambiguousStatus = run(["status", "--project-root", projectRoot], { allowFailure: true });
    if (!String(ambiguousStatus.error || "").includes("Multiple active ln-300 runs found")) {
        throw new Error(`Expected ambiguous task status failure, got: ${JSON.stringify(ambiguousStatus)}`);
    }

    process.stdout.write("task-planning-runtime negative passed\n");
} finally {
    rmSync(projectRoot, { recursive: true, force: true });
}
