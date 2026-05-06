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
const projectRoot = createProjectRoot("story-planning-runtime-negative-");
const run = createJsonCliRunner(cliPath, projectRoot);

try {
    const manifestPath = join(projectRoot, "manifest.json");
    writeJson(manifestPath, { task_provider: "file", auto_approve: false });

    run(["start", "--project-root", projectRoot, "--epic", "7", "--manifest-file", manifestPath]);
    run(["checkpoint", "--project-root", projectRoot, "--epic", "7", "--phase", PHASES.CONFIG]);
    run(["advance", "--project-root", projectRoot, "--epic", "7", "--to", PHASES.CONTEXT_ASSEMBLY]);
    run(["checkpoint", "--project-root", projectRoot, "--epic", "7", "--phase", PHASES.CONTEXT_ASSEMBLY, "--payload", "{}"]);
    const missingContext = run(["advance", "--project-root", projectRoot, "--epic", "7", "--to", PHASES.RESEARCH], { allowFailure: true });
    if (missingContext.error !== "Context assembly not recorded") {
        throw new Error(`Expected context failure, got: ${JSON.stringify(missingContext)}`);
    }

    run(["checkpoint", "--project-root", projectRoot, "--epic", "7", "--phase", PHASES.CONTEXT_ASSEMBLY, "--payload", "{\"context_ready\":true}"]);
    run(["advance", "--project-root", projectRoot, "--epic", "7", "--to", PHASES.RESEARCH]);
    run(["checkpoint", "--project-root", projectRoot, "--epic", "7", "--phase", PHASES.RESEARCH, "--payload", JSON.stringify({ research_status: PLANNING_PROGRESS_STATUSES.COMPLETED, research_file: "docs/research/rsh-007-auth.md" })]);
    run(["advance", "--project-root", projectRoot, "--epic", "7", "--to", PHASES.PLAN]);
    run(["checkpoint", "--project-root", projectRoot, "--epic", "7", "--phase", "PHASE_3_PLAN", "--payload", "{\"ideal_plan_summary\":{\"stories_planned\":2}}"]);
    run(["advance", "--project-root", projectRoot, "--epic", "7", "--to", PHASES.ROUTING]);
    run(["checkpoint", "--project-root", projectRoot, "--epic", "7", "--phase", PHASES.ROUTING, "--payload", "{\"routing_summary\":{\"groups\":[\"7\"]}}"]);
    run(["advance", "--project-root", projectRoot, "--epic", "7", "--to", PHASES.MODE_DETECTION]);
    run(["checkpoint", "--project-root", projectRoot, "--epic", "7", "--phase", PHASES.MODE_DETECTION, "--payload", "{\"epic_group_modes\":{\"7\":\"CREATE\"}}"]);
    const missingDecision = run(["advance", "--project-root", projectRoot, "--epic", "7", "--to", PHASES.DELEGATE], { allowFailure: true });
    if (missingDecision.error !== "Preview confirmation decision missing") {
        throw new Error(`Expected preview decision failure, got: ${JSON.stringify(missingDecision)}`);
    }

    run(["pause", "--project-root", projectRoot, "--epic", "7", "--reason", "Preview confirmation", "--payload", "{\"kind\":\"preview_confirmation\",\"question\":\"Confirm preview?\",\"choices\":[\"confirm_preview\",\"cancel\"],\"default_choice\":\"confirm_preview\",\"context\":{\"epic_id\":\"7\"},\"resume_to_phase\":\"PHASE_6_DELEGATE\",\"blocking\":true}"]);
    const paused = run(["status", "--project-root", projectRoot, "--epic", "7"]);
    if (paused.resume_action !== "Resolve pending decision: preview_confirmation") {
        throw new Error("Paused story planning run did not expose pending decision resume action");
    }
    run(["set-decision", "--project-root", projectRoot, "--epic", "7", "--payload", "{\"selected_choice\":\"confirm_preview\"}"]);
    const resumed = run(["status", "--project-root", projectRoot, "--epic", "7"]);
    if (resumed.state.phase !== PHASES.DELEGATE) {
        throw new Error("set-decision did not resume story planning run to delegate phase");
    }

    const invalidSummary = run(["record-epic", "--project-root", projectRoot, "--epic", "7", "--payload", "{\"producer_skill\":\"ln-221\"}"], { allowFailure: true });
    if (!String(invalidSummary.error || "").includes("story plan worker summary")) {
        throw new Error(`Expected invalid story summary failure, got: ${JSON.stringify(invalidSummary)}`);
    }

    const secondManifestPath = join(projectRoot, "manifest-second.json");
    writeJson(secondManifestPath, { task_provider: "file", auto_approve: true });
    run(["start", "--project-root", projectRoot, "--epic", "8", "--manifest-file", secondManifestPath]);
    const ambiguousStatus = run(["status", "--project-root", projectRoot], { allowFailure: true });
    if (!String(ambiguousStatus.error || "").includes("Multiple active ln-220 runs found")) {
        throw new Error(`Expected ambiguous story status failure, got: ${JSON.stringify(ambiguousStatus)}`);
    }

    process.stdout.write("story-planning-runtime negative passed\n");
} finally {
    rmSync(projectRoot, { recursive: true, force: true });
}
