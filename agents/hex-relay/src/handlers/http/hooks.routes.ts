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

export { getPendingFanoutAcksTotal } from "../../services/hookIngestion.service.js";

export interface HookDeps {
  hookIngestion: HookIngestionService;
}

export function registerHookRoutes(app: FastifyInstance, deps: HookDeps): void {
  app.post("/hook/user-prompt-submit", async (req, reply) => {
    const parsed = UserPromptSubmitSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(200).send({});
    const { session_id, prompt, agent } = parsed.data;
    if (!session_id) return reply.code(200).send({});
    deps.hookIngestion.userPromptSubmit({ sessionId: session_id, prompt, agent });
    return reply.code(200).send({});
  });

  app.post("/hook/stop", async (req, reply) => {
    const parsed = StopSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(200).send({});
    const { session_id, last_assistant_message } = parsed.data;
    if (!session_id) return reply.code(200).send({});
    deps.hookIngestion.stop({
      sessionId: session_id,
      lastAssistantMessage: last_assistant_message,
    });
    return reply.code(200).send({});
  });

  app.post("/hook/stop-failure", async (req, reply) => {
    const parsed = StopFailureSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(200).send({});
    const { session_id, error_type, agent } = parsed.data;
    deps.hookIngestion.stopFailure({
      sessionId: session_id,
      errorType: error_type,
      agent,
      payload: parsed.data,
    });
    return reply.code(200).send({});
  });

  app.post("/hook/session-start", async (req, reply) => {
    const parsed = SessionStartSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(200).send({});
    const { session_id, source, model, cwd, transcript_path, agent } = parsed.data;
    const { additionalContext } = deps.hookIngestion.sessionStart({
      sessionId: session_id,
      source,
      model: model ?? null,
      cwd: cwd ?? null,
      transcriptPath: transcript_path ?? null,
      agent,
    });
    return reply.code(200).send({
      hookSpecificOutput: {
        hookEventName: "SessionStart",
        additionalContext,
      },
    });
  });

  app.post("/hook/subagent-stop", async (req, reply) => {
    const parsed = SubagentStopSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(200).send({});
    const { session_id, agent_id, agent_type } = parsed.data;
    deps.hookIngestion.subagentStop({
      sessionId: session_id,
      agentId: agent_id,
      agentType: agent_type,
    });
    return reply.code(200).send({});
  });

  app.post("/hook/pre-tool-use", async (req, reply) => {
    const parsed = ToolUseSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(200).send({});
    const { tool_name, tool_input, session_id, duration_ms } = parsed.data;
    deps.hookIngestion.preToolUse({
      sessionId: session_id,
      toolName: tool_name,
      toolInput: tool_input,
      durationMs: duration_ms,
    });
    return reply.code(200).send({});
  });

  app.post("/hook/post-tool-use", async (req, reply) => {
    if (!deps.hookIngestion.allowsVerboseBash()) {
      return reply.code(200).send({});
    }
    const parsed = ToolUseSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(200).send({});
    const { tool_name, tool_input, session_id, duration_ms } = parsed.data;
    deps.hookIngestion.postToolUse({
      sessionId: session_id,
      toolName: tool_name,
      toolInput: tool_input,
      durationMs: duration_ms,
    });
    return reply.code(200).send({});
  });
}
