// SOURCE-OF-TRUTH: shared/scripts/docs-pipeline-runtime/lib/phases.mjs. Edit ONLY here; run `node tools/marketplace/shared.mjs sync`

import { TERMINAL_RUNTIME_PHASES } from "../../coordinator-runtime/lib/runtime-constants.mjs";

export const PHASES = Object.freeze({
    CONFIG: "PHASE_0_CONFIG",
    SOURCE_SCAN: "PHASE_1_SOURCE_SCAN",
    CONFIRMATION: "PHASE_2_CONFIRMATION",
    DELEGATE: "PHASE_3_DELEGATE",
    QUALITY_GATE: "PHASE_4_QUALITY_GATE",
    CLEANUP: "PHASE_5_CLEANUP",
    SELF_CHECK: "PHASE_6_SELF_CHECK",
    PAUSED: TERMINAL_RUNTIME_PHASES.PAUSED,
    DONE: TERMINAL_RUNTIME_PHASES.DONE,
});
