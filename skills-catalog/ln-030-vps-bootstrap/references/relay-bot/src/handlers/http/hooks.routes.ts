import type { FastifyInstance } from "fastify";
import type { Logger } from "../../lib/logger.js";
import type { MessagesRepo } from "../../infrastructure/db/repositories/messages.repo.js";
import type { PendingReplyRepo } from "../../infrastructure/db/repositories/pendingReply.repo.js";
import type { SessionsRepo } from "../../infrastructure/db/repositories/sessions.repo.js";
import type { OutboxService } from "../../services/outbox.service.js";
import type { SessionService } from "../../services/session.service.js";
import type { TodoDiffService } from "../../services/todoDiff.service.js";
import type { MemoryService } from "../../services/memory.service.js";
import type { DispatchService } from "../../services/dispatch.service.js";
import type { VerbosityService } from "../../services/verbosity.service.js";
import { FormatService } from "../../services/format.service.js";
import { TIMING, TG_PREFIX_RE } from "../../config/paths.js";
import {
  UserPromptSubmitSchema,
  StopSchema,
  StopFailureSchema,
  SessionStartSchema,
  SubagentStopSchema,
  ToolUseSchema,
} from "./schemas.js";

export interface HookDeps {
  log: Logger;
  messagesRepo: MessagesRepo;
  pendingRepo: PendingReplyRepo;
  sessionsRepo: SessionsRepo;
  outbox: OutboxService;
  sessionService: SessionService;
  todoDiff: TodoDiffService;
  memory: MemoryService;
  dispatch: DispatchService;
  verbosity: VerbosityService;
  primaryOperator: number;
  dbPath: string;
}

const STOP_FAILURE_DEDUP_MS = 10_000;

function nowTs(): number {
  return Math.floor(Date.now() / 1000);
}

const MONTH_ABBR = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

function formatDispatchTs(epoch: number): string {
  const d = new Date(epoch * 1000);
  const month = MONTH_ABBR[d.getMonth()] ?? "???";
  const day = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${month} ${day} ${hh}:${mm}`;
}

function operatorChatForSession(deps: HookDeps, sessionId: string | null): number {
  if (!sessionId) return deps.primaryOperator;
  const pending = deps.pendingRepo.get(sessionId);
  if (!pending) return deps.primaryOperator;
  const chatId = deps.messagesRepo.getChatId(pending.inboundMsgId);
  return chatId ?? deps.primaryOperator;
}

export function registerHookRoutes(app: FastifyInstance, deps: HookDeps): void {
  const stopFailureDedup = new Map<string, number>();

  app.post("/hook/user-prompt-submit", async (req, reply) => {
    const parsed = UserPromptSubmitSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(200).send({});
    const { session_id, prompt } = parsed.data;
    if (!session_id) return reply.code(200).send({});
    deps.sessionService.insertEvent(session_id, "user_prompt_submit", {
      prompt_len: prompt.length,
      starts_with_tg: prompt.startsWith("[tg id="),
    });
    const m = TG_PREFIX_RE.exec(prompt);
    if (!m) return reply.code(200).send({});
    const chatId = Number.parseInt(m[1] ?? "0", 10);
    const tgMsgId = Number.parseInt(m[2] ?? "0", 10);
    const inbound = deps.messagesRepo.findByTg(chatId, tgMsgId);
    const inboundId = inbound?.id ?? 0;
    if (inbound) {
      deps.messagesRepo.update(inbound.id, { sessionId: session_id });
    }
    deps.pendingRepo.set(session_id, inboundId, prompt);
    deps.log.info(
      { session: session_id.slice(0, 8), inboundId, chatId, tgMsgId },
      "HOOK user-prompt-submit pending set"
    );
    return reply.code(200).send({});
  });

  app.post("/hook/stop", async (req, reply) => {
    const parsed = StopSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(200).send({});
    const { session_id, last_assistant_message } = parsed.data;
    const lastMsg = last_assistant_message.trim();
    if (!session_id) return reply.code(200).send({});
    deps.sessionService.insertEvent(session_id, "stop", { msg_len: lastMsg.length });
    if (!lastMsg) return reply.code(200).send({});
    const pending = deps.pendingRepo.get(session_id);
    if (!pending) {
      deps.log.info({ session: session_id.slice(0, 8) }, "HOOK stop no pending");
      return reply.code(200).send({});
    }
    const replyChatId = deps.messagesRepo.getChatId(pending.inboundMsgId) ?? deps.primaryOperator;
    const finalText = FormatService.prefixReply(lastMsg);
    const auditMsgId = deps.messagesRepo.insertOutboundAudit(
      lastMsg,
      session_id,
      pending.inboundMsgId
    );
    const outboxId = deps.outbox.enqueueReply({
      text: finalText,
      chatId: replyChatId,
      repliedToId: pending.inboundMsgId,
      sessionId: session_id,
      auditMsgId,
    });
    deps.pendingRepo.clear(session_id);
    deps.log.info(
      { session: session_id.slice(0, 8), outboxId, len: lastMsg.length },
      "HOOK stop enqueued reply"
    );
    return reply.code(200).send({});
  });

  app.post("/hook/stop-failure", async (req, reply) => {
    const parsed = StopFailureSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(200).send({});
    const { session_id, error_type } = parsed.data;
    deps.sessionService.insertEvent(session_id, "stop_failure", { error_type });
    const now = Date.now();
    const last = stopFailureDedup.get(session_id) ?? 0;
    if (now - last > STOP_FAILURE_DEDUP_MS) {
      deps.log.warn(
        { session: session_id.slice(0, 8), error_type },
        "HOOK stop-failure (non-terminal; pending preserved)"
      );
      stopFailureDedup.set(session_id, now);
    }
    return reply.code(200).send({});
  });

  app.post("/hook/session-start", async (req, reply) => {
    const parsed = SessionStartSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(200).send({});
    const { session_id, source, model, cwd, transcript_path } = parsed.data;
    let previousSession: string | null;
    try {
      previousSession = deps.sessionsRepo.lastActiveSid();
      if (previousSession === session_id) previousSession = null;
    } catch {
      previousSession = null;
    }
    const owner = deps.sessionService.recordStart({
      sessionId: session_id,
      source,
      model: model ?? null,
      cwd: cwd ?? null,
      transcriptPath: transcript_path ?? null,
      previousSession,
      primaryOperator: deps.primaryOperator,
    });
    deps.log.info(
      {
        session: session_id.slice(0, 8),
        source,
        model,
        prev: (previousSession ?? "").slice(0, 8),
        owner,
      },
      "HOOK session-start"
    );
    const additionalContext = buildSessionStartContext(deps, {
      sessionId: session_id,
      source,
      previousSession,
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
    deps.sessionService.insertEvent(session_id, "subagent_stop", {
      agent_id,
      agent_type,
    });
    deps.log.info(
      { session: session_id.slice(0, 8), agent: agent_id.slice(0, 8), agent_type },
      "HOOK subagent-stop"
    );
    if (deps.verbosity.allows("L4") && agent_type) {
      const chatId = operatorChatForSession(deps, session_id);
      deps.outbox.enqueueStatus({
        text: FormatService.subagentDone(agent_type),
        chatId,
        sessionId: session_id || null,
        eventType: "status_subagent",
      });
    }
    return reply.code(200).send({});
  });

  app.post("/hook/pre-tool-use", async (req, reply) => {
    const parsed = ToolUseSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(200).send({});
    const { tool_name, tool_input, session_id } = parsed.data;
    const chatId = operatorChatForSession(deps, session_id || null);
    try {
      if (tool_name === "Skill" && deps.verbosity.allows("L2")) {
        const text = FormatService.formatSkill(tool_input, "🔧");
        if (text) {
          deps.outbox.enqueueStatus({
            text,
            chatId,
            sessionId: session_id || null,
            eventType: "status_skill",
          });
        }
      } else if (tool_name === "TodoWrite" && deps.verbosity.allows("L3")) {
        const todos = tool_input.todos;
        if (Array.isArray(todos)) {
          const transitions = deps.todoDiff.diffAndPersist(session_id, todos);
          for (const t of transitions) {
            deps.outbox.enqueueStatus({
              text: `${t.emoji} ${t.display}`,
              chatId,
              sessionId: session_id || null,
              eventType: "status_todo",
            });
          }
        }
      } else if (tool_name === "Agent" && deps.verbosity.allows("L2")) {
        const text = FormatService.formatAgent(tool_input);
        if (text) {
          deps.outbox.enqueueStatus({
            text,
            chatId,
            sessionId: session_id || null,
            eventType: "status_skill",
          });
        }
      }
    } catch (error) {
      deps.log.error({ err: String(error) }, "hook pre-tool-use failed");
    }
    return reply.code(200).send({});
  });

  app.post("/hook/post-tool-use", async (req, reply) => {
    if (!deps.verbosity.allows("verbose_bash")) {
      return reply.code(200).send({});
    }
    const parsed = ToolUseSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(200).send({});
    const { tool_name, tool_input, session_id } = parsed.data;
    if (tool_name === "Skill") {
      const text = FormatService.formatSkill(tool_input, "✅");
      if (text) {
        const chatId = operatorChatForSession(deps, session_id || null);
        deps.outbox.enqueueStatus({
          text: `${text} done`,
          chatId,
          sessionId: session_id || null,
          eventType: "status_skill",
        });
      }
    }
    return reply.code(200).send({});
  });
}

function buildSessionStartContext(
  deps: HookDeps,
  args: { sessionId: string; source: string; previousSession: string | null }
): string {
  const lines: string[] = [
    `## Persistent context (claude-relay-bot, ${deps.dbPath})`,
    "",
    `_Session start: source=${args.source}, prev=${args.previousSession ?? "none"}_`,
    "",
  ];
  const mems = deps.memory.recent(TIMING.memoryInjectLimit, null);
  if (mems.length > 0) {
    deps.memory.markUsed(mems.map((m) => m.id));
    const byCat = new Map<string, string[]>();
    for (const m of mems) {
      const arr = byCat.get(m.category) ?? [];
      arr.push(m.text);
      byCat.set(m.category, arr);
    }
    lines.push("### Recent memories");
    for (const [cat, texts] of byCat) {
      lines.push(`**${cat}**:`);
      for (const t of texts) lines.push(`- ${t}`);
      lines.push("");
    }
  } else {
    lines.push("### Recent memories", "_no memories saved yet_", "");
  }

  const runs = deps.dispatch.recent(TIMING.dispatchRecentLimit);
  if (runs.length > 0) {
    lines.push("### Last dispatch runs");
    for (const r of runs) {
      const ts = formatDispatchTs(r.tsStarted);
      const issue = r.issueNumber === null ? "—" : `#${r.issueNumber}`;
      const pr = r.prNumber === null ? "" : `PR #${r.prNumber}`;
      lines.push(`- run ${r.id} (${ts}): issue ${issue}, status=${r.status} ${pr}`.trimEnd());
    }
    lines.push("");
  }

  const orphans = deps.pendingRepo.listOthers(args.sessionId);
  if (orphans.length > 0) {
    lines.push("### Orphaned pending replies (operator messaged before crash)");
    for (const o of orphans) {
      lines.push(`- session=${o.sessionId.slice(0, 8)} inbound_msg_id=${o.inboundMsgId}`);
    }
    lines.push("");
  }
  void nowTs;
  return lines.join("\n");
}
