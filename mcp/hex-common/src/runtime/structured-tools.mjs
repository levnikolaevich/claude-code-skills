import { result } from "./results.mjs";

export const READ_ONLY_ANNOTATIONS = {
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: false,
};

export const DESTRUCTIVE_IDEMPOTENT_ANNOTATIONS = {
    readOnlyHint: false,
    destructiveHint: true,
    idempotentHint: true,
    openWorldHint: false,
};

export const DESTRUCTIVE_NON_IDEMPOTENT_ANNOTATIONS = {
    readOnlyHint: false,
    destructiveHint: true,
    idempotentHint: false,
    openWorldHint: false,
};

export function isStatusError(structured, errorStatuses = ["ERROR"]) {
    return new Set(errorStatuses).has(structured?.status);
}

export function structuredToolResult(structured, {
    errorStatuses = ["ERROR"],
    isError = null,
    large = false,
    largeThreshold = null,
} = {}) {
    const payloadSize = largeThreshold === null ? 0 : JSON.stringify(structured).length;
    const shouldMarkLarge = large || (largeThreshold !== null && payloadSize > largeThreshold);
    const resolvedError = isError === null ? isStatusError(structured, errorStatuses) : isError;
    return result(structured, { isError: resolvedError, large: shouldMarkLarge });
}

export function registerStructuredTool(server, name, spec, handler, {
    outputSchema,
    errorStatuses = ["ERROR"],
    largeThreshold = 100_000,
    normalizeError = defaultNormalizeError,
    resultFactory = structuredToolResult,
} = {}) {
    server.registerTool(name, {
        ...(outputSchema ? { outputSchema } : {}),
        ...spec,
    }, async (params) => {
        try {
            const structured = await handler(params ?? {});
            return resultFactory(structured, { errorStatuses, largeThreshold });
        } catch (error) {
            return resultFactory(normalizeError(error), { isError: true });
        }
    });
}

export function defaultNormalizeError(error) {
    return {
        status: "ERROR",
        reason: "tool_error",
        next_action: "inspect_error",
        message: error instanceof Error ? error.message : String(error),
        details: error instanceof Error && error.stack ? { stack: error.stack } : {},
    };
}
