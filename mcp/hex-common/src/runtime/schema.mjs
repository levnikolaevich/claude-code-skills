import { z } from "zod";

// LLM clients may send booleans as strings ("true"/"false").
// z.coerce.boolean() is unsafe: Boolean("false") === true.
export const flexBool = () => z.preprocess(
    v => typeof v === "string" ? v === "true" : v,
    z.boolean().optional()
).optional();

// LLM clients may send numbers as strings ("5" instead of 5).
// z.coerce.number() generates {"type":"number"} and strict MCP clients reject strings.
export const flexNum = () => z.preprocess(
    v => typeof v === "string" ? Number(v) : v,
    z.number().optional()
).optional();

export const flexLimit = () => z.union([z.number(), z.string()]).optional();

export function boundedLimit(value, fallback = 20, max = 200) {
    const n = value === undefined || value === null || value === "" ? fallback : Number(value);
    return Math.max(1, Math.min(max, Number.isFinite(n) ? Math.trunc(n) : fallback));
}

export function warningSchema() {
    return z.object({
        code: z.string(),
        message: z.string(),
        file: z.string().optional(),
        id: z.string().optional(),
        details: z.record(z.string(), z.any()).optional(),
    });
}

export function followUpSchema() {
    return z.object({
        tool: z.string(),
        args: z.record(z.string(), z.any()).default({}),
    });
}

export function baseOutputSchema(statusSchema = z.string()) {
    return z.object({
        status: statusSchema,
        reason: z.string().optional(),
        next_action: z.string().optional(),
        message: z.string().optional(),
        summary: z.record(z.string(), z.any()).optional(),
        result: z.any().optional(),
        warnings: z.array(warningSchema()).optional(),
        follow_ups: z.array(followUpSchema()).optional(),
        quality: z.record(z.string(), z.any()).optional(),
        provenance: z.any().optional(),
        details: z.record(z.string(), z.any()).optional(),
    }).passthrough();
}
