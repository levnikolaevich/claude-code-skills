import { resolve } from "node:path";
import {
    createRuntimeStore,
    fileExists,
    readJsonFile,
    resolveTrackedPath,
} from "../../coordinator-runtime/lib/core.mjs";
import { recordCoordinatorSummaryState } from "../../planning-runtime/lib/store.mjs";
import { REVIEW_AGENT_STATUSES } from "../../coordinator-runtime/lib/runtime-constants.mjs";
import {
    pipelineStageCoordinatorSummarySchema,
    reviewAgentRecordSchema,
} from "../../coordinator-runtime/lib/schemas.mjs";
import { assertSchema } from "../../coordinator-runtime/lib/validate.mjs";
import { PHASES } from "./phases.mjs";

const reviewManifestSchema = {
    type: "object",
    required: ["skill", "mode", "identifier", "project_root", "created_at"],
    properties: {
        skill: { type: "string" },
        mode: { type: "string" },
        identifier: { type: "string" },
        storage_mode: { type: "string" },
        project_root: { type: "string" },
        story_ref: {},
        plan_ref: {},
        context_ref: {},
        expected_agents: { type: "array", items: { type: "string" } },
        artifact_paths: { type: "object" },
        phase_policy: { type: "object" },
        created_at: { type: "string", format: "date-time" },
    },
};

const reviewStore = createRuntimeStore({
    baseRootParts: [".hex-skills", "agent-review", "runtime"],
    manifestSchema: reviewManifestSchema,
    normalizeManifest(manifestInput, projectRoot) {
        return {
            skill: manifestInput.skill,
            mode: manifestInput.mode,
            identifier: manifestInput.identifier,
            storage_mode: manifestInput.storage_mode || "unknown",
            project_root: resolve(projectRoot || process.cwd()),
            story_ref: manifestInput.story_ref || null,
            plan_ref: manifestInput.plan_ref || null,
            context_ref: manifestInput.context_ref || null,
            expected_agents: manifestInput.expected_agents || [],
            artifact_paths: manifestInput.artifact_paths || {},
            phase_policy: manifestInput.phase_policy || {},
            created_at: new Date().toISOString(),
        };
    },
    defaultState(manifest, runId) {
        return {
            run_id: runId,
            skill: manifest.skill,
            mode: manifest.mode,
            identifier: manifest.identifier,
            phase: PHASES.CONFIG,
            complete: false,
            paused_reason: null,
            pending_decision: null,
            decisions: [],
            health_check_done: false,
            agents_required: [],
            agents_available: 0,
            agents_skipped_reason: null,
            launch_ready: false,
            docs_checkpoint: null,
            merge_summary: null,
            refinement_iterations: 0,
            refinement_exit_reason: null,
            refinement_applied: 0,
            self_check_passed: false,
            processes_verified_dead: false,
            final_result: null,
            final_verdict: null,
            agents: {},
            stage_summary: null,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
        };
    },
});

export const {
    checkpointPhase,
    completeRun,
    loadActiveRun,
    listActiveRuns,
    loadRun,
    pauseRun,
    resolveRunId,
    runtimePaths,
    saveState,
    startRun,
    updateState,
} = reviewStore;

export function registerAgent(projectRoot, runId, agentRecord) {
    const run = loadRun(projectRoot, runId);
    if (!run) {
        return { ok: false, error: "Run not found" };
    }
    const validation = assertSchema(reviewAgentRecordSchema, agentRecord, "review agent record");
    if (!validation.ok) {
        return validation;
    }
    return updateState(projectRoot, runId, state => ({
        ...state,
        launch_ready: true,
        agents: {
            ...state.agents,
            [agentRecord.name]: {
                name: agentRecord.name,
                status: agentRecord.status || REVIEW_AGENT_STATUSES.LAUNCHED,
                prompt_file: agentRecord.prompt_file || null,
                result_file: agentRecord.result_file || null,
                log_file: agentRecord.log_file || null,
                metadata_file: agentRecord.metadata_file || null,
                pid: agentRecord.pid || null,
                session_id: agentRecord.session_id || null,
                started_at: agentRecord.started_at || null,
                finished_at: agentRecord.finished_at || null,
                exit_code: agentRecord.exit_code ?? null,
                error: agentRecord.error || null,
            },
        },
    }));
}

export function recordStageSummary(projectRoot, runId, summary) {
    return recordCoordinatorSummaryState({
        projectRoot,
        runId,
        summary,
        schema: pipelineStageCoordinatorSummarySchema,
        label: "pipeline stage coordinator summary",
        stateKey: "stage_summary",
        loadRun,
        updateState,
        artifactIdentifier: nextSummary => `${nextSummary.identifier}-stage-${nextSummary.payload.stage}`,
    });
}

export {
    fileExists,
    readJsonFile,
    resolveTrackedPath,
};
