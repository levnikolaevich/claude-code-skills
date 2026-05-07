import {
    OPTIMIZATION_CHECKPOINT_STATUSES,
    OPTIMIZATION_EXECUTION_ALLOWED_VERDICT_LIST,
    OPTIMIZATION_GATE_VERDICTS,
    OPTIMIZATION_GATE_VERDICT_LIST,
    OPTIMIZATION_VALIDATION_VERDICTS,
} from "../../coordinator-runtime/lib/runtime-constants.mjs";
import { PHASES } from "./phases.mjs";

const ALLOWED_TRANSITIONS = new Map([
    [PHASES.PREFLIGHT, new Set([PHASES.PARSE_INPUT])],
    [PHASES.PARSE_INPUT, new Set([PHASES.PROFILE])],
    [PHASES.PROFILE, new Set([PHASES.WRONG_TOOL_GATE])],
    [PHASES.WRONG_TOOL_GATE, new Set([PHASES.RESEARCH, PHASES.AGGREGATE])],
    [PHASES.RESEARCH, new Set([PHASES.SET_TARGET, PHASES.AGGREGATE])],
    [PHASES.SET_TARGET, new Set([PHASES.WRITE_CONTEXT])],
    [PHASES.WRITE_CONTEXT, new Set([PHASES.VALIDATE_PLAN])],
    [PHASES.VALIDATE_PLAN, new Set([PHASES.EXECUTE])],
    [PHASES.EXECUTE, new Set([PHASES.CYCLE_BOUNDARY])],
    [PHASES.CYCLE_BOUNDARY, new Set([PHASES.PROFILE, PHASES.AGGREGATE])],
    [PHASES.AGGREGATE, new Set([PHASES.REPORT])],
    [PHASES.REPORT, new Set([PHASES.DONE])],
    [PHASES.PAUSED, new Set([])],
    [PHASES.DONE, new Set([])],
]);

function hasCheckpoint(checkpoints, phase) {
    return Boolean(checkpoints?.[phase]);
}

function latestPayload(checkpoints, phase) {
    return checkpoints?.[phase]?.payload || {};
}

function childRunFromCheckpoint(checkpoints, phase) {
    const childRun = latestPayload(checkpoints, phase).child_run;
    return childRun && typeof childRun === "object" ? childRun : null;
}

function workerResultKey(worker, identifier) {
    return `${worker}--${identifier}`;
}

function hasWorkerSummary(state, worker, identifier = null) {
    if (identifier) {
        return Boolean(state.worker_results?.[workerResultKey(worker, identifier)]);
    }
    return Object.values(state.worker_results || {}).some(summary => summary?.producer_skill === worker);
}

function childRunMessage(checkpoints, state, phase, worker, suffix) {
    const childRun = childRunFromCheckpoint(checkpoints, phase);
    if (!childRun?.run_id || childRun.worker !== worker) {
        return null;
    }
    return `Check child runtime ${childRun.run_id} for ${worker}${suffix}`;
}

export function validateTransition(manifest, state, checkpoints, toPhase) {
    const allowed = ALLOWED_TRANSITIONS.get(state.phase);
    if (!allowed || !allowed.has(toPhase)) {
        return { ok: false, error: `Invalid transition: ${state.phase} -> ${toPhase}` };
    }
    if (!hasCheckpoint(checkpoints, state.phase)) {
        return { ok: false, error: `Checkpoint missing for ${state.phase}` };
    }

    if (toPhase === PHASES.RESEARCH) {
        const gateVerdict = latestPayload(checkpoints, PHASES.WRONG_TOOL_GATE).gate_verdict;
        if (!OPTIMIZATION_GATE_VERDICT_LIST.filter(value => value !== OPTIMIZATION_GATE_VERDICTS.BLOCK).includes(gateVerdict || "")) {
            return { ok: false, error: "Wrong Tool Gate does not allow research" };
        }
    }

    if (toPhase === PHASES.WRONG_TOOL_GATE) {
        const childRun = childRunFromCheckpoint(checkpoints, PHASES.PROFILE);
        const childIdentifier = childRun?.worker === "ln-811" ? childRun.identifier : null;
        if (!hasWorkerSummary(state, "ln-811", childIdentifier)) {
            return { ok: false, error: "ln-811 summary missing" };
        }
    }

    if (toPhase === PHASES.AGGREGATE) {
        if (state.phase === PHASES.WRONG_TOOL_GATE) {
            const gateVerdict = latestPayload(checkpoints, PHASES.WRONG_TOOL_GATE).gate_verdict;
            if (gateVerdict !== OPTIMIZATION_GATE_VERDICTS.BLOCK) {
                return { ok: false, error: "Phase 3 can jump to aggregate only on BLOCK" };
            }
        }
        if (state.phase === PHASES.RESEARCH) {
            const payload = latestPayload(checkpoints, PHASES.RESEARCH);
            if (Number(payload.hypotheses_count ?? 1) > 0) {
                return { ok: false, error: "Phase 4 can jump to aggregate only when no hypotheses remain" };
            }
            const childRun = childRunFromCheckpoint(checkpoints, PHASES.RESEARCH);
            const childIdentifier = childRun?.worker === "ln-812" ? childRun.identifier : null;
            if (!hasWorkerSummary(state, "ln-812", childIdentifier)) {
                return { ok: false, error: "ln-812 summary missing" };
            }
        }
        if (state.phase === PHASES.CYCLE_BOUNDARY && !state.stop_reason) {
            return { ok: false, error: "Cycle boundary missing stop reason" };
        }
    }

    if (toPhase === PHASES.SET_TARGET) {
        const childRun = childRunFromCheckpoint(checkpoints, PHASES.RESEARCH);
        const childIdentifier = childRun?.worker === "ln-812" ? childRun.identifier : null;
        if (!hasWorkerSummary(state, "ln-812", childIdentifier)) {
            return { ok: false, error: "ln-812 summary missing" };
        }
    }

    if (toPhase === PHASES.VALIDATE_PLAN && !state.context_file) {
        return { ok: false, error: "Context file not recorded" };
    }

    if (toPhase === PHASES.EXECUTE) {
        const childRun = childRunFromCheckpoint(checkpoints, PHASES.VALIDATE_PLAN);
        const childIdentifier = childRun?.worker === "ln-813" ? childRun.identifier : null;
        if (!hasWorkerSummary(state, "ln-813", childIdentifier)) {
            return { ok: false, error: "ln-813 summary missing" };
        }
        const verdict = latestPayload(checkpoints, PHASES.VALIDATE_PLAN).validation_verdict;
        if (!OPTIMIZATION_EXECUTION_ALLOWED_VERDICT_LIST.includes(verdict || "")) {
            return { ok: false, error: "Validation verdict does not allow execution" };
        }
    }

    if (toPhase === PHASES.CYCLE_BOUNDARY) {
        const payload = latestPayload(checkpoints, PHASES.EXECUTE);
        const skippedByMode = payload.status === OPTIMIZATION_CHECKPOINT_STATUSES.SKIPPED_BY_MODE && state.execution_mode === "plan_only";
        if (!skippedByMode) {
            const childRun = childRunFromCheckpoint(checkpoints, PHASES.EXECUTE);
            const childIdentifier = childRun?.worker === "ln-814" ? childRun.identifier : null;
            if (!hasWorkerSummary(state, "ln-814", childIdentifier)) {
                return { ok: false, error: "ln-814 summary missing" };
            }
        }
    }

    if (toPhase === PHASES.PROFILE && state.phase === PHASES.CYCLE_BOUNDARY && state.stop_reason) {
        return { ok: false, error: "Stop reason recorded; cannot continue to another cycle" };
    }

    if (toPhase === PHASES.DONE) {
        if (!state.report_ready) {
            return { ok: false, error: "Final report checkpoint missing" };
        }
        if (!state.final_result) {
            return { ok: false, error: "Final result not recorded" };
        }
        if (!state.summary_recorded) {
            return { ok: false, error: "Coordinator summary not recorded" };
        }
    }

    return { ok: true };
}

export function computeResumeAction(manifest, state, checkpoints) {
    if (state.complete || state.phase === PHASES.DONE) {
        return "Run complete";
    }
    if (state.phase === PHASES.PAUSED) {
        return `Paused: ${state.paused_reason || "manual intervention required"}`;
    }
    if (!hasCheckpoint(checkpoints, state.phase)) {
        return `Complete ${state.phase} and write its checkpoint`;
    }
    if (state.phase === PHASES.PROFILE) {
        const childRun = childRunFromCheckpoint(checkpoints, PHASES.PROFILE);
        const childIdentifier = childRun?.worker === "ln-811" ? childRun.identifier : null;
        if (!hasWorkerSummary(state, "ln-811", childIdentifier)) {
            return childRunMessage(checkpoints, state, PHASES.PROFILE, "ln-811", " or record its worker summary before Wrong Tool Gate")
                || "Record ln-811 worker summary before Wrong Tool Gate";
        }
    }
    if (state.phase === PHASES.RESEARCH) {
        const childRun = childRunFromCheckpoint(checkpoints, PHASES.RESEARCH);
        const childIdentifier = childRun?.worker === "ln-812" ? childRun.identifier : null;
        if (!hasWorkerSummary(state, "ln-812", childIdentifier)) {
            return childRunMessage(checkpoints, state, PHASES.RESEARCH, "ln-812", " or record its worker summary before continuing research")
                || "Record ln-812 worker summary before continuing research";
        }
    }
    if (state.phase === PHASES.WRITE_CONTEXT && !state.context_file) {
        return "Write optimization context file and checkpoint PHASE_6_WRITE_CONTEXT";
    }
    if (state.phase === PHASES.VALIDATE_PLAN) {
        const childRun = childRunFromCheckpoint(checkpoints, PHASES.VALIDATE_PLAN);
        const childIdentifier = childRun?.worker === "ln-813" ? childRun.identifier : null;
        if (!hasWorkerSummary(state, "ln-813", childIdentifier)) {
            return childRunMessage(checkpoints, state, PHASES.VALIDATE_PLAN, "ln-813", " or record its worker summary before execution")
                || "Record ln-813 worker summary before execution";
        }
        const verdict = latestPayload(checkpoints, PHASES.VALIDATE_PLAN).validation_verdict;
        if (verdict === OPTIMIZATION_VALIDATION_VERDICTS.NO_GO) {
            return "Present NO_GO issues to the user, then resolve or pause";
        }
    }
    if (state.phase === PHASES.EXECUTE && state.execution_mode === "plan_only") {
        return "Checkpoint PHASE_8_EXECUTE as skipped_by_mode, then advance to PHASE_9_CYCLE_BOUNDARY";
    }
    if (state.phase === PHASES.EXECUTE) {
        const childRun = childRunFromCheckpoint(checkpoints, PHASES.EXECUTE);
        const childIdentifier = childRun?.worker === "ln-814" ? childRun.identifier : null;
        if (!hasWorkerSummary(state, "ln-814", childIdentifier)) {
            return childRunMessage(checkpoints, state, PHASES.EXECUTE, "ln-814", " or record its worker summary before cycle boundary")
                || "Record ln-814 worker summary before cycle boundary";
        }
    }
    if (state.phase === PHASES.CYCLE_BOUNDARY) {
        if (state.stop_reason) {
            return "Advance to PHASE_10_AGGREGATE";
        }
        return `Advance to ${PHASES.PROFILE} for cycle ${Number(state.current_cycle || 1) + 1}`;
    }
    if (state.phase === PHASES.REPORT && !state.report_ready) {
        return "Write final report checkpoint for PHASE_11_REPORT";
    }
    if (state.phase === PHASES.REPORT && !state.summary_recorded) {
        return "Record optimization coordinator summary before completion";
    }

    const nextPhase = Array.from(ALLOWED_TRANSITIONS.get(state.phase) || [])[0];
    return nextPhase ? `Advance to ${nextPhase}` : "No automatic resume action available";
}
