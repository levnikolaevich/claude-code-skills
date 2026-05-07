// SOURCE-OF-TRUTH: shared/scripts/evaluation-worker-runtime/test/smoke.mjs. Edit ONLY here; run `node tools/marketplace/shared.mjs sync`

import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
    createJsonCliRunner,
    createProjectRoot,
    writeJson,
} from "../../coordinator-runtime/test/cli-test-helpers.mjs";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../../..");
const cliPath = join(repoRoot, "shared/scripts/evaluation-worker-runtime/cli.mjs");

function assert(condition, message) {
    if (!condition) {
        throw new Error(message);
    }
}

const projectRoot = createProjectRoot("evaluation-worker-runtime-smoke-");
const run = createJsonCliRunner(cliPath, projectRoot);
const manifestPath = join(projectRoot, "evaluation-worker-manifest.json");

writeJson(manifestPath, {
    phase_order: ["PHASE_0_CONFIG", "PHASE_1_RESEARCH", "PHASE_2_SELF_CHECK"],
    summary_kind: "review-research",
    operation: "research",
});

const started = run(["start", "--skill", "ln-311", "--identifier", "smoke-worker", "--manifest-file", manifestPath]);
assert(started.ok === true, "evaluation worker runtime should start");

run(["checkpoint", "--skill", "ln-311", "--identifier", "smoke-worker", "--phase", "PHASE_0_CONFIG", "--payload", JSON.stringify({ initialized: true })]);
run(["advance", "--skill", "ln-311", "--identifier", "smoke-worker", "--to", "PHASE_1_RESEARCH"]);
run(["checkpoint", "--skill", "ln-311", "--identifier", "smoke-worker", "--phase", "PHASE_1_RESEARCH", "--payload", JSON.stringify({ research_completed: true })]);
run(["advance", "--skill", "ln-311", "--identifier", "smoke-worker", "--to", "PHASE_2_SELF_CHECK"]);
run(["checkpoint", "--skill", "ln-311", "--identifier", "smoke-worker", "--phase", "PHASE_2_SELF_CHECK", "--payload", JSON.stringify({ pass: true, final_result: "completed" })]);

const summary = {
    schema_version: "1.0.0",
    summary_kind: "review-research",
    run_id: started.run_id,
    identifier: "smoke-worker",
    producer_skill: "ln-311",
    produced_at: new Date().toISOString(),
    payload: {
        status: "completed",
        worker: "ln-311",
        operation: "research",
        warnings: [],
        metrics: {
            research_sources: [
                { type: "official", ref: "https://example.com/official" },
                { type: "mcp_ref", ref: "mcp-ref://topic" },
            ],
        },
        metadata: {},
    },
};

run(["record-summary", "--skill", "ln-311", "--identifier", "smoke-worker", "--payload", JSON.stringify(summary)]);
const completed = run(["complete", "--skill", "ln-311", "--identifier", "smoke-worker"]);
assert(completed.ok === true, "evaluation worker runtime should complete");

process.stdout.write("evaluation worker runtime smoke passed\n");
