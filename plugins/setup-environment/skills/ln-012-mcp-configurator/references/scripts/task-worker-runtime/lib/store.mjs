import { resolveWorkerManifestBase, buildWorkerManifestSchema, createWorkerRuntimeStore, createWorkerState } from "../../coordinator-runtime/lib/worker-runtime.mjs";
import { taskStatusWorkerSummarySchema } from "../../coordinator-runtime/lib/schemas.mjs";
import { getWorkerPhases } from "./phases.mjs";
import { validateTaskSummaryForSkill } from "./guards.mjs";

const taskWorkerManifestSchema = buildWorkerManifestSchema("task_id", {
    task_provider: { type: "string" },
    story_id: { type: ["string", "null"] },
});

const taskWorkerStore = createWorkerRuntimeStore({
    baseRootParts: [".hex-skills", "task-worker", "runtime"],
    manifestSchema: taskWorkerManifestSchema,
    normalizeManifest(manifestInput, projectRoot) {
        const taskId = manifestInput.task_id || manifestInput.identifier;
        return {
            ...resolveWorkerManifestBase(manifestInput, projectRoot, "task_id", taskId),
            skill: manifestInput.skill,
            mode: manifestInput.mode || "task_worker",
            task_provider: manifestInput.task_provider || "unknown",
            story_id: manifestInput.story_id || null,
        };
    },
    defaultState(manifest, runId) {
        const phases = getWorkerPhases(manifest.skill);
        return createWorkerState(manifest, runId, phases[0], {
            task_id: manifest.task_id,
            story_id: manifest.story_id,
            summary_kind: "task-status",
        });
    },
    summarySchema: taskStatusWorkerSummarySchema,
    summaryLabel: "task worker summary",
    expectedSummaryKind: "task-status",
    buildArtifactFileName(manifest) {
        return `${manifest.task_id}--${manifest.skill}.json`;
    },
    validateSummary: validateTaskSummaryForSkill,
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
} = taskWorkerStore;
