export const AGENT_FAILURE_CLASSES = Object.freeze({
    NONE: "none",
    TIMEOUT_IDLE: "timeout_idle",
    TIMEOUT_PRODUCTIVE: "timeout_productive",
    PERMISSION_DENIAL: "permission_denial",
    TOOL_MISSING: "tool_missing",
    AUTH_MISSING: "auth_missing",
    RATE_LIMITED: "rate_limited",
    ASKED_QUESTION: "asked_question",
    AGENT_ERROR: "agent_error",
    UNKNOWN: "unknown",
});

function compactText(value) {
    return String(value || "").toLowerCase();
}

function classifyText(text) {
    if (/\b(rate limit|too many requests|quota exceeded|429|retry after)\b/.test(text)) {
        return AGENT_FAILURE_CLASSES.RATE_LIMITED;
    }
    if (/\b(permission denied|access denied|operation not permitted|not allowed|blocked by permissions)\b/.test(text)) {
        return AGENT_FAILURE_CLASSES.PERMISSION_DENIAL;
    }
    if (/\b(command .* not found|not found in path|enoent|is not recognized|required tool|tool missing)\b/.test(text)) {
        return AGENT_FAILURE_CLASSES.TOOL_MISSING;
    }
    if (/\b(authentication|unauthorized|login required|not logged in|api key|token missing|credentials)\b/.test(text)) {
        return AGENT_FAILURE_CLASSES.AUTH_MISSING;
    }
    if (/\?\s*$|should i|do you want|please confirm|need clarification/.test(text)) {
        return AGENT_FAILURE_CLASSES.ASKED_QUESTION;
    }
    return null;
}

export function classifyAgentResult({
    success = false,
    timedOut = false,
    exitCode = null,
    error = null,
    response = null,
    rawStdout = "",
    rawStderr = "",
    logContent = "",
    outputWritten = false,
    sessionId = null,
} = {}) {
    const progressSignals = {
        output_written: Boolean(outputWritten || response),
        log_written: Boolean(String(logContent || rawStdout || rawStderr).trim()),
        session_captured: Boolean(sessionId),
    };
    const hasProgress = Object.values(progressSignals).some(Boolean);

    let failureClass = AGENT_FAILURE_CLASSES.NONE;
    if (timedOut) {
        failureClass = hasProgress
            ? AGENT_FAILURE_CLASSES.TIMEOUT_PRODUCTIVE
            : AGENT_FAILURE_CLASSES.TIMEOUT_IDLE;
    } else if (!success) {
        const textClass = classifyText(compactText([error, response, rawStdout, rawStderr, logContent].join("\n")));
        failureClass = textClass || (exitCode === -1
            ? AGENT_FAILURE_CLASSES.TOOL_MISSING
            : AGENT_FAILURE_CLASSES.AGENT_ERROR);
    }

    return {
        failure_class: failureClass,
        progress_signals: progressSignals,
        session_usable: Boolean(success && failureClass === AGENT_FAILURE_CLASSES.NONE && sessionId),
    };
}
