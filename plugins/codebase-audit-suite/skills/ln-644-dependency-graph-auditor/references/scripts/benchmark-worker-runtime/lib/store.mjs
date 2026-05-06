import { resolveWorkerManifestBase, buildWorkerManifestSchema, createWorkerRuntimeStore, createWorkerState } from "../../coordinator-runtime/lib/worker-runtime.mjs";
import { benchmarkWorkerSummarySchema } from "../../coordinator-runtime/lib/schemas.mjs";
import { getWorkerPhases } from "./phases.mjs";

const benchmarkWorkerManifestSchema = buildWorkerManifestSchema("benchmark_identifier", {
    benchmark_root: { type: "string" },
    goals_path: { type: "string" },
    expectations_path: { type: "string" },
    report_path: { type: "string" },
    results_root: { type: ["string", "null"] },
    scenario_count: { type: ["integer", "null"], minimum: 0 },
    metadata: { type: "object" },
}, ["benchmark_root", "goals_path", "expectations_path", "report_path"]);

const benchmarkWorkerStore = createWorkerRuntimeStore({
    baseRootParts: [".hex-skills", "benchmark-worker", "runtime"],
    manifestSchema: benchmarkWorkerManifestSchema,
    normalizeManifest(manifestInput, projectRoot) {
        const identifier = manifestInput.benchmark_identifier || manifestInput.identifier;
        return {
            ...resolveWorkerManifestBase(manifestInput, projectRoot, "benchmark_identifier", identifier),
            skill: manifestInput.skill,
            mode: manifestInput.mode || "benchmark_worker",
            benchmark_root: manifestInput.benchmark_root || ".",
            goals_path: manifestInput.goals_path || null,
            expectations_path: manifestInput.expectations_path || null,
            report_path: manifestInput.report_path || null,
            results_root: manifestInput.results_root || null,
            scenario_count: manifestInput.scenario_count ?? null,
            metadata: manifestInput.metadata || {},
        };
    },
    defaultState(manifest, runId) {
        const phases = getWorkerPhases(manifest.skill);
        return createWorkerState(manifest, runId, phases[0], {
            benchmark_identifier: manifest.benchmark_identifier,
            benchmark_root: manifest.benchmark_root,
            goals_path: manifest.goals_path,
            expectations_path: manifest.expectations_path,
            report_path: manifest.report_path,
            results_root: manifest.results_root,
            scenario_count: manifest.scenario_count,
            report_ready: false,
            summary_kind: "benchmark-worker",
        });
    },
    summarySchema: benchmarkWorkerSummarySchema,
    summaryLabel: "benchmark worker summary",
    expectedSummaryKind: "benchmark-worker",
    buildArtifactFileName(manifest) {
        return `${manifest.skill}--${manifest.identifier}.json`;
    },
    reduceState(state, summary) {
        return {
            ...state,
            report_ready: Boolean(summary.payload?.report_path),
            report_path: summary.payload?.report_path || state.report_path,
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
} = benchmarkWorkerStore;
