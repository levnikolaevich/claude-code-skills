import { PHASES } from "./phases.mjs";

const TRANSITIONS = new Map([
    [`${PHASES.QUEUED}->${PHASES.STAGE_0}`, () => ({ ok: true })],
    [`${PHASES.QUEUED}->${PHASES.STAGE_1}`, () => ({ ok: true })],
    [`${PHASES.QUEUED}->${PHASES.STAGE_2}`, () => ({ ok: true })],
    [`${PHASES.QUEUED}->${PHASES.STAGE_3}`, () => ({ ok: true })],

    [`${PHASES.STAGE_0}->${PHASES.STAGE_1}`, (state, checkpoints) => {
        const checkpoint = checkpoints?.[PHASES.STAGE_0]?.payload;
        const summary = state.stage_summaries?.stage_0?.payload;
        if (!checkpoint || checkpoint.stage !== 0) {
            return { ok: false, error: "Stage 0 checkpoint missing", recovery: "Run ln-300 first" };
        }
        if (!summary || summary.stage !== 0 || summary.status !== "completed") {
            return { ok: false, error: "Stage 0 coordinator summary missing", recovery: "Record ln-300 stage artifact" };
        }
        return { ok: true };
    }],

    [`${PHASES.STAGE_1}->${PHASES.STAGE_2}`, (state, checkpoints) => {
        const checkpoint = checkpoints?.[PHASES.STAGE_1]?.payload;
        const summary = state.stage_summaries?.stage_1?.payload;
        if (!checkpoint || checkpoint.stage !== 1) {
            return { ok: false, error: "Stage 1 checkpoint missing", recovery: "Run ln-310 first" };
        }
        if (!summary || summary.stage !== 1 || summary.status !== "completed") {
            return { ok: false, error: "Stage 1 coordinator summary missing", recovery: "Record ln-310 stage artifact" };
        }
        if (summary.verdict !== "GO") {
            return { ok: false, error: `Verdict is ${summary.verdict}, not GO`, recovery: "Fix validation issues" };
        }
        if (summary.readiness_score != null && summary.readiness_score < 5) {
            return { ok: false, error: `Readiness ${summary.readiness_score} < 5`, recovery: "Improve story quality" };
        }
        return { ok: true };
    }],

    [`${PHASES.STAGE_1}->${PHASES.STAGE_1}`, state => {
        if (state.validation_retries >= 1) {
            return { ok: false, error: "Validation retry exhausted", recovery: "Escalate to user" };
        }
        state.validation_retries += 1;
        return { ok: true, counter_incremented: "validation_retries" };
    }],

    [`${PHASES.STAGE_2}->${PHASES.STAGE_3}`, (state, checkpoints) => {
        const checkpoint = checkpoints?.[PHASES.STAGE_2]?.payload;
        const summary = state.stage_summaries?.stage_2?.payload;
        if (!checkpoint || checkpoint.stage !== 2) {
            return { ok: false, error: "Stage 2 checkpoint missing", recovery: "Run ln-400 first" };
        }
        if (!summary || summary.stage !== 2 || summary.status !== "completed") {
            return { ok: false, error: "Stage 2 coordinator summary missing", recovery: "Record ln-400 stage artifact" };
        }
        if (summary.story_status !== "To Review") {
            return { ok: false, error: `Story status ${summary.story_status} is not To Review`, recovery: "Finish execution stage" };
        }
        return { ok: true };
    }],

    [`${PHASES.STAGE_3}->${PHASES.DONE}`, (state, checkpoints) => {
        const checkpoint = checkpoints?.[PHASES.STAGE_3]?.payload;
        const summary = state.stage_summaries?.stage_3?.payload;
        if (!checkpoint || checkpoint.stage !== 3) {
            return { ok: false, error: "Stage 3 checkpoint missing", recovery: "Run ln-500 first" };
        }
        const validVerdicts = ["PASS", "CONCERNS", "WAIVED"];
        if (!summary || summary.stage !== 3 || summary.status !== "completed") {
            return { ok: false, error: "Stage 3 coordinator summary missing", recovery: "Record ln-500 stage artifact" };
        }
        if (!validVerdicts.includes(summary.verdict)) {
            return { ok: false, error: `Verdict ${summary.verdict} not in ${validVerdicts.join(",")}`, recovery: "Quality gate must pass" };
        }
        return { ok: true };
    }],

    [`${PHASES.STAGE_3}->${PHASES.STAGE_2}`, state => {
        const summary = state.stage_summaries?.stage_3?.payload;
        if (!summary || summary.verdict !== "FAIL") {
            return { ok: false, error: "Stage 3 FAIL summary missing", recovery: "Record failing ln-500 stage artifact before rework loop" };
        }
        if (state.quality_cycles >= 2) {
            return { ok: false, error: "Quality cycle limit reached (2)", recovery: "Escalate to user" };
        }
        state.quality_cycles += 1;
        return { ok: true, counter_incremented: "quality_cycles" };
    }],
]);

export function validateTransition(state, toPhase, checkpoints) {
    if (toPhase === PHASES.PAUSED) {
        return { ok: true };
    }
    const key = `${state.phase}->${toPhase}`;
    const guard = TRANSITIONS.get(key);
    if (!guard) {
        return { ok: false, error: `Invalid transition: ${key}`, recovery: "Check pipeline state graph" };
    }
    return guard(state, checkpoints);
}

export function computeResumeAction(state, checkpoints) {
    if (!state || state.complete || state.phase === PHASES.DONE) {
        return "Pipeline complete";
    }
    if (state.phase === PHASES.PAUSED) {
        return `Paused: ${state.paused_reason || "manual intervention required"}`;
    }
    if (state.phase === PHASES.QUEUED) {
        return "Determine target stage from kanban, then advance";
    }
    if (!checkpoints?.[state.phase]) {
        return `Invoke Skill for ${state.phase} and write its checkpoint`;
    }
    if (state.phase === PHASES.STAGE_0 && !state.stage_summaries?.stage_0) {
        return "Read ln-300 coordinator artifact and record stage summary";
    }
    if (state.phase === PHASES.STAGE_0) {
        return "Advance to STAGE_1 and invoke ln-310";
    }
    if (state.phase === PHASES.STAGE_1 && !state.stage_summaries?.stage_1) {
        return "Read ln-310 coordinator artifact and record stage summary";
    }
    if (state.phase === PHASES.STAGE_1) {
        return "Advance to STAGE_2 and invoke ln-400";
    }
    if (state.phase === PHASES.STAGE_2 && !state.stage_summaries?.stage_2) {
        return "Read ln-400 coordinator artifact and record stage summary";
    }
    if (state.phase === PHASES.STAGE_2) {
        return "Advance to STAGE_3 and invoke ln-500";
    }
    if (state.phase === PHASES.STAGE_3 && !state.stage_summaries?.stage_3) {
        return "Read ln-500 coordinator artifact and record stage summary";
    }
    if (state.phase === PHASES.STAGE_3) {
        return "Complete pipeline";
    }
    return "No automatic resume action available";
}

export function determineTargetStage(kanbanStatus, hasTasks) {
    const status = kanbanStatus.toLowerCase().trim();
    if ((status === "backlog") && !hasTasks) return PHASES.STAGE_0;
    if ((status === "backlog") && hasTasks) return PHASES.STAGE_1;
    if (["todo", "in progress", "to rework"].includes(status)) return PHASES.STAGE_2;
    if (status === "to review") return PHASES.STAGE_3;
    if (["done", "postponed", "canceled"].includes(status)) return null;
    return PHASES.STAGE_0;
}
