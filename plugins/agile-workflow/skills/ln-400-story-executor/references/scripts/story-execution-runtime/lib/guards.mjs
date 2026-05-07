import { TASK_BOARD_STATUSES } from "../../coordinator-runtime/lib/runtime-constants.mjs";
import { PHASES } from "./phases.mjs";

const TASK_REVIEW_WORKER = "ln-402";
const TASK_EXECUTION_WORKERS = Object.freeze(["ln-401", "ln-403", "ln-404"]);

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

function getTaskWorkerResults(state, taskId) {
    return state.worker_results_by_task?.[taskId] || {};
}

function getReviewSummary(state, taskId) {
    return getTaskWorkerResults(state, taskId)[TASK_REVIEW_WORKER] || null;
}

function hasReviewOutcome(state, taskId) {
    const reviewSummary = getReviewSummary(state, taskId);
    const toStatus = reviewSummary?.payload?.to_status;
    return toStatus === TASK_BOARD_STATUSES.DONE || toStatus === TASK_BOARD_STATUSES.TO_REWORK;
}

function hasExecutionSummary(state, taskId) {
    const taskWorkerResults = getTaskWorkerResults(state, taskId);
    return TASK_EXECUTION_WORKERS.some(worker => Boolean(taskWorkerResults[worker]));
}

function getProcessedTaskIds(state) {
    const processed = new Set([
        ...Object.keys(state.worker_results_by_task || {}),
        ...Object.keys(state.tasks || {}),
    ]);
    for (const group of Object.values(state.groups || {})) {
        for (const taskId of group.task_ids || []) {
            processed.add(taskId);
        }
    }
    return Array.from(processed);
}

function getMissingReviewTasks(state, taskIds) {
    return (taskIds || []).filter(taskId => !hasReviewOutcome(state, taskId));
}

function hasCompletedStage2Summary(state) {
    return state.stage_summary?.summary_kind === "pipeline-stage"
        && state.stage_summary?.payload?.stage === 2
        && state.stage_summary?.payload?.status === "completed";
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

    if (toPhase === PHASES.VERIFY_STATUSES && state.phase === PHASES.TASK_EXECUTION) {
        if (!state.current_task_id) {
            return { ok: false, error: "No selected task recorded for status verification" };
        }
        if (!hasReviewOutcome(state, state.current_task_id)) {
            return { ok: false, error: `ln-402 review summary missing for task ${state.current_task_id}` };
        }
    }

    if (toPhase === PHASES.VERIFY_STATUSES && state.phase === PHASES.GROUP_EXECUTION) {
        const groupTaskIds = state.groups?.[state.current_group_id]?.task_ids || [];
        const missingReviewTasks = getMissingReviewTasks(state, groupTaskIds);
        if (missingReviewTasks.length > 0) {
            return { ok: false, error: `ln-402 review summaries missing for group tasks: ${missingReviewTasks.join(", ")}` };
        }
    }

    if (toPhase === PHASES.SCENARIO_VALIDATION) {
        if (hasProcessableWork(state.processable_counts)) {
            return { ok: false, error: "Processable tasks remain; cannot start scenario validation" };
        }
        if (hasInflightWorkers(state)) {
            return { ok: false, error: "Parallel workers still in flight" };
        }
        const missingReviewTasks = getMissingReviewTasks(state, getProcessedTaskIds(state));
        if (missingReviewTasks.length > 0) {
            return { ok: false, error: `Latest ln-402 summaries missing for tasks: ${missingReviewTasks.join(", ")}` };
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
        if (!hasCompletedStage2Summary(state)) {
            return { ok: false, error: "Stage 2 coordinator artifact not recorded" };
        }
        const missingReviewTasks = getMissingReviewTasks(state, getProcessedTaskIds(state));
        if (missingReviewTasks.length > 0) {
            return { ok: false, error: `Latest ln-402 summaries missing for tasks: ${missingReviewTasks.join(", ")}` };
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
        if (!hasReviewOutcome(state, state.current_task_id)) {
            if (hasExecutionSummary(state, state.current_task_id)) {
                return `Record ln-402 summary for task ${state.current_task_id} before status verification`;
            }
            return `Record worker summary for task ${state.current_task_id} before review`;
        }
        return `Checkpoint ${PHASES.TASK_EXECUTION} and advance to ${PHASES.VERIFY_STATUSES}`;
    }
    if (state.phase === PHASES.GROUP_EXECUTION && state.current_group_id) {
        const groupTaskIds = state.groups?.[state.current_group_id]?.task_ids || [];
        const missingReviewTasks = getMissingReviewTasks(state, groupTaskIds);
        if (missingReviewTasks.length > 0) {
            return `Record missing ln-402 summaries for group ${state.current_group_id} before status verification`;
        }
        return `Checkpoint ${PHASES.GROUP_EXECUTION} and advance to ${PHASES.VERIFY_STATUSES}`;
    }
    if (state.phase === PHASES.VERIFY_STATUSES) {
        const missingReviewTasks = getMissingReviewTasks(state, getProcessedTaskIds(state));
        if (missingReviewTasks.length > 0) {
            return `Record latest ln-402 summaries before status verification: ${missingReviewTasks.join(", ")}`;
        }
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
        if (!hasCompletedStage2Summary(state)) {
            return "Record Stage 2 coordinator artifact before completion";
        }
        return "Fix self-check failures, then checkpoint PHASE_8_SELF_CHECK with pass=true";
    }

    const nextPhase = Array.from(ALLOWED_TRANSITIONS.get(state.phase) || [])[0];
    return nextPhase ? `Advance to ${nextPhase}` : "No automatic resume action available";
}
