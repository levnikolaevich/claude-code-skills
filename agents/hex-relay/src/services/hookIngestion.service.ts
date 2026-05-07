import type { Logger } from "../lib/logger.js";
import { TIMING, TG_PREFIX_RE } from "../config/paths.js";
import type { AgentKind, InboundMessage } from "../domain/message.js";
import { formatDurationSuffix } from "../domain/durationFormat.js";
import { FormatService } from "./format.service.js";
import type { DispatchService } from "./dispatch.service.js";
import type { MemoryService } from "./memory.service.js";
import type { OutboxService } from "./outbox.service.js";
import type { HookMessagesRepository, HookPendingReplyRepository } from "./ports.js";
import type { SessionService } from "./session.service.js";
import type { TodoDiffService } from "./todoDiff.service.js";
import type { TypingService } from "./typing.service.js";
import type { VerbosityService } from "./verbosity.service.js";
import {
  fail,
  ok,
  okVoid,
  serviceError,
  type ServiceError,
  type ServiceOutcome,
} from "./outcome.js";

const STOP_FAILURE_DEDUP_MS = 10_000;
const STOP_FAILURE_ALERT_DEDUP_MS = 5 * 60_000;

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

let pendingFanoutAcksTotal = 0;

export function getPendingFanoutAcksTotal(): number {
  return pendingFanoutAcksTotal;
}

export interface HookIngestionDeps {
  log: Logger;
  messagesRepo: HookMessagesRepository;
  pendingRepo: HookPendingReplyRepository;
  outbox: OutboxService;
  sessionService: SessionService;
  todoDiff: TodoDiffService;
  memory: MemoryService;
  dispatch: DispatchService;
  verbosity: VerbosityService;
  typing: TypingService;
  primaryOperator: number;
  dbPath: string;
}

export interface UserPromptSubmitHook {
  sessionId: string;
  prompt: string;
  agent: AgentKind;
}

export interface StopHook {
  sessionId: string;
  lastAssistantMessage: string;
}

export interface StopFailureHook {
  sessionId: string;
  errorType: string;
  agent: AgentKind;
  payload: Record<string, unknown>;
}

export interface SessionStartHook {
  sessionId: string;
  source: string;
  model: string | null;
  cwd: string | null;
  transcriptPath: string | null;
  agent: AgentKind;
}

export interface SubagentStopHook {
  sessionId: string;
  agentId: string;
  agentType: string;
}

export interface ToolUseHook {
  sessionId: string;
  toolName: string;
  toolInput: Record<string, unknown>;
  durationMs?: number;
}

export type HookIngestionService = ReturnType<typeof createHookIngestionService>;
export type HookIngestionError = ServiceError;
export interface SessionStartResult {
  additionalContext: string;
}

function formatDispatchTs(epoch: number): string {
  const d = new Date(epoch * 1000);
  const month = MONTH_ABBR[d.getMonth()] ?? "???";
  const day = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${month} ${day} ${hh}:${mm}`;
}

function classifyStopFailure(errorType: string, payload: Record<string, unknown>): string {
  const raw = JSON.stringify(payload).toLowerCase();
  if (
    errorType === "auth_failed" ||
    raw.includes("authentication_error") ||
    raw.includes("invalid authentication credentials") ||
    raw.includes("please run /login") ||
    raw.includes("api error: 401")
  ) {
    return "auth_failed";
  }
  if (raw.includes("rate_limit") || raw.includes("rate limit") || raw.includes("api error: 429")) {
    return "rate_limited";
  }
  if (
    raw.includes("econnreset") ||
    raw.includes("etimedout") ||
    raw.includes("enetunreach") ||
    raw.includes("socket hang up")
  ) {
    return "network_error";
  }
  if (raw.includes("api error: 5") || raw.includes("upstream") || raw.includes("bad gateway")) {
    return "upstream_error";
  }
  if (
    raw.includes("context window") ||
    raw.includes("too many tokens") ||
    raw.includes("context_length_exceeded")
  ) {
    return "context_overflow";
  }
  if (raw.includes("json") && (raw.includes("parse") || raw.includes("unexpected token"))) {
    return "parse_error";
  }
  if (errorType && errorType !== "unknown") return errorType;
  return "stop_failure";
}

function formatStopFailureAlert(args: {
  kind: string;
  sessionId: string;
  errorType: string;
  payload: Record<string, unknown>;
}): string {
  const details = JSON.stringify(args.payload).slice(0, 600);
  const lines = [
    `[admin] god-session error: ${args.kind}`,
    args.sessionId ? `session: ${args.sessionId}` : "",
    `error_type: ${args.errorType || "unknown"}`,
    `details: ${details}`,
  ].filter(Boolean);
  if (args.kind === "auth_failed") {
    lines.push(
      "action: verify sandbox mounts ~/.claude and ~/.codex as writable directories, then run Claude login for the VPS-wide agent account if needed and restart affected god sessions."
    );
  }
  return lines.join("\n");
}

export function createHookIngestionService(deps: HookIngestionDeps) {
  const stopFailureDedup = new Map<string, number>();
  const stopFailureAlertDedup = new Map<string, number>();

  function operatorChatForSession(sessionId: string | null): number {
    if (!sessionId) return deps.primaryOperator;
    const pending = deps.pendingRepo.get(sessionId);
    if (!pending) return deps.primaryOperator;
    const chatId = deps.messagesRepo.getChatId(pending.inboundMsgId);
    return chatId ?? deps.primaryOperator;
  }

  function bindPendingInbound(args: {
    sessionId: string;
    inbound: InboundMessage;
    prompt: string;
    chatId: number | null;
    tgMsgId: number | null;
    agent: AgentKind;
  }): ServiceOutcome<void, HookIngestionError> {
    const { sessionId, inbound, prompt, chatId, tgMsgId, agent } = args;
    try {
      deps.messagesRepo.update(inbound.id, { sessionId });
      if (inbound.fromUserId !== null) {
        deps.sessionService.ensureOwner(sessionId, inbound.fromUserId, agent);
      }
      deps.pendingRepo.set(sessionId, inbound.id, prompt, agent);
      if (chatId !== null) {
        deps.typing.start(sessionId, chatId);
      }
      deps.log.info(
        {
          session: sessionId.slice(0, 8),
          inboundId: inbound.id,
          chatId,
          tgMsgId,
        },
        "HOOK user-prompt-submit pending set"
      );
      return okVoid();
    } catch (error) {
      return fail(
        serviceError({
          code: "hook_pending_bind_failed",
          kind: "transient",
          message: "failed to bind hook prompt to pending inbound message",
          details: { sessionId, inboundId: inbound.id, chatId, tgMsgId, agent },
          cause: error,
        })
      );
    }
  }

  function buildSessionStartContext(args: {
    sessionId: string;
    source: string;
    previousSession: string | null;
  }): string {
    const lines: string[] = [
      `## Persistent context (hex-relay, ${deps.dbPath})`,
      "",
      `_Session start: source=${args.source}, prev=${args.previousSession ?? "none"}_`,
      "",
      "### Telegram message formatting",
      "",
      "Replies you produce will be rendered as Telegram MarkdownV2 by hex-relay. Use only:",
      "- `**bold**`, `_italic_`, `` `inline code` ``, fenced code blocks with language (` ```python ... ``` `)",
      "- `[text](url)` links",
      "- `>` blockquotes (single `>` per line)",
      "- `-` bullet lists (rendered as `•` by the converter)",
      "",
      "Avoid: headings (`#`), tables, horizontal rules (`---`), images. The converter degrades them but the visual result is poor.",
      "Keep individual messages compact; the relay splits long replies automatically.",
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
    return lines.join("\n");
  }

  return {
    allowsVerboseBash(): boolean {
      return deps.verbosity.allows("verbose_bash");
    },

    userPromptSubmit(args: UserPromptSubmitHook): ServiceOutcome<void, HookIngestionError> {
      try {
        deps.sessionService.insertEvent(args.sessionId, "user_prompt_submit", {
          prompt_len: args.prompt.length,
          starts_with_tg: args.prompt.startsWith("[tg id="),
        });
        const m = TG_PREFIX_RE.exec(args.prompt);
        if (!m) return okVoid();
        const chatId = Number.parseInt(m[1] ?? "0", 10);
        const tgMsgId = Number.parseInt(m[2] ?? "0", 10);
        const inbound = deps.messagesRepo.findByTg(chatId, tgMsgId);
        if (!inbound) return okVoid();
        return bindPendingInbound({
          sessionId: args.sessionId,
          inbound,
          prompt: args.prompt,
          chatId,
          tgMsgId,
          agent: args.agent,
        });
      } catch (error) {
        return fail(
          serviceError({
            code: "hook_user_prompt_submit_failed",
            kind: "transient",
            message: "failed to ingest user-prompt-submit hook",
            details: { sessionId: args.sessionId, agent: args.agent },
            cause: error,
          })
        );
      }
    },

    stop(args: StopHook): ServiceOutcome<void, HookIngestionError> {
      try {
        const lastMsg = args.lastAssistantMessage.trim();
        deps.sessionService.insertEvent(args.sessionId, "stop", { msg_len: lastMsg.length });
        if (!lastMsg) return okVoid();
        const pendings = deps.pendingRepo.getAllForSession(args.sessionId);
        if (pendings.length === 0) {
          deps.log.info({ session: args.sessionId.slice(0, 8) }, "HOOK stop no pending");
          return okVoid();
        }
        const latest = pendings.at(-1)!;
        const orphans = pendings.slice(0, -1);
        const inbound = deps.messagesRepo.findById(latest.inboundMsgId);
        const replyChatId =
          inbound?.tgChatId ??
          deps.messagesRepo.getChatId(latest.inboundMsgId) ??
          deps.primaryOperator;
        const replyToTgMsgId = inbound?.tgMsgId ?? null;
        const replyAgent = latest.agent;
        const finalText = FormatService.prefixReply(lastMsg, replyAgent);
        const auditMsgId = deps.messagesRepo.insertOutboundAudit(
          lastMsg,
          args.sessionId,
          latest.inboundMsgId,
          replyAgent
        );
        const outboxId = deps.outbox.enqueueReply({
          text: finalText,
          chatId: replyChatId,
          repliedToId: replyToTgMsgId,
          sessionId: args.sessionId,
          auditMsgId,
          agent: replyAgent,
        });
        if (!outboxId.ok) return fail(outboxId.error);
        let fanoutAcks = 0;
        for (const orphan of orphans) {
          const orphanInbound = deps.messagesRepo.findById(orphan.inboundMsgId);
          const ackChatId =
            orphanInbound?.tgChatId ??
            deps.messagesRepo.getChatId(orphan.inboundMsgId) ??
            replyChatId;
          const ackRepliedTo = orphanInbound?.tgMsgId ?? null;
          const ack = deps.outbox.enqueueAck({
            text: "↳ merged into the combined reply",
            chatId: ackChatId,
            repliedToId: ackRepliedTo,
            sessionId: args.sessionId,
            auditMsgId: null,
            agent: replyAgent,
          });
          if (!ack.ok) return fail(ack.error);
          fanoutAcks += 1;
        }
        pendingFanoutAcksTotal += fanoutAcks;
        deps.pendingRepo.clear(args.sessionId);
        deps.typing.stop(args.sessionId);
        deps.log.info(
          {
            session: args.sessionId.slice(0, 8),
            outboxId: outboxId.value,
            len: lastMsg.length,
            pendingCount: pendings.length,
            fanoutAcks,
          },
          "HOOK stop enqueued reply"
        );
        return okVoid();
      } catch (error) {
        return fail(
          serviceError({
            code: "hook_stop_failed",
            kind: "transient",
            message: "failed to ingest stop hook",
            details: { sessionId: args.sessionId },
            cause: error,
          })
        );
      }
    },

    stopFailure(args: StopFailureHook): ServiceOutcome<void, HookIngestionError> {
      try {
        const kind = classifyStopFailure(args.errorType, args.payload);
        deps.sessionService.insertEvent(args.sessionId, "stop_failure", {
          error_type: args.errorType,
        });
        if (args.sessionId) deps.typing.stop(args.sessionId);
        const now = Date.now();
        const last = stopFailureDedup.get(args.sessionId) ?? 0;
        if (now - last > STOP_FAILURE_DEDUP_MS) {
          const detail = JSON.stringify(args.payload).slice(0, 280);
          deps.log.warn(
            { session: args.sessionId.slice(0, 8), error_type: args.errorType, kind, detail },
            "HOOK stop-failure (non-terminal; pending preserved)"
          );
          stopFailureDedup.set(args.sessionId, now);
        }
        const alertKey = `${args.sessionId}:${kind}`;
        const lastAlert = stopFailureAlertDedup.get(alertKey) ?? 0;
        if (now - lastAlert > STOP_FAILURE_ALERT_DEDUP_MS) {
          const queued = deps.outbox.enqueueStatus({
            text: formatStopFailureAlert({
              kind,
              sessionId: args.sessionId,
              errorType: args.errorType,
              payload: args.payload,
            }),
            chatId: deps.primaryOperator,
            sessionId: args.sessionId || null,
            eventType: "system",
            agent: args.agent,
          });
          if (!queued.ok) return fail(queued.error);
          stopFailureAlertDedup.set(alertKey, now);
          deps.log.info(
            { session: args.sessionId.slice(0, 8), kind },
            "admin stop-failure alert queued"
          );
        }
        return okVoid();
      } catch (error) {
        return fail(
          serviceError({
            code: "hook_stop_failure_failed",
            kind: "transient",
            message: "failed to ingest stop-failure hook",
            details: { sessionId: args.sessionId, errorType: args.errorType, agent: args.agent },
            cause: error,
          })
        );
      }
    },

    sessionStart(args: SessionStartHook): ServiceOutcome<SessionStartResult, HookIngestionError> {
      try {
        const previousSession: string | null = null;
        const owner = deps.sessionService.recordStart({
          sessionId: args.sessionId,
          source: args.source,
          model: args.model,
          cwd: args.cwd,
          transcriptPath: args.transcriptPath,
          previousSession,
          primaryOperator: deps.primaryOperator,
          agent: args.agent,
        });
        deps.log.info(
          {
            session: args.sessionId.slice(0, 8),
            source: args.source,
            model: args.model,
            prev: (previousSession ?? "").slice(0, 8),
            owner,
          },
          "HOOK session-start"
        );
        return ok({
          additionalContext: buildSessionStartContext({
            sessionId: args.sessionId,
            source: args.source,
            previousSession,
          }),
        });
      } catch (error) {
        return fail(
          serviceError({
            code: "hook_session_start_failed",
            kind: "transient",
            message: "failed to ingest session-start hook",
            details: { sessionId: args.sessionId, agent: args.agent },
            cause: error,
          })
        );
      }
    },

    subagentStop(args: SubagentStopHook): ServiceOutcome<void, HookIngestionError> {
      try {
        deps.sessionService.insertEvent(args.sessionId, "subagent_stop", {
          agent_id: args.agentId,
          agent_type: args.agentType,
        });
        deps.log.info(
          {
            session: args.sessionId.slice(0, 8),
            agent: args.agentId.slice(0, 8),
            agent_type: args.agentType,
          },
          "HOOK subagent-stop"
        );
        if (deps.verbosity.allows("L4") && args.agentType) {
          const chatId = operatorChatForSession(args.sessionId);
          const queued = deps.outbox.enqueueStatus({
            text: FormatService.subagentDone(args.agentType),
            chatId,
            sessionId: args.sessionId || null,
            eventType: "status_subagent",
          });
          if (!queued.ok) return fail(queued.error);
        }
        return okVoid();
      } catch (error) {
        return fail(
          serviceError({
            code: "hook_subagent_stop_failed",
            kind: "transient",
            message: "failed to ingest subagent-stop hook",
            details: { sessionId: args.sessionId, agentId: args.agentId },
            cause: error,
          })
        );
      }
    },

    preToolUse(args: ToolUseHook): ServiceOutcome<void, HookIngestionError> {
      try {
        const chatId = operatorChatForSession(args.sessionId || null);
        if (args.toolName === "Skill" && deps.verbosity.allows("L2")) {
          const text = FormatService.formatSkill(args.toolInput, "🔧");
          if (text) {
            const queued = deps.outbox.enqueueStatus({
              text,
              chatId,
              sessionId: args.sessionId || null,
              eventType: "status_skill",
            });
            if (!queued.ok) return fail(queued.error);
          }
        } else if (args.toolName === "TodoWrite" && deps.verbosity.allows("L3")) {
          const todos = args.toolInput.todos;
          if (Array.isArray(todos)) {
            const transitions = deps.todoDiff.diffAndPersist(args.sessionId, todos);
            for (const t of transitions) {
              const queued = deps.outbox.enqueueStatus({
                text: `${t.emoji} ${t.display}`,
                chatId,
                sessionId: args.sessionId || null,
                eventType: "status_todo",
              });
              if (!queued.ok) return fail(queued.error);
            }
          }
        } else if (args.toolName === "Agent" && deps.verbosity.allows("L2")) {
          const text = FormatService.formatAgent(args.toolInput);
          if (text) {
            const queued = deps.outbox.enqueueStatus({
              text,
              chatId,
              sessionId: args.sessionId || null,
              eventType: "status_skill",
            });
            if (!queued.ok) return fail(queued.error);
          }
        }
        return okVoid();
      } catch (error) {
        return fail(
          serviceError({
            code: "hook_pre_tool_use_failed",
            kind: "transient",
            message: "failed to ingest pre-tool-use hook",
            details: { sessionId: args.sessionId, toolName: args.toolName },
            cause: error,
          })
        );
      }
    },

    postToolUse(args: ToolUseHook): ServiceOutcome<void, HookIngestionError> {
      try {
        if (!deps.verbosity.allows("verbose_bash")) return okVoid();
        if (args.toolName !== "Skill") return okVoid();
        const text = FormatService.formatSkill(args.toolInput, "✅");
        if (!text) return okVoid();
        const chatId = operatorChatForSession(args.sessionId || null);
        const suffix = formatDurationSuffix(args.durationMs);
        const queued = deps.outbox.enqueueStatus({
          text: `${text} done${suffix}`,
          chatId,
          sessionId: args.sessionId || null,
          eventType: "status_skill",
        });
        return queued.ok ? okVoid() : fail(queued.error);
      } catch (error) {
        return fail(
          serviceError({
            code: "hook_post_tool_use_failed",
            kind: "transient",
            message: "failed to ingest post-tool-use hook",
            details: { sessionId: args.sessionId, toolName: args.toolName },
            cause: error,
          })
        );
      }
    },
  };
}
