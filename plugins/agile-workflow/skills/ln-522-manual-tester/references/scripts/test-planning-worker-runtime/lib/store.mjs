import { resolveWorkerManifestBase, buildWorkerManifestSchema, createWorkerRuntimeStore, createWorkerState } from "../../coordinator-runtime/lib/worker-runtime.mjs";
import { testPlanningWorkerSummarySchema } from "../../coordinator-runtime/lib/schemas.mjs";
import { getWorkerPhases } from "./phases.mjs";

const testPlanningWorkerManifestSchema = buildWorkerManifestSchema("story_id", {
    task_provider: { type: "string" },
    simplified: { type: "boolean" },
});

const testPlanningWorkerStore = createWorkerRuntimeStore({
    baseRootParts: [".hex-skills", "test-planning-worker", "runtime"],
    manifestSchema: testPlanningWorkerManifestSchema,
    normalizeManifest(manifestInput, projectRoot) {
        const storyId = manifestInput.story_id || manifestInput.identifier;
        return {
            ...resolveWorkerManifestBase(manifestInput, projectRoot, "story_id", storyId),
            skill: manifestInput.skill,
            mode: manifestInput.mode || "test_planning_worker",
            task_provider: manifestInput.task_provider || "unknown",
            simplified: manifestInput.simplified === true,
        };
    },
    defaultState(manifest, runId) {
        const phases = getWorkerPhases(manifest.skill);
        return createWorkerState(manifest, runId, phases[0], {
            story_id: manifest.story_id,
            summary_kind: "test-planning-worker",
        });
    },
    summarySchema: testPlanningWorkerSummarySchema,
    summaryLabel: "test-planning worker summary",
    expectedSummaryKind: "test-planning-worker",
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
} = testPlanningWorkerStore;
