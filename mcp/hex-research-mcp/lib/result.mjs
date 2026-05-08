import { result } from "@levnikolaevich/hex-common/runtime/results";

const ERROR_STATUSES = new Set(["ERROR"]);

export function researchResult(structured, { isError = null, large = false } = {}) {
    const response = result(structured, { large });
    if (isError === true) response.isError = true;
    if (isError === false) delete response.isError;
    if (isError === null && ERROR_STATUSES.has(structured?.status)) response.isError = true;
    return response;
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

