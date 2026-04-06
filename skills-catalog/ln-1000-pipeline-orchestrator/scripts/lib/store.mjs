import { resolve } from "node:path";
import { computeResumeAction } from "./guards.mjs";
import { createRuntimeStore } from "../../../shared/scripts/coordinator-runtime/lib/core.mjs";
import { pipelineStageCoordinatorSummarySchema } from "../../../shared/scripts/coordinator-runtime/lib/schemas.mjs";
import { assertSchema } from "../../../shared/scripts/coordinator-runtime/lib/validate.mjs";
import { PHASES } from "./phases.mjs";

const pipelineManifestSchema = {
    type: "object",
    required: ["skill", "identifier", "story_id", "project_root", "created_at"],
        properties: {
            skill: { type: "string" },
            identifier: { type: "string" },
            story_id: { type: "string" },
            story_title: { type: "string" },
            storage_mode: { type: "string" },
            project_root: { type: "string" },
            project_brief: {},
            story_briefs: {},
            business_answers: {},
            status_cache: {},
            skill_repo_path: { type: "string" },
            worktree_dir: { type: "string" },
            branch_name: { type: "string" },
        created_at: { type: "string", format: "date-time" },
    },
};

const pipelineStore = createRuntimeStore({
    baseRootParts: [".hex-skills", "pipeline", "runtime"],
    manifestSchema: pipelineManifestSchema,
    normalizeManifest(opts, projectRoot) {
        return {
            skill: "ln-1000",
            identifier: opts.story,
            story_id: opts.story,
            story_title: opts.title || "",
            storage_mode: opts.storage || "file",
            project_root: resolve(projectRoot || process.cwd()),
            project_brief: opts.projectBrief || null,
            story_briefs: opts.storyBriefs || {},
            business_answers: opts.businessAnswers || {},
            status_cache: opts.statusCache || {},
            skill_repo_path: opts.skillRepoPath || "",
            worktree_dir: opts.worktreeDir || "",
            branch_name: opts.branchName || "",
            created_at: new Date().toISOString(),
        };
    },
    defaultState(manifest, runId) {
        return {
            run_id: runId,
            skill: manifest.skill,
            identifier: manifest.identifier,
            story_id: manifest.story_id,
            story_title: manifest.story_title,
            phase: PHASES.QUEUED,
            complete: false,
            paused_reason: null,
            pending_decision: null,
            decisions: [],
            quality_cycles: 0,
            validation_retries: 0,
            crash_count: 0,
            pipeline_start_time: new Date().toISOString(),
            project_brief: manifest.project_brief,
            story_briefs: manifest.story_briefs,
            business_answers: manifest.business_answers,
            status_cache: manifest.status_cache,
            skill_repo_path: manifest.skill_repo_path,
            worktree_dir: manifest.worktree_dir,
            branch_name: manifest.branch_name,
            stage_timestamps: {},
            stage_summaries: {},
            git_stats: {},
            readiness_scores: {},
            infra_issues: [],
            previous_quality_score: {},
            story_results: {},
            baseline_architecture: null,
            pending_architecture_delta: null,
            final_result: null,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
        };
    },
});

export const {
    checkpointPhase,
    clearActiveRun,
    completeRun,
    listActiveRuns,
    loadActiveRun,
    loadRun,
    pauseRun,
    readHistory,
    resolveRunId,
    runtimePaths,
    saveState: saveRuntimeState,
    startRun,
    updateState,
} = pipelineStore;

export function pipelineDir(projectRoot) {
    return pipelineStore.baseRoot(projectRoot);
}

export function loadState(projectRoot, storyId) {
    const runId = resolveRunId(projectRoot, "ln-1000", null, storyId);
    if (!runId) {
        return null;
    }
    return loadRun(projectRoot, runId)?.state || null;
}

export function loadCheckpoint(projectRoot, storyId) {
    const runId = resolveRunId(projectRoot, "ln-1000", null, storyId);
    if (!runId) {
        return null;
    }
    const run = loadRun(projectRoot, runId);
    if (!run) {
        return null;
    }
    return run.checkpoints[run.state.phase] || null;
}

export function saveState(projectRoot, state) {
    return saveRuntimeState(projectRoot, state.run_id, state);
}

export function saveCheckpoint(projectRoot, storyId, checkpoint) {
    const runId = resolveRunId(projectRoot, "ln-1000", null, storyId);
    if (!runId) {
        return { ok: false, error: "No active pipeline run found" };
    }
    const phase = `STAGE_${checkpoint.stage}`;
    return checkpointPhase(projectRoot, runId, phase, checkpoint);
}

export function recordStageSummary(projectRoot, storyId, summary) {
    const runId = resolveRunId(projectRoot, "ln-1000", null, storyId);
    if (!runId) {
        return { ok: false, error: "No active pipeline run found" };
    }
    const run = loadRun(projectRoot, runId);
    if (!run) {
        return { ok: false, error: "Run not found" };
    }
    const validation = assertSchema(pipelineStageCoordinatorSummarySchema, summary, "pipeline stage coordinator summary");
    if (!validation.ok) {
        return validation;
    }
    return updateState(projectRoot, runId, state => ({
        ...state,
        stage_summaries: {
            ...(state.stage_summaries || {}),
            [`stage_${summary.payload.stage}`]: summary,
        },
    }));
}

export function getStatus(projectRoot, storyId) {
    const runId = resolveRunId(projectRoot, "ln-1000", null, storyId);
    if (!runId) {
        return { ok: true, active: false };
    }
    const run = loadRun(projectRoot, runId);
    if (!run) {
        return { ok: true, active: false };
    }
    return {
        ok: true,
        active: !run.state.complete,
        manifest: run.manifest,
        state: run.state,
        checkpoints: run.checkpoints,
        paths: runtimePaths(projectRoot, runId, "ln-1000", run.manifest.identifier),
        resume_action: computeResumeAction(run.state, run.checkpoints),
    };
}

export function cancelRun(projectRoot, storyId, reason) {
    const runId = resolveRunId(projectRoot, "ln-1000", null, storyId);
    if (!runId) {
        return { ok: false, error: "No active pipeline run found" };
    }
    const run = loadRun(projectRoot, runId);
    if (!run) {
        return { ok: false, error: "Run not found" };
    }
    const result = updateState(projectRoot, run.state.run_id, state => ({
        ...state,
        phase: "DONE",
        complete: true,
        paused_reason: reason || "Canceled",
        final_result: "CANCELED",
    }), { eventType: "RUN_COMPLETED" });
    if (!result.ok) {
        return result;
    }
    clearActiveRun(projectRoot, run.state.skill, run.state.identifier, run.state.run_id);
    return result;
}
