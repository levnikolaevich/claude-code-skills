import { resolve } from "node:path";
import {
    createRuntimeStore,
    readJsonFile,
} from "../../coordinator-runtime/lib/core.mjs";
import {
    docsGenerationWorkerSummarySchema,
} from "../../coordinator-runtime/lib/schemas.mjs";
import { assertSchema } from "../../coordinator-runtime/lib/validate.mjs";
import { PHASES } from "./phases.mjs";

const manifestSchema = {
    type: "object",
    required: ["skill", "identifier", "project_root", "created_at"],
    properties: {
        skill: { type: "string" },
        mode: { type: "string" },
        identifier: { type: "string" },
        project_root: { type: "string" },
        expected_workers: {
            type: "array",
            items: { type: "string" },
        },
        created_at: { type: "string", format: "date-time" },
    },
};

const docsStore = createRuntimeStore({
    baseRootParts: [".hex-skills", "docs", "runtime"],
    manifestSchema,
    normalizeManifest(manifestInput, projectRoot) {
        return {
            skill: "ln-110",
            mode: manifestInput.mode || "docs_generation",
            identifier: manifestInput.identifier || "project-docs",
            project_root: resolve(projectRoot || process.cwd()),
            expected_workers: manifestInput.expected_workers || [],
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
            context_ready: false,
            detected_flags: null,
            worker_plan: manifest.expected_workers || [],
            worker_results: {},
            quality_inputs: null,
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
} = docsStore;

export { readJsonFile };

export function recordWorker(projectRoot, runId, summary) {
    const run = loadRun(projectRoot, runId);
    if (!run) {
        return { ok: false, error: "Run not found" };
    }
    const validation = assertSchema(docsGenerationWorkerSummarySchema, summary, "docs-generation worker summary");
    if (!validation.ok) {
        return validation;
    }
    return updateState(projectRoot, runId, state => ({
        ...state,
        worker_results: {
            ...state.worker_results,
            [summary.payload.worker]: summary,
        },
    }));
}
