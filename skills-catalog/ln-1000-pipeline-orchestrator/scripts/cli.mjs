#!/usr/bin/env node

import { parseArgs } from "node:util";
import {
    cancelRun,
    checkpointPhase,
    completeRun,
    getStatus,
    listActiveRuns,
    loadRun,
    pauseRun,
    recordStageSummary,
    resolveRunId,
    saveState,
    startRun,
} from "./lib/store.mjs";
import { captureBaseline, computeDelta } from "./lib/arch-snapshot.mjs";
import { computeResumeAction, validateTransition } from "./lib/guards.mjs";
import { PHASES } from "./lib/phases.mjs";
import {
    failJson as fail,
    outputJson as output,
} from "../../shared/scripts/coordinator-runtime/lib/cli-helpers.mjs";

const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
        story: { type: "string" },
        title: { type: "string" },
        to: { type: "string" },
        stage: { type: "string" },
        storage: { type: "string" },
        reason: { type: "string" },
        payload: { type: "string" },
        force: { type: "boolean", default: false },
        resolve: { type: "boolean", default: false },
        "plan-score": { type: "string" },
        readiness: { type: "string" },
        verdict: { type: "string" },
        "quality-score": { type: "string" },
        issues: { type: "string" },
        "last-action": { type: "string" },
        "tasks-completed": { type: "string" },
        "tasks-remaining": { type: "string" },
        "agents-info": { type: "string" },
        "git-stats": { type: "string" },
        "project-brief": { type: "string" },
        "story-briefs": { type: "string" },
        "business-answers": { type: "string" },
        "status-cache": { type: "string" },
        "skill-repo-path": { type: "string" },
        "worktree-dir": { type: "string" },
        "branch-name": { type: "string" },
    },
});

const command = positionals[0];

function tryParse(str) {
    try {
        return JSON.parse(str);
    } catch {
        return str;
    }
}

function resolvePipelineRun(projectRoot) {
    const runId = resolveRunId(projectRoot, "ln-1000", null, values.story);
    if (!runId) {
        const activeRuns = listActiveRuns(projectRoot, "ln-1000");
        if (activeRuns.length > 1 && !values.story) {
            fail("Multiple active pipeline runs found. Pass --story.");
        }
        fail("No active pipeline run found. Pass --story.");
    }
    const run = loadRun(projectRoot, runId);
    if (!run) {
        fail(`Run not found: ${runId}`);
    }
    return { runId, run };
}

async function main() {
    switch (command) {
        case "start": {
            if (!values.story) {
                fail("start requires --story");
            }
            const result = startRun(null, {
                story: values.story,
                title: values.title,
                storage: values.storage,
                projectBrief: tryParse(values["project-brief"]),
                storyBriefs: tryParse(values["story-briefs"]),
                businessAnswers: tryParse(values["business-answers"]),
                statusCache: tryParse(values["status-cache"]),
                skillRepoPath: values["skill-repo-path"],
                worktreeDir: values["worktree-dir"],
                branchName: values["branch-name"],
            });
            if (!result.ok && result.recovery) {
                output({
                    recovery: true,
                    manifest: result.run.manifest,
                    state: result.run.state,
                    checkpoints: result.run.checkpoints,
                    resume_action: computeResumeAction(result.run.state, result.run.checkpoints),
                });
                return;
            }
            if (!result.ok) {
                fail(result.error);
            }
            output(result);
            return;
        }

        case "status": {
            if (!values.story) {
                const activeRuns = listActiveRuns(process.cwd(), "ln-1000");
                if (activeRuns.length > 1) {
                    output({ ok: false, error: "Multiple active pipeline runs found. Pass --story." });
                    process.exit(1);
                }
            }
            output(getStatus(null, values.story));
            return;
        }

        case "advance": {
            if (!values.to) {
                fail("advance requires --to");
            }
            const { runId, run } = resolvePipelineRun(process.cwd());

            if (run.state.phase === PHASES.PAUSED && (values.resolve || values.force)) {
                const resumed = saveState(null, {
                    ...run.state,
                    phase: values.to,
                    paused_reason: null,
                });
                output({ ok: true, state: resumed, resumed_from: "PAUSED" });
                return;
            }

            const mutableState = { ...run.state };
            const guard = validateTransition(mutableState, values.to, run.checkpoints);
            if (!guard.ok) {
                output({ ok: false, ...guard });
                process.exit(1);
            }

            if (values.to === PHASES.STAGE_2 && run.state.phase !== PHASES.STAGE_2) {
                const baseline = await captureBaseline(process.cwd());
                if (baseline) {
                    mutableState.baseline_architecture = baseline;
                }
            }

            if (values.to === PHASES.STAGE_3) {
                const delta = await computeDelta(mutableState.baseline_architecture || null, process.cwd());
                if (delta) {
                    mutableState.pending_architecture_delta = delta;
                }
            }

            const nextState = {
                ...mutableState,
                phase: values.to,
                complete: values.to === PHASES.DONE,
                paused_reason: null,
            };

            if (values.to.startsWith("STAGE_")) {
                const stageNum = values.to.replace("STAGE_", "");
                nextState.stage_timestamps = nextState.stage_timestamps || {};
                nextState.stage_timestamps[`stage_${stageNum}_start`] = new Date().toISOString();
            }

            const saved = saveState(null, nextState);
            output({
                ok: true,
                previous_phase: run.state.phase,
                current_phase: values.to,
                counter_incremented: guard.counter_incremented || null,
                state: saved,
                run_id: runId,
            });
            return;
        }

        case "checkpoint": {
            if (values.stage == null) {
                fail("checkpoint requires --stage");
            }
            const stage = parseInt(values.stage, 10);
            const phase = `STAGE_${stage}`;
            const { runId, run } = resolvePipelineRun(process.cwd());

            const nextState = {
                ...run.state,
                stage_timestamps: {
                    ...(run.state.stage_timestamps || {}),
                    [`stage_${stage}_end`]: new Date().toISOString(),
                },
            };

            const checkpoint = {
                stage,
                started_at: nextState.stage_timestamps[`stage_${stage}_start`] || new Date().toISOString(),
                completed_at: new Date().toISOString(),
                tasks_completed: tryParse(values["tasks-completed"]) || [],
                tasks_remaining: tryParse(values["tasks-remaining"]) || [],
                last_action: values["last-action"] || "",
            };

            if (values["plan-score"] != null) checkpoint.plan_score = parseFloat(values["plan-score"]);
            if (values.readiness != null) checkpoint.readiness = parseFloat(values.readiness);
            if (values.verdict != null) checkpoint.verdict = values.verdict;
            if (values.reason != null) checkpoint.reason = values.reason;
            if (values["quality-score"] != null) checkpoint.quality_score = parseFloat(values["quality-score"]);
            if (values.issues != null) checkpoint.issues = values.issues;
            if (values["agents-info"] != null) checkpoint.agents_info = values["agents-info"];
            if (values["git-stats"] != null) checkpoint.git_stats = tryParse(values["git-stats"]);

            if (nextState.pending_architecture_delta) {
                checkpoint.architecture_delta = nextState.pending_architecture_delta;
                nextState.pending_architecture_delta = null;
            }

            const checkpointed = checkpointPhase(null, runId, phase, checkpoint);
            if (!checkpointed.ok) {
                fail(checkpointed.error);
            }
            const saved = saveState(null, nextState);
            output({
                ok: true,
                phase,
                story_id: saved.story_id,
                checkpoint: checkpointed.checkpoints[phase],
            });
            return;
        }

        case "record-stage-summary": {
            if (!values.story) {
                fail("record-stage-summary requires --story");
            }
            const payload = tryParse(values.payload);
            if (!payload || typeof payload !== "object") {
                fail("record-stage-summary requires --payload with a coordinator summary envelope");
            }
            const result = recordStageSummary(null, values.story, payload);
            if (!result.ok) {
                fail(result.error);
            }
            output(result);
            return;
        }

        case "pause": {
            if (!values.reason) {
                fail("pause requires --reason");
            }
            const { runId } = resolvePipelineRun(process.cwd());
            const result = pauseRun(null, runId, values.reason);
            if (!result.ok) {
                fail(result.error);
            }
            output(result);
            return;
        }

        case "cancel": {
            const result = cancelRun(null, values.story, values.reason || "Canceled by user");
            if (!result.ok) {
                fail(result.error);
            }
            output(result);
            return;
        }

        case "complete": {
            const { runId, run } = resolvePipelineRun(process.cwd());
            const guard = validateTransition(run.state, "DONE", run.checkpoints);
            if (!guard.ok) {
                output({ ok: false, ...guard });
                process.exit(1);
            }
            const result = completeRun(null, runId);
            if (!result.ok) {
                fail(result.error);
            }
            output(result);
            return;
        }

        default:
            fail("Unknown command: start, status, advance, checkpoint, record-stage-summary, pause, cancel, complete");
    }
}

main().catch(error => fail(error.message));
