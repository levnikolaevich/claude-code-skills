import { resolve } from "node:path";
import {
    createRuntimeStore,
    readJsonFile,
} from "../../coordinator-runtime/lib/core.mjs";
import { environmentWorkerSummarySchema, pendingDecisionSchema } from "../../coordinator-runtime/lib/schemas.mjs";
import { assertSchema } from "../../coordinator-runtime/lib/validate.mjs";
import { PHASES } from "./phases.mjs";

const environmentSetupManifestSchema = {
    type: "object",
    required: ["skill", "identifier", "project_root", "created_at"],
    properties: {
        skill: { type: "string" },
        mode: { type: "string" },
        identifier: { type: "string" },
        targets: {
            type: "array",
            items: { type: "string" },
        },
        dry_run: { type: "boolean" },
        plugins: {
            type: "array",
            items: { type: "string" },
        },
        auto_install_providers: { type: "boolean" },
        apply_ide_override: { type: "boolean" },
        project_root: { type: "string" },
        worker_registry: { type: "array" },
        created_at: { type: "string", format: "date-time" },
    },
};

const environmentStore = createRuntimeStore({
    baseRootParts: [".hex-skills", "environment-setup", "runtime"],
    manifestSchema: environmentSetupManifestSchema,
    normalizeManifest(manifestInput, projectRoot) {
        const targets = Array.isArray(manifestInput.targets) && manifestInput.targets.length > 0
            ? manifestInput.targets
            : [manifestInput.targets || "both"];
        const plugins = Array.isArray(manifestInput.plugins) && manifestInput.plugins.length > 0
            ? manifestInput.plugins
            : ["agile-workflow"];
        return {
            skill: "ln-010",
            mode: manifestInput.mode || "environment_setup",
            identifier: manifestInput.identifier || `targets-${targets.join("-")}`,
            targets,
            dry_run: manifestInput.dry_run === true,
            plugins,
            auto_install_providers: manifestInput.auto_install_providers === true,
            apply_ide_override: manifestInput.apply_ide_override === true,
            project_root: resolve(projectRoot || process.cwd()),
            worker_registry: manifestInput.worker_registry || ["ln-011", "ln-012", "ln-013", "ln-014"],
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
            assess_summary: null,
            dispatch_plan: null,
            worker_results: {},
            verification_summary: null,
            env_state_written: false,
            self_check_passed: false,
            final_result: manifest.dry_run ? "DRY_RUN_PLAN" : null,
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
} = environmentStore;

export function recordWorker(projectRoot, runId, workerSummary) {
    const run = loadRun(projectRoot, runId);
    if (!run) {
        return { ok: false, error: "Run not found" };
    }
    const validation = assertSchema(environmentWorkerSummarySchema, workerSummary, "environment worker summary");
    if (!validation.ok) {
        return validation;
    }
    return updateState(projectRoot, runId, state => ({
        ...state,
        worker_results: {
            ...state.worker_results,
            [workerSummary.producer_skill]: workerSummary,
        },
    }));
}

export function setPendingDecision(projectRoot, runId, pendingDecision, reason = "Decision required") {
    const run = loadRun(projectRoot, runId);
    if (!run) {
        return { ok: false, error: "Run not found" };
    }
    const validation = assertSchema(pendingDecisionSchema, pendingDecision, "pending decision");
    if (!validation.ok) {
        return validation;
    }
    if (pendingDecision.resume_to_phase === PHASES.PAUSED || pendingDecision.resume_to_phase === PHASES.DONE) {
        return { ok: false, error: `Invalid resume_to_phase: ${pendingDecision.resume_to_phase}` };
    }
    return updateState(projectRoot, runId, state => ({
        ...state,
        phase: PHASES.PAUSED,
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
    if (run.state.pending_decision.resume_to_phase === PHASES.PAUSED || run.state.pending_decision.resume_to_phase === PHASES.DONE) {
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

export {
    readJsonFile,
};
