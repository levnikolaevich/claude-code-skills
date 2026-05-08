import { z } from "zod";
import { STATUS_VALUES } from "./constants.mjs";

export const StatusEnum = z.enum(STATUS_VALUES);

export const WarningSchema = z.object({
    code: z.string(),
    message: z.string(),
    file: z.string().optional(),
    id: z.string().optional(),
    details: z.record(z.string(), z.any()).optional(),
});

export const FollowUpSchema = z.object({
    tool: z.string(),
    args: z.record(z.string(), z.any()).default({}),
});

export const BaseOutputSchema = z.object({
    status: StatusEnum,
    reason: z.string().optional(),
    next_action: z.string().optional(),
    message: z.string().optional(),
    summary: z.record(z.string(), z.any()).optional(),
    result: z.any().optional(),
    warnings: z.array(WarningSchema).optional(),
    follow_ups: z.array(FollowUpSchema).optional(),
    quality: z.record(z.string(), z.any()).optional(),
    provenance: z.any().optional(),
    details: z.record(z.string(), z.any()).optional(),
}).passthrough();

export const PathInput = z.object({
    path: z.string().describe("Project root containing docs/hypotheses, docs/goals, and benchmark/runs"),
}).strict();

export const SelectorInput = z.object({
    path: z.string().describe("Indexed project root"),
    id: z.string().optional().describe("Canonical H## or G## id"),
    claim_substring: z.string().optional().describe("Fallback selector by claim substring"),
}).strict();

export const LimitInput = z.object({
    limit: z.union([z.number(), z.string()]).optional().describe("Max rows to return"),
}).strict();

export function asLimit(value, fallback = 20, max = 200) {
    const n = value === undefined || value === null || value === "" ? fallback : Number(value);
    return Math.max(1, Math.min(max, Number.isFinite(n) ? Math.trunc(n) : fallback));
}
