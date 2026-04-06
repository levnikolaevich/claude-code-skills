import { TASK_BOARD_STATUSES } from "../../coordinator-runtime/lib/runtime-constants.mjs";
import { PHASES } from "./phases.mjs";

const ALLOWED_TRANSITIONS = new Map([
    [PHASES.CONFIG, new Set([PHASES.DISCOVERY])],
    [PHASES.DISCOVERY, new Set([PHASES.WORKTREE_SETUP])],
    [PHASES.WORKTREE_SETUP, new Set([PHASES.SELECT_WORK])],
    [PHASES.SELECT_WORK, new Set([PHASES.TASK_EXECUTION, PHASES.GROUP_EXECUTION, PHASES.STORY_TO_REVIEW])],
    [PHASES.TASK_EXECUTION, new Set([PHASES.VERIFY_STATUSES])],
    [PHASES.GROUP_EXECUTION, new Set([PHASES.VERIFY_STATUSES])],
    [PHASES.VERIFY_STATUSES, new Set([PHASES.SELECT_WORK, PHASES.SCENARIO_VALIDATION])],
    [PHASES.SCENARIO_VALIDATION, new Set([PHASES.SELECT_WORK, PHASES.STORY_TO_REVIEW])],
    [PHASES.STORY_TO_REVIEW, new Set([PHASES.SELF_CHECK])],
    [PHASES.SELF_CHECK, new Set([PHASES.DONE])],
    [PHASES.PAUSED, new Set([])],
    [PHASES.DONE, new Set([])],
]);

function hasCheckpoint(checkpoints, phase) {
    return Boolean(checkpoints?.[phase]);
}

function hasProcessableWork(counts) {
    const next = counts || {};
    return Number(next.todo || 0) > 0
        || Number(next.to_review || 0) > 0
        || Number(next.to_rework || 0) > 0;
}

function hasInflightWorkers(state) {
    return Object.keys(state.inflight_workers || {}).length > 0;
}

export function validateTransition(manifest, state, checkpoints, toPhase) {
    const allowed = ALLOWED_TRANSITIONS.get(state.phase);
    if (!allowed || !allowed.has(toPhase)) {
        return { ok: false, error: `Invalid transition: ${state.phase} -> ${toPhase}` };
    }
    if (!hasCheckpoint(checkpoints, state.phase)) {
        return { ok: false, error: `Checkpoint missing for ${state.phase}` };
    }

    if (toPhase === PHASES.SELECT_WORK && state.phase === PHASES.WORKTREE_SETUP && !state.worktree_ready) {
        return { ok: false, error: "Worktree setup not checkpointed as ready" };
    }

    if (toPhase === PHASES.TASK_EXECUTION && !state.current_task_id) {
        return { ok: false, error: "No selected task recorded for task execution" };
    }

    if (toPhase === PHASES.GROUP_EXECUTION && !state.current_group_id) {
        return { ok: false, error: "No selected group recorded for group execution" };
    }

    if (toPhase === PHASES.SCENARIO_VALIDATION) {
        if (hasProcessableWork(state.processable_counts)) {
            return { ok: false, error: "Processable tasks remain; cannot start scenario validation" };
        }
        if (hasInflightWorkers(state)) {
            return { ok: false, error: "Parallel workers still in flight" };
        }
    }

    if (toPhase === PHASES.STORY_TO_REVIEW) {
        if (hasProcessableWork(state.processable_counts)) {
            return { ok: false, error: "Processable tasks remain; cannot move Story to To Review" };
        }
        if (hasInflightWorkers(state)) {
            return { ok: false, error: "Parallel workers still in flight" };
        }
        if (state.phase === PHASES.SCENARIO_VALIDATION && !state.scenario_pass) {
            return { ok: false, error: "Scenario validation must pass before Story To Review" };
        }
    }

    if (toPhase === PHASES.DONE) {
        if (!state.self_check_passed) {
            return { ok: false, error: "Self-check must pass before completion" };
        }
        if (!state.story_transition_done) {
            return { ok: false, error: "Story transition to To Review not recorded" };
        }
        if (!state.final_result) {
            return { ok: false, error: "Final result not recorded" };
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
    if (state.phase === PHASES.WORKTREE_SETUP && !state.worktree_ready) {
        return "Finish worktree setup and checkpoint PHASE_2_WORKTREE_SETUP";
    }
    if (state.phase === PHASES.SELECT_WORK) {
        if (hasProcessableWork(state.processable_counts)) {
            return "Select the next task or parallel group and checkpoint PHASE_3_SELECT_WORK";
        }
        return `Advance to ${PHASES.STORY_TO_REVIEW}`;
    }
    if (state.phase === PHASES.TASK_EXECUTION && state.current_task_id) {
        return `Complete execute-review cycle for task ${state.current_task_id}`;
    }
    if (state.phase === PHASES.GROUP_EXECUTION && state.current_group_id) {
        return `Wait for group ${state.current_group_id}, then review tasks and checkpoint PHASE_5_GROUP_EXECUTION`;
    }
    if (state.phase === PHASES.VERIFY_STATUSES) {
        if (hasProcessableWork(state.processable_counts)) {
            return "Re-read task statuses, checkpoint PHASE_6_VERIFY_STATUSES, then advance to PHASE_3_SELECT_WORK";
        }
        return `Advance to ${PHASES.SCENARIO_VALIDATION}`;
    }
    if (state.phase === PHASES.SCENARIO_VALIDATION) {
        if (state.scenario_pass) {
            return `Advance to ${PHASES.STORY_TO_REVIEW}`;
        }
        if (state.scenario_pass === false) {
            return "Scenario validation failed — advance to PHASE_3_SELECT_WORK for rework";
        }
        return "Run scenario validation and checkpoint PHASE_6B_SCENARIO_VALIDATION";
    }
    if (state.phase === PHASES.STORY_TO_REVIEW && !state.story_transition_done) {
        return `Move Story to ${TASK_BOARD_STATUSES.TO_REVIEW} and checkpoint ${PHASES.STORY_TO_REVIEW}`;
    }
    if (state.phase === PHASES.SELF_CHECK && !state.self_check_passed) {
        return "Fix self-check failures, then checkpoint PHASE_8_SELF_CHECK with pass=true";
    }

    const nextPhase = Array.from(ALLOWED_TRANSITIONS.get(state.phase) || [])[0];
    return nextPhase ? `Advance to ${nextPhase}` : "No automatic resume action available";
}
