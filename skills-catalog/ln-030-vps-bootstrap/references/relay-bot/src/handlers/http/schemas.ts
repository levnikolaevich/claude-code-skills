import { z } from "zod/v4";

export const UserPromptSubmitSchema = z
  .object({
    session_id: z.string().default(""),
    prompt: z.string().default(""),
  })
  .passthrough();

export const StopSchema = z
  .object({
    session_id: z.string().default(""),
    last_assistant_message: z.string().default(""),
  })
  .passthrough();

export const StopFailureSchema = z
  .object({
    session_id: z.string().default(""),
    error_type: z.string().default("unknown"),
  })
  .passthrough();

export const SessionStartSchema = z
  .object({
    session_id: z.string().default(""),
    source: z.string().default("startup"),
    model: z.string().nullable().optional(),
    cwd: z.string().nullable().optional(),
    transcript_path: z.string().nullable().optional(),
  })
  .passthrough();

export const SubagentStopSchema = z
  .object({
    session_id: z.string().default(""),
    agent_id: z.string().default(""),
    agent_type: z.string().default(""),
  })
  .passthrough();

export const ToolUseSchema = z
  .object({
    tool_name: z.string().default(""),
    tool_input: z.record(z.string(), z.unknown()).default({}),
    session_id: z.string().default(""),
  })
  .passthrough();

export const DispatchStartBodySchema = z.object({
  trigger: z.string().default("manual"),
  session_id: z.string().nullable().optional(),
  issue_number: z.number().int().nullable().optional(),
  issue_title: z.string().nullable().optional(),
  budget_5h_pct: z.number().int().nullable().optional(),
  budget_week_pct: z.number().int().nullable().optional(),
});

export const DispatchPhaseBodySchema = z.object({
  run_id: z.coerce.number().int(),
  phase: z.string().min(1),
  status: z.string().default("running"),
  verdict: z.string().nullable().optional(),
  details: z.string().nullable().optional(),
});

export const DispatchEndBodySchema = z.object({
  run_id: z.coerce.number().int(),
  status: z.string().default("finished"),
  pr_number: z.number().int().nullable().optional(),
  pr_url: z.string().nullable().optional(),
  branch: z.string().nullable().optional(),
  error: z.string().nullable().optional(),
});

export const MemoryAddBodySchema = z.object({
  category: z.string().min(1),
  text: z.string().min(1),
  tags: z.string().nullable().optional(),
  source: z.string().nullable().optional(),
  expires_at: z.number().int().nullable().optional(),
});

export const MemoryForgetBodySchema = z.object({
  memory_id: z.number().int().nullable().optional(),
  tag_match: z.string().nullable().optional(),
});
