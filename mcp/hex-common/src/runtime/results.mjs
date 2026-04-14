const LARGE_RESULT_META = { "anthropic/maxResultSizeChars": 500_000 };

/**
 * Build a canonical MCP tool result with structuredContent + text fallback.
 *
 * @param {object} structured - The structured payload (becomes structuredContent).
 *   Must include `status` field matching canonical vocabulary (OK, ERROR, CONFLICT, etc.).
 * @param {object} [opts]
 * @param {boolean} [opts.large=false] - Set _meta for large result persistence override.
 * @returns {{ content: Array, structuredContent: object, isError?: boolean, _meta?: object }}
 */
export function result(structured, { large = false } = {}) {
    const text = JSON.stringify(structured);
    const response = {
        content: [{ type: "text", text }],
        structuredContent: structured,
    };
    if (large) response._meta = LARGE_RESULT_META;
    if (structured.status === "ERROR") response.isError = true;
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
    const payload = {
        status: "ERROR",
        error: { code, message, recovery },
    };
    if (extra && typeof extra === "object") {
        Object.assign(payload, extra);
    }
    return result(payload, { large });
}
