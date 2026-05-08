import { structuredToolResult } from "@levnikolaevich/hex-common/runtime/structured-tools";

export function researchResult(structured, { isError = null, large = false, errorStatuses = ["ERROR"] } = {}) {
    return structuredToolResult(structured, { isError, large, errorStatuses });
}

export function researchError(reason, message, nextAction = "fix_inputs", details = {}) {
    return researchResult({
        status: "ERROR",
        reason,
        next_action: nextAction,
        message,
        details,
    }, { isError: true });
}
