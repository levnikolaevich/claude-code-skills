#!/usr/bin/env node
// SOURCE-OF-TRUTH: shared/scripts/scope-decomposition-runtime/test/guards.mjs. Edit ONLY here; run `node tools/marketplace/shared.mjs sync`

import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { PHASES } from "../lib/phases.mjs";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const cliPath = join(__dirname, "..", "cli.mjs");
const projectRoot = mkdtempSync(join(tmpdir(), "scope-guards-"));
const manifestPath = join(projectRoot, "manifest.json");

writeFileSync(manifestPath, JSON.stringify({ auto_approve: true }, null, 2));

let passed = 0;
let failed = 0;

function run(args, options = {}) {
    try {
        return JSON.parse(execFileSync("node", [cliPath, ...args], {
            cwd: projectRoot, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"],
        }));
    } catch (error) {
        if (options.allowFailure) { return JSON.parse(error.stdout || error.stderr); }
        throw error;
    }
}

function expect(name, result, expectedOk) {
    if (result.ok === expectedOk) { passed++; process.stdout.write(`  PASS: ${name}\n`); }
    else { failed++; process.stdout.write(`  FAIL: ${name} (expected ok=${expectedOk}, got ok=${result.ok}, error=${result.error})\n`); }
}

function startScopeRun(identifier) {
    run(["start", "--identifier", identifier, "--manifest-file", manifestPath]);
    run(["checkpoint", "--identifier", identifier, "--phase", PHASES.CONFIG]);
    run(["advance", "--identifier", identifier, "--to", PHASES.DISCOVERY]);
    run(["checkpoint", "--identifier", identifier, "--phase", PHASES.DISCOVERY, "--payload", "{\"discovery_summary\":{\"ok\":true}}"]);
    run(["advance", "--identifier", identifier, "--to", PHASES.EPIC_DECOMPOSITION]);
    run(["checkpoint", "--identifier", identifier, "--phase", PHASES.EPIC_DECOMPOSITION]);
}

try {
    startScopeRun("scope");

    // TEST 1: STORY_LOOP blocked without epic_summary
    run(["checkpoint", "--identifier", "scope", "--phase", PHASES.EPIC_DECOMPOSITION]);
    const t1 = run(["advance", "--identifier", "scope", "--to", PHASES.STORY_LOOP], { allowFailure: true });
    expect("STORY_LOOP blocked without epic_summary", t1, false);

    // Fix: record epic summary
    run(["record-epic-summary", "--identifier", "scope", "--payload", "{\"schema_version\":\"1.0.0\",\"summary_kind\":\"epic-plan\",\"run_id\":\"t\",\"identifier\":\"scope\",\"producer_skill\":\"ln-210\",\"produced_at\":\"2026-03-30T00:00:00Z\",\"payload\":{\"mode\":\"CREATE\",\"scope_identifier\":\"scope\",\"epics_created\":2,\"epics_updated\":0,\"epics_canceled\":0,\"epic_urls\":[],\"warnings\":[],\"kanban_updated\":true}}"]);

    // TEST 2: STORY_LOOP allowed with epic_summary
    const t2 = run(["advance", "--identifier", "scope", "--to", PHASES.STORY_LOOP]);
    expect("STORY_LOOP allowed with epic_summary", t2, true);

    // TEST 3: PRIORITIZATION_LOOP blocked without story_summaries
    run(["checkpoint", "--identifier", "scope", "--phase", PHASES.STORY_LOOP]);
    const t3 = run(["advance", "--identifier", "scope", "--to", PHASES.PRIORITIZATION_LOOP], { allowFailure: true });
    expect("PRIORITIZATION blocked without story_summaries", t3, false);

    // Fix: record story summaries for two epics
    run(["record-story-summary", "--identifier", "scope", "--payload", "{\"schema_version\":\"1.0.0\",\"summary_kind\":\"story-plan\",\"run_id\":\"t\",\"identifier\":\"epic-1\",\"producer_skill\":\"ln-221\",\"produced_at\":\"2026-03-30T00:00:00Z\",\"payload\":{\"mode\":\"CREATE\",\"epic_id\":\"1\",\"stories_created\":3,\"stories_updated\":0,\"stories_canceled\":0,\"story_urls\":[],\"warnings\":[],\"kanban_updated\":true}}"]);
    run(["record-story-summary", "--identifier", "scope", "--payload", "{\"schema_version\":\"1.0.0\",\"summary_kind\":\"story-plan\",\"run_id\":\"t\",\"identifier\":\"epic-2\",\"producer_skill\":\"ln-221\",\"produced_at\":\"2026-03-30T00:00:00Z\",\"payload\":{\"mode\":\"CREATE\",\"epic_id\":\"2\",\"stories_created\":2,\"stories_updated\":0,\"stories_canceled\":0,\"story_urls\":[],\"warnings\":[],\"kanban_updated\":true}}"]);

    // TEST 4: PRIORITIZATION allowed with story_summaries
    const t4 = run(["advance", "--identifier", "scope", "--to", PHASES.PRIORITIZATION_LOOP]);
    expect("PRIORITIZATION allowed with story_summaries", t4, true);

    // TEST 5: FINALIZE allowed when prioritization disabled
    run(["checkpoint", "--identifier", "scope", "--phase", PHASES.PRIORITIZATION_LOOP, "--payload", "{\"prioritization_enabled\":false}"]);
    const t5 = run(["advance", "--identifier", "scope", "--to", PHASES.FINALIZE]);
    expect("FINALIZE allowed when prioritization disabled", t5, true);

    // TEST 6: FINALIZE blocked while expected prioritization summaries are incomplete
    startScopeRun("scope-enabled");
    run(["record-epic-summary", "--identifier", "scope-enabled", "--payload", "{\"schema_version\":\"1.0.0\",\"summary_kind\":\"epic-plan\",\"run_id\":\"t\",\"identifier\":\"scope-enabled\",\"producer_skill\":\"ln-210\",\"produced_at\":\"2026-03-30T00:00:00Z\",\"payload\":{\"mode\":\"CREATE\",\"scope_identifier\":\"scope-enabled\",\"epics_created\":2,\"epics_updated\":0,\"epics_canceled\":0,\"epic_urls\":[],\"warnings\":[],\"kanban_updated\":true}}"]);
    run(["advance", "--identifier", "scope-enabled", "--to", PHASES.STORY_LOOP]);
    run(["checkpoint", "--identifier", "scope-enabled", "--phase", PHASES.STORY_LOOP]);
    run(["record-story-summary", "--identifier", "scope-enabled", "--payload", "{\"schema_version\":\"1.0.0\",\"summary_kind\":\"story-plan\",\"run_id\":\"t\",\"identifier\":\"epic-1\",\"producer_skill\":\"ln-221\",\"produced_at\":\"2026-03-30T00:00:00Z\",\"payload\":{\"mode\":\"CREATE\",\"epic_id\":\"1\",\"stories_created\":3,\"stories_updated\":0,\"stories_canceled\":0,\"story_urls\":[],\"warnings\":[],\"kanban_updated\":true}}"]);
    run(["record-story-summary", "--identifier", "scope-enabled", "--payload", "{\"schema_version\":\"1.0.0\",\"summary_kind\":\"story-plan\",\"run_id\":\"t\",\"identifier\":\"epic-2\",\"producer_skill\":\"ln-221\",\"produced_at\":\"2026-03-30T00:00:00Z\",\"payload\":{\"mode\":\"CREATE\",\"epic_id\":\"2\",\"stories_created\":2,\"stories_updated\":0,\"stories_canceled\":0,\"story_urls\":[],\"warnings\":[],\"kanban_updated\":true}}"]);
    run(["advance", "--identifier", "scope-enabled", "--to", PHASES.PRIORITIZATION_LOOP]);
    run(["checkpoint", "--identifier", "scope-enabled", "--phase", PHASES.PRIORITIZATION_LOOP, "--payload", "{\"prioritization_enabled\":true,\"expected_prioritization_epics\":[\"1\",\"2\"]}"]);
    run(["record-prioritization-summary", "--identifier", "scope-enabled", "--payload", "{\"schema_version\":\"1.0.0\",\"summary_kind\":\"story-prioritization-worker\",\"run_id\":\"child-1\",\"identifier\":\"epic-1\",\"producer_skill\":\"ln-230\",\"produced_at\":\"2026-03-30T00:00:00Z\",\"payload\":{\"epic_id\":\"1\",\"depth\":\"standard\",\"stories_analyzed\":3,\"priority_distribution\":{\"p0\":1,\"p1\":1,\"p2\":1,\"p3\":0},\"top_story_ids\":[\"s-1\"],\"prioritization_path\":\"docs/market/epic-1/prioritization.md\",\"warnings\":[],\"artifact_path\":null}}"]);
    const t6 = run(["advance", "--identifier", "scope-enabled", "--to", PHASES.FINALIZE], { allowFailure: true });
    expect("FINALIZE blocked with missing per-epic prioritization summaries", t6, false);

    // TEST 7: FINALIZE allowed once all expected prioritization summaries exist
    run(["record-prioritization-summary", "--identifier", "scope-enabled", "--payload", "{\"schema_version\":\"1.0.0\",\"summary_kind\":\"story-prioritization-worker\",\"run_id\":\"child-2\",\"identifier\":\"epic-2\",\"producer_skill\":\"ln-230\",\"produced_at\":\"2026-03-30T00:00:00Z\",\"payload\":{\"epic_id\":\"2\",\"depth\":\"standard\",\"stories_analyzed\":2,\"priority_distribution\":{\"p0\":0,\"p1\":1,\"p2\":1,\"p3\":0},\"top_story_ids\":[\"s-2\"],\"prioritization_path\":\"docs/market/epic-2/prioritization.md\",\"warnings\":[],\"artifact_path\":null}}"]);
    const t7 = run(["advance", "--identifier", "scope-enabled", "--to", PHASES.FINALIZE]);
    expect("FINALIZE allowed with complete per-epic prioritization summaries", t7, true);

    process.stdout.write(`\nscope-decomposition-runtime guards: ${passed} passed, ${failed} failed\n`);
    if (failed > 0) process.exit(1);
} finally {
    rmSync(projectRoot, { recursive: true, force: true });
}
