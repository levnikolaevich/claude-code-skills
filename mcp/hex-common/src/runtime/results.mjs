const LARGE_RESULT_META = { "anthropic/maxResultSizeChars": 500_000 };

import { classifyMcpFailure } from "./error-classifier.mjs";

/**
 * Build a canonical MCP tool result with structuredContent + text fallback.
 *
 * @param {object} structured - The structured payload (becomes structuredContent).
 *   Must include `status` field matching canonical vocabulary (OK, ERROR, CONFLICT, etc.).
 * @param {object} [opts]
 * @param {boolean} [opts.large=false] - Set _meta for large result persistence override.
 * @param {boolean|null} [opts.isError=null] - Force or suppress MCP tool-level error marking.
 * @param {string[]} [opts.errorStatuses=["ERROR"]] - Status values treated as errors when isError is null.
 * @returns {{ content: Array, structuredContent: object, isError?: boolean, _meta?: object }}
 */
export function result(structured, { large = false, isError = null, errorStatuses = ["ERROR"] } = {}) {
    const text = JSON.stringify(structured);
    const response = {
        content: [{ type: "text", text }],
        structuredContent: structured,
    };
    if (large) response._meta = LARGE_RESULT_META;
    const resolvedError = isError === null
        ? new Set(errorStatuses).has(structured?.status)
        : isError;
    if (resolvedError) response.isError = true;
    return response;
}

/**
 * Build a canonical MCP error result.
 *
 * @param {string} code - Error code (e.g., "FILE_NOT_FOUND", "GREP_ERROR").
 * @param {string} message - Human-readable error message.
 * @param {string} recovery - Actionable recovery instruction.
 * @param {object} [opts]
 * @param {boolean} [opts.large=false] - Set _meta for large result persistence override.
 * @param {object} [opts.extra=null] - Additional top-level fields to preserve domain-specific
 *   envelope fields (e.g., hex-graph next_action/reason, hex-ssh host/stderr/exit_code).
 * @returns {{ content: Array, structuredContent: object, isError: true, _meta?: object }}
 */
export function errorResult(code, message, recovery, { large = false, extra = null } = {}) {
    const normalizedCode = String(code || "ERROR");
    const normalizedMessage = String(message || "Unknown MCP tool error");
    const normalizedRecovery = String(recovery || "Review the error and retry with corrected inputs");
    const classification = classifyMcpFailure({
        code: normalizedCode,
        message: normalizedMessage,
        recovery: normalizedRecovery,
    });
    const payload = {
        status: "ERROR",
        code: normalizedCode,
        summary: normalizedMessage,
        next_action: classification.next_action,
        recovery: normalizedRecovery,
        failure_class: classification.failure_class,
        error: {
            code: normalizedCode,
            message: normalizedMessage,
            recovery: normalizedRecovery,
        },
    };
    if (extra && typeof extra === "object") {
        Object.assign(payload, extra);
    }
    return result(payload, { large });
}
