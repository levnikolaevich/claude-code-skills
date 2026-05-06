import { resolveWorkerManifestBase, buildWorkerManifestSchema, createWorkerRuntimeStore, createWorkerState } from "../../coordinator-runtime/lib/worker-runtime.mjs";
import { taskPlanWorkerSummarySchema } from "../../coordinator-runtime/lib/schemas.mjs";
import { getWorkerPhases } from "./phases.mjs";

const taskPlanWorkerManifestSchema = buildWorkerManifestSchema("story_id", {
    task_provider: { type: "string" },
    task_type: { type: "string" },
    auto_approve: { type: "boolean" },
});

const taskPlanWorkerStore = createWorkerRuntimeStore({
    baseRootParts: [".hex-skills", "task-plan-worker", "runtime"],
    manifestSchema: taskPlanWorkerManifestSchema,
    normalizeManifest(manifestInput, projectRoot) {
        const storyId = manifestInput.story_id || manifestInput.identifier;
        return {
            ...resolveWorkerManifestBase(manifestInput, projectRoot, "story_id", storyId),
            skill: manifestInput.skill,
            mode: manifestInput.mode || "task_plan_worker",
            task_provider: manifestInput.task_provider || "unknown",
            task_type: manifestInput.task_type || "implementation",
            auto_approve: manifestInput.auto_approve === true,
        };
    },
    defaultState(manifest, runId) {
        const phases = getWorkerPhases(manifest.skill);
        return createWorkerState(manifest, runId, phases[0], {
            story_id: manifest.story_id,
            task_type: manifest.task_type,
            summary_kind: "task-plan",
        });
    },
    summarySchema: taskPlanWorkerSummarySchema,
    summaryLabel: "task-plan worker summary",
    expectedSummaryKind: "task-plan",
    buildArtifactFileName(manifest) {
        return `${manifest.skill}--${manifest.story_id}.json`;
    },
});

export const {
    checkpointPhase,
    completeRun,
    loadActiveRun,
    listActiveRuns,
    loadRun,
    pauseRun,
    recordSummary,
    resolveRunId,
    runtimePaths,
    saveState,
    startRun,
    updateState,
    readJsonFile,
} = taskPlanWorkerStore;
