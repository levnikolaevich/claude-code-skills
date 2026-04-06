import { resolve } from "node:path";
import {
    createRuntimeStore,
    readJsonFile,
} from "../../coordinator-runtime/lib/core.mjs";
import {
    pipelineStageCoordinatorSummarySchema,
    storyGroupRecordSchema,
    taskStatusWorkerSummarySchema,
} from "../../coordinator-runtime/lib/schemas.mjs";
import { writeRuntimeArtifactJson } from "../../coordinator-runtime/lib/artifacts.mjs";
import {
    STORY_EXECUTION_GROUP_STATUSES,
    TASK_BOARD_STATUSES,
} from "../../coordinator-runtime/lib/runtime-constants.mjs";
import { assertSchema } from "../../coordinator-runtime/lib/validate.mjs";
import { PHASES } from "./phases.mjs";

const TASK_REVIEW_WORKER = "ln-402";
const TASK_LEDGER_PRIORITY = Object.freeze([
    TASK_REVIEW_WORKER,
    "ln-403",
    "ln-404",
    "ln-401",
]);

const executionManifestSchema = {
    type: "object",
    required: ["skill", "identifier", "story_id", "project_root", "created_at"],
    properties: {
        skill: { type: "string" },
        mode: { type: "string" },
        identifier: { type: "string" },
        story_id: { type: "string" },
        task_provider: { type: "string" },
        project_root: { type: "string" },
        worktree_dir: { type: "string" },
        branch: { type: "string" },
        execution_mode: { type: "string" },
        task_inventory_snapshot: { type: "array" },
        parallel_group_policy: { type: "object" },
        status_transition_policy: { type: "object" },
        created_at: { type: "string", format: "date-time" },
    },
};

const executionStore = createRuntimeStore({
    baseRootParts: [".hex-skills", "story-execution", "runtime"],
    manifestSchema: executionManifestSchema,
    normalizeManifest(manifestInput, projectRoot) {
        return {
            skill: "ln-400",
            mode: manifestInput.mode || "story_execution",
            identifier: manifestInput.story_id || manifestInput.identifier,
            story_id: manifestInput.story_id || manifestInput.identifier,
            task_provider: manifestInput.task_provider || "unknown",
            project_root: resolve(projectRoot || process.cwd()),
            worktree_dir: manifestInput.worktree_dir || null,
            branch: manifestInput.branch || null,
            execution_mode: manifestInput.execution_mode || "execute",
            task_inventory_snapshot: manifestInput.task_inventory_snapshot || [],
            parallel_group_policy: manifestInput.parallel_group_policy || {},
            status_transition_policy: manifestInput.status_transition_policy || {},
            created_at: new Date().toISOString(),
        };
    },
    defaultState(manifest, runId) {
        return {
            run_id: runId,
            skill: manifest.skill,
            mode: manifest.mode,
            identifier: manifest.identifier,
            story_id: manifest.story_id,
            phase: PHASES.CONFIG,
            complete: false,
            paused_reason: null,
            pending_decision: null,
            decisions: [],
            current_task_id: null,
            current_group_id: null,
            processable_counts: {
                todo: 0,
                to_review: 0,
                to_rework: 0,
            },
            rework_counter_by_task: {},
            inflight_workers: {},
            worker_results_by_task: {},
            tasks: {},
            groups: {},
            worktree_ready: false,
            worktree_dir: manifest.worktree_dir,
            branch: manifest.branch,
            story_transition_done: false,
            stage_summary: null,
            self_check_passed: false,
            final_result: null,
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
} = executionStore;

function selectTaskLedgerSummary(workerResultsBySkill = {}) {
    for (const worker of TASK_LEDGER_PRIORITY) {
        if (workerResultsBySkill[worker]) {
            return workerResultsBySkill[worker];
        }
    }
    return null;
}

function buildTaskLedgerEntry(taskId, workerResultsBySkill = {}, existingEntry = null) {
    const selectedSummary = selectTaskLedgerSummary(workerResultsBySkill);
    if (!selectedSummary) {
        return existingEntry;
    }
    const payload = selectedSummary.payload || {};
    return {
        task_id: taskId,
        worker: payload.worker || selectedSummary.producer_skill || null,
        result: payload.result || null,
        from_status: payload.from_status || null,
        to_status: payload.to_status || null,
        tests_run: payload.tests_run || [],
        files_changed: payload.files_changed || [],
        issues: payload.issues || [],
        score: payload.score ?? null,
        comment_path: payload.comment_path || null,
        error: payload.error || null,
        completed_at: selectedSummary.produced_at || new Date().toISOString(),
    };
}

function isSameSummary(previousSummary, nextSummary) {
    return previousSummary?.producer_skill === nextSummary?.producer_skill
        && previousSummary?.produced_at === nextSummary?.produced_at
        && previousSummary?.payload?.to_status === nextSummary?.payload?.to_status;
}

function applyReviewOutcomeToCounters(nextCounters, taskId, previousSummary, summary) {
    if (!summary || summary.producer_skill !== TASK_REVIEW_WORKER) {
        return nextCounters;
    }
    if (isSameSummary(previousSummary, summary)) {
        return nextCounters;
    }
    const toStatus = summary.payload?.to_status;
    if (toStatus === TASK_BOARD_STATUSES.TO_REWORK) {
        return {
            ...nextCounters,
            [taskId]: Number(nextCounters[taskId] || 0) + 1,
        };
    }
    if (toStatus === TASK_BOARD_STATUSES.DONE) {
        return {
            ...nextCounters,
            [taskId]: 0,
        };
    }
    return nextCounters;
}

export function recordWorker(projectRoot, runId, taskId, summary) {
    const run = loadRun(projectRoot, runId);
    if (!run) {
        return { ok: false, error: "Run not found" };
    }
    if (summary?.run_id !== runId) {
        return { ok: false, error: `Worker summary run_id must match runtime run_id (${runId})` };
    }
    if (summary?.identifier !== taskId) {
        return { ok: false, error: `Worker summary identifier must match task_id (${taskId})` };
    }
    const validation = assertSchema(taskStatusWorkerSummarySchema, summary, "task-status worker summary");
    if (!validation.ok) {
        return validation;
    }
    return updateState(projectRoot, runId, state => {
        const artifactPath = writeRuntimeArtifactJson(projectRoot, runId, summary.summary_kind, summary.identifier, summary);
        const nextSummary = {
            ...summary,
            payload: {
                ...summary.payload,
                artifact_path: artifactPath,
            },
        };
        const previousTaskResults = state.worker_results_by_task?.[taskId] || {};
        const nextTaskResults = {
            ...previousTaskResults,
            [nextSummary.producer_skill]: nextSummary,
        };
        const nextCounters = applyReviewOutcomeToCounters(
            { ...state.rework_counter_by_task },
            taskId,
            previousTaskResults[TASK_REVIEW_WORKER] || null,
            nextSummary,
        );
        return {
            ...state,
            current_task_id: taskId,
            worker_results_by_task: {
                ...state.worker_results_by_task,
                [taskId]: nextTaskResults,
            },
            tasks: {
                ...state.tasks,
                [taskId]: buildTaskLedgerEntry(taskId, nextTaskResults, state.tasks?.[taskId] || null),
            },
            rework_counter_by_task: nextCounters,
        };
    });
}

export function recordGroup(projectRoot, runId, groupRecord) {
    const run = loadRun(projectRoot, runId);
    if (!run) {
        return { ok: false, error: "Run not found" };
    }
    const validation = assertSchema(storyGroupRecordSchema, groupRecord, "story group record");
    if (!validation.ok) {
        return validation;
    }
    return updateState(projectRoot, runId, state => ({
        ...state,
        current_group_id: groupRecord.group_id,
        inflight_workers: groupRecord.inflight_workers || {},
        groups: {
            ...state.groups,
            [groupRecord.group_id]: {
                group_id: groupRecord.group_id,
                task_ids: groupRecord.task_ids || [],
                status: groupRecord.status || STORY_EXECUTION_GROUP_STATUSES.COMPLETED,
                result: groupRecord.result || null,
                completed_at: groupRecord.completed_at || new Date().toISOString(),
            },
        },
    }));
}

export function recordStageSummary(projectRoot, runId, summary) {
    const run = loadRun(projectRoot, runId);
    if (!run) {
        return { ok: false, error: "Run not found" };
    }
    if (summary?.run_id !== runId) {
        return { ok: false, error: `Stage summary run_id must match runtime run_id (${runId})` };
    }
    const validation = assertSchema(pipelineStageCoordinatorSummarySchema, summary, "pipeline stage coordinator summary");
    if (!validation.ok) {
        return validation;
    }
    return updateState(projectRoot, runId, state => {
        const artifactIdentifier = `${summary.identifier}-stage-${summary.payload.stage}`;
        const artifactPath = writeRuntimeArtifactJson(projectRoot, runId, summary.summary_kind, artifactIdentifier, summary);
        return {
            ...state,
            stage_summary: {
                ...summary,
                payload: {
                    ...summary.payload,
                    artifact_path: artifactPath,
                },
            },
        };
    });
}

export {
    readJsonFile,
};
