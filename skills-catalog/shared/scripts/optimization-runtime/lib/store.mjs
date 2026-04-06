import { resolve } from "node:path";
import {
    createRuntimeStore,
    readJsonFile,
} from "../../coordinator-runtime/lib/core.mjs";
import {
    optimizationCycleSchema,
    optimizationCoordinatorSummarySchema,
    optimizationWorkerSummarySchema,
} from "../../coordinator-runtime/lib/schemas.mjs";
import { writeRuntimeArtifactJson } from "../../coordinator-runtime/lib/artifacts.mjs";
import { assertSchema } from "../../coordinator-runtime/lib/validate.mjs";
import { PHASES } from "./phases.mjs";

const optimizationManifestSchema = {
    type: "object",
    required: ["skill", "identifier", "slug", "project_root", "created_at"],
    properties: {
        skill: { type: "string" },
        mode: { type: "string" },
        identifier: { type: "string" },
        slug: { type: "string" },
        target: { type: "string" },
        observed_metric: {},
        target_metric: {},
        execution_mode: { type: "string" },
        cycle_config: { type: "object" },
        project_root: { type: "string" },
        context_file: {},
        service_topology: {},
        created_at: { type: "string", format: "date-time" },
    },
};

const optimizationStore = createRuntimeStore({
    baseRootParts: [".hex-skills", "optimization", "runtime"],
    manifestSchema: optimizationManifestSchema,
    normalizeManifest(manifestInput, projectRoot) {
        return {
            skill: "ln-810",
            mode: manifestInput.mode || "optimization",
            identifier: manifestInput.slug || manifestInput.identifier,
            slug: manifestInput.slug || manifestInput.identifier,
            target: manifestInput.target,
            observed_metric: manifestInput.observed_metric || null,
            target_metric: manifestInput.target_metric || null,
            execution_mode: manifestInput.execution_mode || "execute",
            cycle_config: manifestInput.cycle_config || { max_cycles: 3, plateau_threshold: 5 },
            project_root: resolve(projectRoot || process.cwd()),
            context_file: manifestInput.context_file || null,
            service_topology: manifestInput.service_topology || null,
            created_at: new Date().toISOString(),
        };
    },
    defaultState(manifest, runId) {
        return {
            run_id: runId,
            skill: manifest.skill,
            mode: manifest.mode,
            identifier: manifest.identifier,
            slug: manifest.slug,
            target: manifest.target,
            phase: PHASES.PREFLIGHT,
            complete: false,
            paused_reason: null,
            pending_decision: null,
            decisions: [],
            execution_mode: manifest.execution_mode,
            cycle_config: manifest.cycle_config,
            current_cycle: 1,
            cycles: [],
            phases: {},
            worker_results: {},
            child_runs: {},
            stop_reason: null,
            target_metric: manifest.target_metric,
            context_file: manifest.context_file,
            final_result: null,
            report_ready: false,
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
} = optimizationStore;

function childRunKey(childRun) {
    const identifier = childRun?.identifier || childRun?.phase_context || childRun?.run_id || "child";
    return `${childRun?.worker || "worker"}--${identifier}`;
}

function workerResultKey(summary) {
    return `${summary.producer_skill}--${summary.identifier}`;
}

export function recordWorkerResult(projectRoot, runId, summary) {
    const run = loadRun(projectRoot, runId);
    if (!run) {
        return { ok: false, error: "Run not found" };
    }
    const validation = assertSchema(optimizationWorkerSummarySchema, summary, "optimization worker summary");
    if (!validation.ok) {
        return validation;
    }
    if (summary?.run_id !== runId && !run.state.child_runs?.[childRunKey({
        worker: summary.producer_skill,
        identifier: summary.identifier,
        run_id: summary.run_id,
    })]) {
        return { ok: false, error: `Optimization worker summary must belong to runtime ${runId} or a recorded child run` };
    }
    return updateState(projectRoot, runId, state => ({
        ...state,
        worker_results: {
            ...state.worker_results,
            [workerResultKey(summary)]: summary,
        },
    }));
}

export function recordSummary(projectRoot, runId, summary) {
    const run = loadRun(projectRoot, runId);
    if (!run) {
        return { ok: false, error: "Run not found" };
    }
    if (summary?.run_id !== runId) {
        return { ok: false, error: `Optimization coordinator summary run_id must match runtime run_id (${runId})` };
    }
    const validation = assertSchema(optimizationCoordinatorSummarySchema, summary, "optimization coordinator summary");
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
                    summary_artifact_path: artifactPath,
                },
            },
        };
    });
}

export function recordCycle(projectRoot, runId, cycleRecord) {
    const run = loadRun(projectRoot, runId);
    if (!run) {
        return { ok: false, error: "Run not found" };
    }
    const normalizedCycle = {
        ...cycleRecord,
        cycle: Number(cycleRecord.cycle || run.state.current_cycle || 1),
        recorded_at: cycleRecord.recorded_at || new Date().toISOString(),
    };
    const validation = assertSchema(optimizationCycleSchema, normalizedCycle, "optimization cycle record");
    if (!validation.ok) {
        return validation;
    }
    return updateState(projectRoot, runId, state => {
        const remaining = (state.cycles || []).filter(entry => entry.cycle !== normalizedCycle.cycle);
        const nextCurrentCycle = normalizedCycle.next_cycle || state.current_cycle;
        return {
            ...state,
            current_cycle: nextCurrentCycle,
            cycles: [...remaining, normalizedCycle].sort((left, right) => left.cycle - right.cycle),
            stop_reason: normalizedCycle.stop_reason || state.stop_reason,
            final_result: normalizedCycle.final_result || state.final_result,
        };
    });
}

export {
    readJsonFile,
};
