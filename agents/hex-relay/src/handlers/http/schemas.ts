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

export const DispatchRecentQuerySchema = z.object({
  n: z.coerce.number().int().default(10),
});

export const MemoryRecentQuerySchema = z.object({
  n: z.coerce.number().int().default(20),
  category: z.string().optional(),
});

export const OkResponseSchema = z.object({
  ok: z.literal(true),
});

export const DispatchStartResponseSchema = z.object({
  run_id: z.number().int(),
});

export const DispatchPhaseWireSchema = z.object({
  id: z.number().int(),
  run_id: z.number().int(),
  phase: z.string(),
  ts_started: z.number().int(),
  ts_finished: z.number().int().nullable(),
  status: z.string(),
  verdict: z.string().nullable(),
  details: z.string().nullable(),
});

export const DispatchRunWireSchema = z.object({
  id: z.number().int(),
  ts_started: z.number().int(),
  ts_finished: z.number().int().nullable(),
  trigger: z.string(),
  session_id: z.string().nullable(),
  issue_number: z.number().int().nullable(),
  issue_title: z.string().nullable(),
  status: z.string(),
  budget_5h_pct: z.number().int().nullable(),
  budget_week_pct: z.number().int().nullable(),
  pr_number: z.number().int().nullable(),
  pr_url: z.string().nullable(),
  branch: z.string().nullable(),
  error: z.string().nullable(),
  phases: z.array(DispatchPhaseWireSchema),
});

export const DispatchRecentResponseSchema = z.object({
  runs: z.array(DispatchRunWireSchema),
});

export const MemoryAddResponseSchema = z.object({
  memory_id: z.number().int(),
});

export const MemoryWireSchema = z.object({
  id: z.number().int(),
  ts_created: z.number().int(),
  ts_used: z.number().int().nullable(),
  category: z.string(),
  text: z.string(),
  tags: z.string().nullable(),
  source: z.string().nullable(),
  expires_at: z.number().int().nullable(),
});

export const MemoryRecentResponseSchema = z.object({
  memories: z.array(MemoryWireSchema),
});

export const MemoryForgetResponseSchema = z.object({
  deleted: z.number().int(),
});

export const TaskPollResponseSchema = z.object({
  ok: z.literal(true),
  count: z.number().int(),
});

export const HealthResponseSchema = z.object({
  ok: z.literal(true),
  version: z.string(),
  relay_schema_version: z.string(),
  package_version: z.string(),
  god_session_ready: z.boolean(),
  control_busy: z.boolean(),
  control_pending: z.number().int(),
  control_current: z.string().nullable(),
  control_last_action: z.string().nullable(),
  inbound_queued: z.number().int(),
  inbound_failed: z.number().int(),
  inbound_rejected: z.number().int(),
  pending_count: z.number().int(),
  outbox_queued: z.number().int(),
  outbox_abandoned: z.number().int(),
  outbox_unknown: z.number().int(),
  active_session_short: z.string().nullable(),
  db_size_bytes: z.number().int(),
});
