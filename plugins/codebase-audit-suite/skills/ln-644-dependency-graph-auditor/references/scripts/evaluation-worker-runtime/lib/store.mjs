import {
    buildWorkerManifestSchema,
    createWorkerRuntimeStore,
    createWorkerState,
    resolveWorkerManifestBase,
} from "../../coordinator-runtime/lib/worker-runtime.mjs";
import { evaluationWorkerSummarySchema } from "../../coordinator-runtime/lib/schemas.mjs";

const ALLOWED_SUMMARY_KINDS = new Set([
    "evaluation-worker",
    "review-research",
    "review-findings",
    "review-docs",
    "review-repair",
    "review-merge",
    "review-refinement",
]);

const evaluationWorkerManifestSchema = buildWorkerManifestSchema("evaluation_identifier", {
    phase_order: {
        type: "array",
        minItems: 1,
        items: { type: "string", minLength: 1 },
    },
    summary_kind: { type: "string" },
    codebase_root: { type: "string" },
    output_dir: { type: ["string", "null"] },
    report_path: { type: ["string", "null"] },
    operation: { type: ["string", "null"] },
    metadata: { type: "object" },
}, ["evaluation_identifier", "phase_order"]);

const evaluationWorkerStore = createWorkerRuntimeStore({
    baseRootParts: [".hex-skills", "evaluation-worker", "runtime"],
    manifestSchema: evaluationWorkerManifestSchema,
    normalizeManifest(manifestInput, projectRoot) {
        const identifier = manifestInput.evaluation_identifier || manifestInput.identifier;
        return {
            ...resolveWorkerManifestBase(manifestInput, projectRoot, "evaluation_identifier", identifier),
            skill: manifestInput.skill,
            mode: manifestInput.mode || "evaluation_worker",
            phase_order: manifestInput.phase_order,
            summary_kind: manifestInput.summary_kind || "evaluation-worker",
            codebase_root: manifestInput.codebase_root || ".",
            output_dir: manifestInput.output_dir || null,
            report_path: manifestInput.report_path || null,
            operation: manifestInput.operation || null,
            metadata: manifestInput.metadata || {},
        };
    },
    defaultState(manifest, runId) {
        return createWorkerState(manifest, runId, manifest.phase_order[0], {
            evaluation_identifier: manifest.evaluation_identifier,
            phase_order: manifest.phase_order,
            codebase_root: manifest.codebase_root,
            output_dir: manifest.output_dir,
            report_path: manifest.report_path,
            summary_kind: manifest.summary_kind,
            operation: manifest.operation,
        });
    },
    summarySchema: evaluationWorkerSummarySchema,
    summaryLabel: "evaluation worker summary",
    expectedSummaryKind(manifest) {
        return manifest.summary_kind || "evaluation-worker";
    },
    validateSummary(manifest, summary) {
        if (!ALLOWED_SUMMARY_KINDS.has(summary.summary_kind)) {
            return { ok: false, error: `Unsupported evaluation summary kind: ${summary.summary_kind}` };
        }
        const expectedKind = manifest.summary_kind || "evaluation-worker";
        if (summary.summary_kind !== expectedKind) {
            return { ok: false, error: `Worker summary kind must be ${expectedKind}` };
        }
        return { ok: true };
    },
    buildArtifactFileName(manifest) {
        return `${manifest.skill}--${manifest.identifier}.json`;
    },
    reduceState(state, summary) {
        return {
            ...state,
            final_result: summary.payload?.verdict || summary.payload?.status || state.final_result,
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
    recordSummary,
    resolveRunId,
    runtimePaths,
    saveState,
    startRun,
    updateState,
    readJsonFile,
} = evaluationWorkerStore;
