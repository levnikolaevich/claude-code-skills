import { z } from "zod";
import { baseOutputSchema, boundedLimit, followUpSchema, flexLimit, warningSchema } from "@levnikolaevich/hex-common/runtime/schema";
import { STATUS_VALUES } from "./constants.mjs";

export const StatusEnum = z.enum(STATUS_VALUES);
export const WarningSchema = warningSchema();
export const FollowUpSchema = followUpSchema();
export const BaseOutputSchema = baseOutputSchema(StatusEnum);

export const PathInput = z.object({
    path: z.string().describe("Project root containing docs/hypotheses, docs/goals, and benchmark/runs"),
}).strict();

export const SelectorInput = z.object({
    path: z.string().describe("Indexed project root"),
    id: z.string().optional().describe("Canonical H## or G## id"),
    claim_substring: z.string().optional().describe("Fallback selector by claim substring"),
}).strict();

export const LimitInput = z.object({
    limit: flexLimit().describe("Max rows to return"),
}).strict();

export function asLimit(value, fallback = 20, max = 200) {
    return boundedLimit(value, fallback, max);
}
