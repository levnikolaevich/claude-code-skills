import { PHASES } from "./phases.mjs";

const ALLOWED_TRANSITIONS = new Map([
    [PHASES.PREFLIGHT, new Set([PHASES.ANALYZE_INPUT])],
    [PHASES.ANALYZE_INPUT, new Set([PHASES.DELEGATE_WORKERS])],
    [PHASES.DELEGATE_WORKERS, new Set([PHASES.COLLECT_RESULTS])],
    [PHASES.COLLECT_RESULTS, new Set([PHASES.VERIFY_SUMMARY])],
    [PHASES.VERIFY_SUMMARY, new Set([PHASES.REPORT])],
    [PHASES.REPORT, new Set([PHASES.DONE])],
    [PHASES.PAUSED, new Set([])],
    [PHASES.DONE, new Set([])],
]);

function hasCheckpoint(checkpoints, phase) {
    return Boolean(checkpoints?.[phase]);
}

function missingWorker(state) {
    return (state.worker_plan || []).find(worker => !state.worker_results?.[worker]) || null;
}

export function validateTransition(manifest, state, checkpoints, toPhase) {
    const allowed = ALLOWED_TRANSITIONS.get(state.phase);
    if (!allowed || !allowed.has(toPhase)) {
        return { ok: false, error: `Invalid transition: ${state.phase} -> ${toPhase}` };
    }
    if (!hasCheckpoint(checkpoints, state.phase)) {
        return { ok: false, error: `Checkpoint missing for ${state.phase}` };
    }
    if ([PHASES.COLLECT_RESULTS, PHASES.VERIFY_SUMMARY].includes(toPhase) && missingWorker(state)) {
        return { ok: false, error: "Modernization worker summaries are incomplete" };
    }
    if (toPhase === PHASES.REPORT && !state.verification_passed) {
        return { ok: false, error: "Verification must pass before reporting" };
    }
    if (toPhase === PHASES.DONE) {
        if (!state.report_ready) {
            return { ok: false, error: "Modernization report checkpoint missing" };
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
    if (state.phase === PHASES.DELEGATE_WORKERS && missingWorker(state)) {
        const worker = missingWorker(state);
        const childRun = worker ? state.child_runs?.[worker] : null;
        if (childRun?.run_id) {
            return `Record ${worker} summary from child run ${childRun.run_id} before collecting results`;
        }
        return "Record modernization worker summaries before collecting results";
    }
    if (state.phase === PHASES.VERIFY_SUMMARY && !state.verification_passed) {
        return `Checkpoint ${PHASES.VERIFY_SUMMARY} with verification_passed=true`;
    }
    if (state.phase === PHASES.REPORT && !state.report_ready) {
        return `Checkpoint ${PHASES.REPORT} with report_ready=true`;
    }
    if (state.phase === PHASES.REPORT && !state.summary_recorded) {
        return "Record modernization coordinator summary before completion";
    }
    const nextPhase = Array.from(ALLOWED_TRANSITIONS.get(state.phase) || [])[0];
    return nextPhase ? `Advance to ${nextPhase}` : "No automatic resume action available";
}
