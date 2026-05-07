import { TERMINAL_RUNTIME_PHASES } from "../../references/scripts/coordinator-runtime/lib/runtime-constants.mjs";

export const PHASES = Object.freeze({
    QUEUED: "QUEUED",
    STAGE_0: "STAGE_0",
    STAGE_1: "STAGE_1",
    STAGE_2: "STAGE_2",
    STAGE_3: "STAGE_3",
    PAUSED: TERMINAL_RUNTIME_PHASES.PAUSED,
    DONE: TERMINAL_RUNTIME_PHASES.DONE,
});
