import type { FastifyInstance } from "fastify";
import type { HookIngestionService } from "../../services/hookIngestion.service.js";
import {
  UserPromptSubmitSchema,
  StopSchema,
  StopFailureSchema,
  SessionStartSchema,
  SubagentStopSchema,
  ToolUseSchema,
} from "./schemas.js";
import { sendOutcome, sendServiceError } from "./serviceErrors.js";
import { serviceError } from "../../services/outcome.js";

export { getPendingFanoutAcksTotal } from "../../services/hookIngestion.service.js";

export interface HookDeps {
  hookIngestion: HookIngestionService;
}

export function registerHookRoutes(app: FastifyInstance, deps: HookDeps): void {
  app.post("/hook/user-prompt-submit", async (req, reply) => {
    const parsed = UserPromptSubmitSchema.safeParse(req.body);
    if (!parsed.success) return sendValidationError(reply, "invalid user-prompt-submit hook");
    const { session_id, prompt, agent } = parsed.data;
    if (!session_id) return sendValidationError(reply, "missing hook session id");
    return sendOutcome(
      reply,
      deps.hookIngestion.userPromptSubmit({ sessionId: session_id, prompt, agent }),
      () => ({ ok: true })
    );
  });

  app.post("/hook/stop", async (req, reply) => {
    const parsed = StopSchema.safeParse(req.body);
    if (!parsed.success) return sendValidationError(reply, "invalid stop hook");
    const { session_id, last_assistant_message } = parsed.data;
    if (!session_id) return sendValidationError(reply, "missing hook session id");
    return sendOutcome(
      reply,
      deps.hookIngestion.stop({
        sessionId: session_id,
        lastAssistantMessage: last_assistant_message,
      }),
      () => ({ ok: true })
    );
  });

  app.post("/hook/stop-failure", async (req, reply) => {
    const parsed = StopFailureSchema.safeParse(req.body);
    if (!parsed.success) return sendValidationError(reply, "invalid stop-failure hook");
    const { session_id, error_type, agent } = parsed.data;
    return sendOutcome(
      reply,
      deps.hookIngestion.stopFailure({
        sessionId: session_id,
        errorType: error_type,
        agent,
        payload: parsed.data,
      }),
      () => ({ ok: true })
    );
  });

  app.post("/hook/session-start", async (req, reply) => {
    const parsed = SessionStartSchema.safeParse(req.body);
    if (!parsed.success) return sendValidationError(reply, "invalid session-start hook");
    const { session_id, source, model, cwd, transcript_path, agent } = parsed.data;
    const outcome = deps.hookIngestion.sessionStart({
      sessionId: session_id,
      source,
      model: model ?? null,
      cwd: cwd ?? null,
      transcriptPath: transcript_path ?? null,
      agent,
    });
    if (!outcome.ok) return sendServiceError(reply, outcome.error);
    const { additionalContext } = outcome.value;
    return reply.code(200).send({
      ok: true,
      hookSpecificOutput: {
        hookEventName: "SessionStart",
        additionalContext,
      },
    });
  });

  app.post("/hook/subagent-stop", async (req, reply) => {
    const parsed = SubagentStopSchema.safeParse(req.body);
    if (!parsed.success) return sendValidationError(reply, "invalid subagent-stop hook");
    const { session_id, agent_id, agent_type } = parsed.data;
    return sendOutcome(
      reply,
      deps.hookIngestion.subagentStop({
        sessionId: session_id,
        agentId: agent_id,
        agentType: agent_type,
      }),
      () => ({ ok: true })
    );
  });

  app.post("/hook/pre-tool-use", async (req, reply) => {
    const parsed = ToolUseSchema.safeParse(req.body);
    if (!parsed.success) return sendValidationError(reply, "invalid pre-tool-use hook");
    const { tool_name, tool_input, session_id, duration_ms } = parsed.data;
    return sendOutcome(
      reply,
      deps.hookIngestion.preToolUse({
        sessionId: session_id,
        toolName: tool_name,
        toolInput: tool_input,
        durationMs: duration_ms,
      }),
      () => ({ ok: true })
    );
  });

  app.post("/hook/post-tool-use", async (req, reply) => {
    if (!deps.hookIngestion.allowsVerboseBash()) {
      return reply.code(200).send({});
    }
    const parsed = ToolUseSchema.safeParse(req.body);
    if (!parsed.success) return sendValidationError(reply, "invalid post-tool-use hook");
    const { tool_name, tool_input, session_id, duration_ms } = parsed.data;
    return sendOutcome(
      reply,
      deps.hookIngestion.postToolUse({
        sessionId: session_id,
        toolName: tool_name,
        toolInput: tool_input,
        durationMs: duration_ms,
      }),
      () => ({ ok: true })
    );
  });
}

function sendValidationError(reply: Parameters<typeof sendServiceError>[0], message: string) {
  return sendServiceError(
    reply,
    serviceError({
      code: "hook_payload_invalid",
      kind: "validation",
      message,
      retryable: false,
    })
  );
}
