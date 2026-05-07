// SOURCE-OF-TRUTH: shared/scripts/environment-setup-runtime/lib/phases.mjs. Edit ONLY here; run `node tools/marketplace/shared.mjs sync`

import { TERMINAL_RUNTIME_PHASES } from "../../coordinator-runtime/lib/runtime-constants.mjs";

export const PHASES = Object.freeze({
    CONFIG: "PHASE_0_CONFIG",
    ASSESS: "PHASE_1_ASSESS",
    PROVIDER_SELECTION: "PHASE_1B_PROVIDER_SELECTION",
    DISPATCH_PLAN: "PHASE_2_DISPATCH_PLAN",
    WORKER_EXECUTION: "PHASE_3_WORKER_EXECUTION",
    VERIFY: "PHASE_4_VERIFY",
    WRITE_ENV_STATE: "PHASE_5_WRITE_ENV_STATE",
    SELF_CHECK: "PHASE_6_SELF_CHECK",
    PAUSED: TERMINAL_RUNTIME_PHASES.PAUSED,
    DONE: TERMINAL_RUNTIME_PHASES.DONE,
});
