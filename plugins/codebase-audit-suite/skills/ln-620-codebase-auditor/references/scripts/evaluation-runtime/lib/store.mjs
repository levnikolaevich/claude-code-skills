import { resolve } from "node:path";
import {
    createRuntimeStore,
    fileExists,
    readJsonFile,
    resolveTrackedPath,
} from "../../coordinator-runtime/lib/core.mjs";
import {
    buildRuntimeStateSchema,
    evaluationCoordinatorSummarySchema,
    pendingDecisionSchema,
    reviewAgentRecordSchema,
} from "../../coordinator-runtime/lib/schemas.mjs";
import { writeRuntimeArtifactJson } from "../../coordinator-runtime/lib/artifacts.mjs";
import { REVIEW_AGENT_STATUSES } from "../../coordinator-runtime/lib/runtime-constants.mjs";
import { assertSchema } from "../../coordinator-runtime/lib/validate.mjs";

const phasePolicySchema = {
    type: "object",
    additionalProperties: false,
    properties: {
        delegate_phases: {
            type: "array",
            items: { type: "string" },
        },
        aggregate_phase: { type: "string" },
        report_phase: { type: "string" },
        results_log_phase: { type: "string" },
        cleanup_phase: { type: "string" },
        self_check_phase: { type: "string" },
        agent_resolve_before: {
            type: "array",
            items: { type: "string" },
        },
    },
};

const evaluationManifestSchema = {
    type: "object",
    required: ["skill", "identifier", "project_root", "phase_order", "report_path", "created_at"],
    additionalProperties: false,
    properties: {
        skill: { type: "string", minLength: 1 },
        mode: { type: "string" },
        identifier: { type: "string", minLength: 1 },
        project_root: { type: "string", minLength: 1 },
        phase_order: {
            type: "array",
            minItems: 1,
            items: { type: "string", minLength: 1 },
        },
        phase_policy: phasePolicySchema,
        report_path: { type: "string", minLength: 1 },
        results_log_path: { type: "string" },
        expected_agents: {
            type: "array",
            items: { type: "string" },
        },
        required_research: { type: "boolean" },
        created_at: { type: "string", format: "date-time" },
    },
};

const evaluationStateSchema = buildRuntimeStateSchema({
    phase_order: {
        type: "array",
        minItems: 1,
        items: { type: "string", minLength: 1 },
    },
    phase_data: {
        type: "object",
        additionalProperties: { type: "object" },
    },
    worker_plan: {
        type: "array",
    },
    worker_results: {
        type: "object",
        additionalProperties: { type: "object" },
    },
    child_runs: {
        type: "object",
        additionalProperties: { type: "object" },
    },
    inflight_workers: {
        type: "object",
        additionalProperties: { type: "object" },
    },
    agents: {
        type: "object",
        additionalProperties: reviewAgentRecordSchema,
    },
    background_agent_cleanup: {
        type: "object",
        additionalProperties: { type: "object" },
    },
    refinement_cleanup: {
        type: "object",
        additionalProperties: { type: "object" },
    },
    cleanup_verified: { type: "boolean" },
    research_completed: { type: "boolean" },
    aggregation_summary: {
        type: ["object", "null"],
    },
    report_written: { type: "boolean" },
    report_path: { type: ["string", "null"] },
    results_log_appended: { type: "boolean" },
    results_log_path: { type: ["string", "null"] },
    self_check_passed: { type: "boolean" },
    summary_recorded: { type: "boolean" },
    summary_artifact_path: { type: ["string", "null"] },
    summary: { type: ["object", "null"] },
}, [
    "phase_order",
    "phase_data",
    "worker_plan",
    "worker_results",
    "child_runs",
    "inflight_workers",
    "agents",
    "background_agent_cleanup",
    "refinement_cleanup",
    "cleanup_verified",
    "research_completed",
    "aggregation_summary",
    "report_written",
    "report_path",
    "results_log_appended",
    "results_log_path",
    "self_check_passed",
    "summary_recorded",
    "summary_artifact_path",
    "summary",
]);

function normalizePhaseOrder(phaseOrder) {
    const seen = new Set();
    return (phaseOrder || []).filter(phase => {
        if (!phase || seen.has(phase)) {
            return false;
        }
        seen.add(phase);
        return true;
    });
}

const evaluationStore = createRuntimeStore({
    baseRootParts: [".hex-skills", "evaluation", "runtime"],
    manifestSchema: evaluationManifestSchema,
    stateSchema: evaluationStateSchema,
    normalizeManifest(manifestInput, projectRoot) {
        const phaseOrder = normalizePhaseOrder(manifestInput.phase_order);
        return {
            skill: manifestInput.skill,
            mode: manifestInput.mode || "evaluation",
            identifier: manifestInput.identifier,
            project_root: resolve(projectRoot || process.cwd()),
            phase_order: phaseOrder,
            phase_policy: manifestInput.phase_policy || {},
            report_path: manifestInput.report_path,
            results_log_path: manifestInput.results_log_path || "docs/project/.evaluation/results_log.md",
            expected_agents: manifestInput.expected_agents || [],
            required_research: manifestInput.required_research !== false,
            created_at: new Date().toISOString(),
        };
    },
    defaultState(manifest, runId) {
        return {
            run_id: runId,
            skill: manifest.skill,
            mode: manifest.mode,
            identifier: manifest.identifier,
            phase: manifest.phase_order[0],
            complete: false,
            paused_reason: null,
            pending_decision: null,
            decisions: [],
            final_result: null,
            phase_order: manifest.phase_order,
            phase_data: {},
            worker_plan: [],
            worker_results: {},
            child_runs: {},
            inflight_workers: {},
            agents: {},
            background_agent_cleanup: {},
            refinement_cleanup: {},
            cleanup_verified: false,
            research_completed: manifest.required_research === false,
            aggregation_summary: null,
            report_written: false,
            report_path: manifest.report_path,
            results_log_appended: false,
            results_log_path: manifest.results_log_path || null,
            self_check_passed: false,
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
} = evaluationStore;

export function setPendingDecision(projectRoot, runId, pendingDecision, reason = "Decision required") {
    const run = loadRun(projectRoot, runId);
    if (!run) {
        return { ok: false, error: "Run not found" };
    }
    const validation = assertSchema(pendingDecisionSchema, pendingDecision, "pending decision");
    if (!validation.ok) {
        return validation;
    }
    if (pendingDecision.resume_to_phase === "PAUSED" || pendingDecision.resume_to_phase === "DONE") {
        return { ok: false, error: `Invalid resume_to_phase: ${pendingDecision.resume_to_phase}` };
    }
    return updateState(projectRoot, runId, state => ({
        ...state,
        phase: "PAUSED",
        paused_reason: reason,
        pending_decision: pendingDecision,
    }), { eventType: "RUN_PAUSED" });
}

export function recordDecision(projectRoot, runId, decision) {
    const run = loadRun(projectRoot, runId);
    if (!run) {
        return { ok: false, error: "Run not found" };
    }
    if (!run.state.pending_decision) {
        return { ok: false, error: "No pending decision recorded" };
    }
    if (run.state.pending_decision.resume_to_phase === "PAUSED" || run.state.pending_decision.resume_to_phase === "DONE") {
        return { ok: false, error: `Invalid resume_to_phase: ${run.state.pending_decision.resume_to_phase}` };
    }
    const choices = run.state.pending_decision.choices || [];
    if (choices.length > 0 && !choices.includes(decision.selected_choice)) {
        return { ok: false, error: `Invalid selected_choice: ${decision.selected_choice}. Valid: ${choices.join(", ")}` };
    }
    const nextDecision = {
        kind: run.state.pending_decision.kind,
        selected_choice: decision.selected_choice,
        answered_at: new Date().toISOString(),
        context: decision.context || {},
    };
    return updateState(projectRoot, runId, state => ({
        ...state,
        phase: state.pending_decision.resume_to_phase,
        paused_reason: null,
        pending_decision: null,
        decisions: [...(state.decisions || []), nextDecision],
    }));
}

export function registerAgent(projectRoot, runId, agentRecord) {
    const run = loadRun(projectRoot, runId);
    if (!run) {
        return { ok: false, error: "Run not found" };
    }
    const validation = assertSchema(reviewAgentRecordSchema, agentRecord, "evaluation agent record");
    if (!validation.ok) {
        return validation;
    }
    return updateState(projectRoot, runId, state => ({
        ...state,
        agents: {
            ...state.agents,
            [agentRecord.name]: {
                name: agentRecord.name,
                status: agentRecord.status || REVIEW_AGENT_STATUSES.LAUNCHED,
                prompt_file: agentRecord.prompt_file || null,
                result_file: agentRecord.result_file || null,
                log_file: agentRecord.log_file || null,
                metadata_file: agentRecord.metadata_file || null,
                pid: agentRecord.pid || null,
                session_id: agentRecord.session_id || null,
                started_at: agentRecord.started_at || null,
                finished_at: agentRecord.finished_at || null,
                exit_code: agentRecord.exit_code ?? null,
                error: agentRecord.error || null,
            },
        },
    }));
}

export function recordWorkerResult(projectRoot, runId, summary) {
    const run = loadRun(projectRoot, runId);
    if (!run) {
        return { ok: false, error: "Run not found" };
    }
    const hasEnvelope = summary
        && typeof summary === "object"
        && typeof summary.schema_version === "string"
        && typeof summary.summary_kind === "string"
        && typeof summary.run_id === "string"
        && typeof summary.identifier === "string"
        && typeof summary.producer_skill === "string"
        && typeof summary.produced_at === "string"
        && summary.payload
        && typeof summary.payload === "object";
    if (!hasEnvelope) {
        return { ok: false, error: "Worker summary must use the shared summary envelope" };
    }
    const workerResultKey = `${summary.producer_skill}--${summary.identifier}`;
    return updateState(projectRoot, runId, state => {
        const nextInflightWorkers = { ...(state.inflight_workers || {}) };
        delete nextInflightWorkers[workerResultKey];
        return {
            ...state,
            worker_results: {
                ...state.worker_results,
                [workerResultKey]: summary,
            },
            inflight_workers: nextInflightWorkers,
        };
    });
}

export function recordSummary(projectRoot, runId, summary) {
    const run = loadRun(projectRoot, runId);
    if (!run) {
        return { ok: false, error: "Run not found" };
    }
    if (summary?.run_id !== runId) {
        return { ok: false, error: `Evaluation coordinator summary run_id must match runtime run_id (${runId})` };
    }
    const validation = assertSchema(evaluationCoordinatorSummarySchema, summary, "evaluation coordinator summary");
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

export {
    fileExists,
    readJsonFile,
    resolveTrackedPath,
};
