import { resolve } from "node:path";
import { createRuntimeStore, readJsonFile } from "../../coordinator-runtime/lib/core.mjs";
import {
    modernizationCoordinatorSummarySchema,
    modernizationWorkerSummarySchema,
} from "../../coordinator-runtime/lib/schemas.mjs";
import { writeRuntimeArtifactJson } from "../../coordinator-runtime/lib/artifacts.mjs";
import { assertSchema } from "../../coordinator-runtime/lib/validate.mjs";
import { PHASES } from "./phases.mjs";

const manifestSchema = {
    type: "object",
    required: ["skill", "identifier", "project_root", "created_at"],
    additionalProperties: false,
    properties: {
        skill: { type: "string", minLength: 1 },
        mode: { type: "string" },
        identifier: { type: "string", minLength: 1 },
        project_root: { type: "string", minLength: 1 },
        created_at: { type: "string", format: "date-time" },
    },
};

const modernizationStore = createRuntimeStore({
    baseRootParts: [".hex-skills", "modernization", "runtime"],
    manifestSchema,
    normalizeManifest(manifestInput, projectRoot) {
        return {
            skill: "ln-830",
            mode: manifestInput.mode || "modernization",
            identifier: manifestInput.identifier,
            project_root: resolve(projectRoot || process.cwd()),
            created_at: new Date().toISOString(),
        };
    },
    defaultState(manifest, runId) {
        return {
            run_id: runId,
            skill: manifest.skill,
            mode: manifest.mode,
            identifier: manifest.identifier,
            phase: PHASES.PREFLIGHT,
            complete: false,
            paused_reason: null,
            pending_decision: null,
            decisions: [],
            final_result: null,
            worker_plan: [],
            worker_results: {},
            child_runs: {},
            verification_passed: false,
            report_ready: false,
            report_path: null,
            summary_recorded: false,
            summary_artifact_path: null,
            summary: null,
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
} = modernizationStore;

export { readJsonFile };

export function recordWorkerResult(projectRoot, runId, summary) {
    const run = loadRun(projectRoot, runId);
    if (!run) {
        return { ok: false, error: "Run not found" };
    }
    const validation = assertSchema(modernizationWorkerSummarySchema, summary, "modernization worker summary");
    if (!validation.ok) {
        return validation;
    }
    return updateState(projectRoot, runId, state => ({
        ...state,
        worker_results: {
            ...state.worker_results,
            [summary.producer_skill]: summary,
        },
    }));
}

export function recordSummary(projectRoot, runId, summary) {
    const run = loadRun(projectRoot, runId);
    if (!run) {
        return { ok: false, error: "Run not found" };
    }
    if (summary?.run_id !== runId) {
        return { ok: false, error: `Modernization coordinator summary run_id must match runtime run_id (${runId})` };
    }
    const validation = assertSchema(modernizationCoordinatorSummarySchema, summary, "modernization coordinator summary");
    if (!validation.ok) {
        return validation;
    }
    return updateState(projectRoot, runId, state => {
        const artifactIdentifier = `${summary.producer_skill}--${summary.identifier}`;
        const artifactPath = writeRuntimeArtifactJson(projectRoot, runId, summary.summary_kind, artifactIdentifier, summary);
        return {
            ...state,
            summary_recorded: true,
            summary_artifact_path: artifactPath,
            summary: {
                ...summary,
                payload: {
                    ...summary.payload,
                    artifact_path: artifactPath,
                },
            },
        };
    });
}
