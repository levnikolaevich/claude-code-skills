export const FAILURE_CLASS = Object.freeze({
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

const INPUT_ERROR_CODES = new Set([
    "BAD_INPUT",
    "BAD_PATH",
    "BAD_REMOTE_PLATFORM",
    "INVALID_INPUT",
    "INVALID_EDIT_PAYLOAD",
    "INVALID_JSON",
    "PATH_OUTSIDE_ROOT",
    "PATH_NOT_FOUND",
    "FILE_NOT_FOUND",
    "FILE_OUTSIDE_PROJECT",
    "OUT_OF_RANGE",
    "UNSUPPORTED_REMOTE_PLATFORM",
]);

const PERMISSION_ERROR_CODES = new Set([
    "SSH_HOST_NOT_ALLOWED",
    "BLOCKED_COMMAND",
    "REMOTE_SSH_DISABLED",
]);

const AUTH_ERROR_CODES = new Set([
    "SSH_AUTH_FAILED",
    "SSH_AUTH_MISSING",
    "SSH_KEY_UNREADABLE",
]);

const TIMEOUT_ERROR_CODES = new Set([
    "SSH_EXEC_TIMEOUT",
    "SSH_CONNECT_TIMEOUT",
    "EXEC_TIMEOUT",
    "TRANSFER_TIMEOUT",
]);

function textFor(input) {
    return [
        input?.code,
        input?.message,
        input?.recovery,
        input?.stderr,
        input?.error,
    ].filter(Boolean).map(String).join("\n");
}

export function classifyMcpFailure(input = {}) {
    const code = String(input.code || "").toUpperCase();
    const text = textFor(input).toLowerCase();

    if (/\b(429|rate limit|too many requests|quota exceeded|throttl)/i.test(text) || code.includes("RATE_LIMIT")) {
        return { failure_class: FAILURE_CLASS.RATE_LIMITED, next_action: "defer_retry" };
    }
    if (/\b(auth|authentication|unauthorized|not authorized|login required|credential|token missing|no user for host|permission denied \(publickey\)|publickey)\b/i.test(text)
        || code.includes("AUTH")
        || AUTH_ERROR_CODES.has(code)) {
        return { failure_class: FAILURE_CLASS.AUTH_MISSING, next_action: "authenticate" };
    }
    if (/\b(eacces|eperm|permission denied|access denied|operation not permitted|forbidden)\b/i.test(text)
        || code === "GRAPH_DB_UNREADABLE"
        || PERMISSION_ERROR_CODES.has(code)) {
        return { failure_class: FAILURE_CLASS.PERMISSION_DENIAL, next_action: "fix_permissions" };
    }
    if (/\b(enoent|command not found|not recognized as|not found in path|required tool|provider setup failed|missing provider|tool missing)\b/i.test(text)
        || code === "GRAPH_PROVIDER_SETUP_FAILED") {
        return { failure_class: FAILURE_CLASS.TOOL_MISSING, next_action: "install_tool" };
    }
    if (/\b(etimedout|timed out|timeout|transfer_timeout|connection timed out|database is locked|busy or locked)\b/i.test(text)
        || code.includes("TIMEOUT")
        || code === "GRAPH_DB_BUSY"
        || TIMEOUT_ERROR_CODES.has(code)) {
        return { failure_class: FAILURE_CLASS.TIMEOUT_IDLE, next_action: "retry_after_wait" };
    }
    if (/\?\s*$|\b(please confirm|confirm\?|choose one|which option)\b/i.test(text)) {
        return { failure_class: FAILURE_CLASS.ASKED_QUESTION, next_action: "fix_inputs" };
    }
    if (INPUT_ERROR_CODES.has(code) || code.startsWith("INVALID_") || code.endsWith("_REQUIRED")) {
        return { failure_class: FAILURE_CLASS.UNKNOWN, next_action: "fix_inputs" };
    }
    return { failure_class: FAILURE_CLASS.UNKNOWN, next_action: "fix_inputs" };
}
