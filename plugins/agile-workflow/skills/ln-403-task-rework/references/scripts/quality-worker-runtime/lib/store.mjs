import { resolveWorkerManifestBase, buildWorkerManifestSchema, createWorkerRuntimeStore, createWorkerState } from "../../coordinator-runtime/lib/worker-runtime.mjs";
import { qualityWorkerSummarySchema } from "../../coordinator-runtime/lib/schemas.mjs";
import { getWorkerPhases } from "./phases.mjs";

const qualityWorkerManifestSchema = buildWorkerManifestSchema("story_id", {
    task_provider: { type: "string" },
    fast_track: { type: "boolean" },
});

const qualityWorkerStore = createWorkerRuntimeStore({
    baseRootParts: [".hex-skills", "quality-worker", "runtime"],
    manifestSchema: qualityWorkerManifestSchema,
    normalizeManifest(manifestInput, projectRoot) {
        const storyId = manifestInput.story_id || manifestInput.identifier;
        return {
            ...resolveWorkerManifestBase(manifestInput, projectRoot, "story_id", storyId),
            skill: manifestInput.skill,
            mode: manifestInput.mode || "quality_worker",
            task_provider: manifestInput.task_provider || "unknown",
            fast_track: manifestInput.fast_track === true,
        };
    },
    defaultState(manifest, runId) {
        const phases = getWorkerPhases(manifest.skill);
        return createWorkerState(manifest, runId, phases[0], {
            story_id: manifest.story_id,
            summary_kind: "quality-worker",
        });
    },
    summarySchema: qualityWorkerSummarySchema,
    summaryLabel: "quality worker summary",
    expectedSummaryKind: "quality-worker",
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
} = qualityWorkerStore;
