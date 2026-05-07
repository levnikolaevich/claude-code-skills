// SOURCE-OF-TRUTH: shared/scripts/docs-pipeline-runtime/lib/store.mjs. Edit ONLY here; run `node tools/marketplace/shared.mjs sync`

import { resolve } from "node:path";
import { docsGenerationWorkerSummarySchema } from "../../coordinator-runtime/lib/schemas.mjs";
import {
    createPlanningManifestSchema,
    createPlanningRuntimeStore,
    createPlanningState,
} from "../../planning-runtime/lib/store.mjs";
import { PHASES } from "./phases.mjs";

const pipelineStore = createPlanningRuntimeStore({
    baseRootParts: [".hex-skills", "docs-pipeline", "runtime"],
    manifestSchema: createPlanningManifestSchema("pipeline_id"),
    normalizeManifest(manifestInput, projectRoot) {
        return {
            skill: "ln-100",
            mode: manifestInput.mode || "docs_pipeline",
            identifier: manifestInput.identifier || "docs-pipeline",
            pipeline_id: manifestInput.pipeline_id || "docs-pipeline",
            task_provider: manifestInput.task_provider || "unknown",
            auto_approve: manifestInput.auto_approve === true,
            project_root: resolve(projectRoot || process.cwd()),
            created_at: new Date().toISOString(),
        };
    },
    defaultState(manifest, runId) {
        return createPlanningState(manifest, runId, PHASES.CONFIG, {
            pipeline_id: manifest.pipeline_id,
            source_manifest: [],
            source_mode: null,
            component_results: {},
            quality_summary: null,
            cleanup_summary: null,
        });
    },
    pausedPhase: PHASES.PAUSED,
    resumablePhases: new Set(Object.values(PHASES).filter(p => p !== PHASES.PAUSED && p !== PHASES.DONE)),
});

export const {
    checkpointPhase,
    completeRun,
    loadActiveRun,
    listActiveRuns,
    loadRun,
    pauseRun,
    readJsonFile,
    recordDecision,
    resolveRunId,
    runtimePaths,
    saveState,
    setPendingDecision,
    startRun,
    updateState,
} = pipelineStore;

export function recordComponent(projectRoot, runId, summary) {
    return pipelineStore.recordSummary(
        projectRoot,
        runId,
        summary,
        docsGenerationWorkerSummarySchema,
        "docs pipeline component summary",
        (state, nextSummary) => ({
            ...state,
            component_results: {
                ...state.component_results,
                [nextSummary.payload.worker]: nextSummary,
            },
        }),
    );
}
