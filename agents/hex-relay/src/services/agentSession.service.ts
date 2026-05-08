import { setTimeout as delay } from "node:timers/promises";
import { TIMING } from "../config/paths.js";
import type { AgentKind, InboundMessage } from "../domain/message.js";
import type { Logger } from "../lib/logger.js";
import type { ControlLane } from "./controlLane.service.js";
import type { GodRuntimeHandle, GodRuntimeService } from "./godRuntime.service.js";
import type { MessagesRepository } from "./ports.js";
import {
  fail,
  ok,
  okVoid,
  serviceError,
  type ServiceError,
  type ServiceOutcome,
} from "./outcome.js";

export type AgentSessionService = ReturnType<typeof createAgentSessionService>;
export type AgentSessionError = ServiceError;

export interface AgentSubmitCommand {
  row: InboundMessage;
  userId: number;
}

const CODEX_HOOK_REVIEW_RE = /hooks?\s+need\s+review|open\s+\/hooks\s+to\s+review/i;
const CODEX_BUSY_RE =
  /starting mcp servers|working|thinking|running|executing|waiting for approval/i;
const CODEX_READY_RE = /(^|\n)\s*(›|>)\s*$/;
const ANSI_ESCAPE_RE = new RegExp(
  `${String.fromCodePoint(27)}${String.raw`\[[0-9;?]*[A-Za-z]`}`,
  "g"
);

async function waitForPromptSubmitAck(
  messagesRepo: MessagesRepository,
  rowId: number
): Promise<InboundMessage | null> {
  const deadline = Date.now() + TIMING.inboundSubmitAckTimeoutMs;
  while (Date.now() < deadline) {
    const current = messagesRepo.findById(rowId);
    if (current?.sessionId) return current;
    await delay(TIMING.inboundSubmitAckPollMs);
  }
  return messagesRepo.findById(rowId);
}

function normalizePaneText(text: string): string {
  return text.replaceAll(ANSI_ESCAPE_RE, "");
}

export function createAgentSessionService(deps: {
  log: Logger;
  messagesRepo: MessagesRepository;
  controlLane: ControlLane;
  godRuntime: GodRuntimeService;
}) {
  async function ensureRuntime(
    userId: number,
    agent: AgentKind
  ): Promise<ServiceOutcome<GodRuntimeHandle, AgentSessionError>> {
    const started = await deps.godRuntime.ensureStarted(userId, agent);
    if (!started.ok) return fail(started.error);
    const runtime = deps.godRuntime.runtimeFor(userId, agent);
    if (!runtime.ok) return fail(runtime.error);
    return ok(runtime.value);
  }

  async function waitForCodexReady(
    runtime: GodRuntimeHandle,
    userId: number
  ): Promise<ServiceOutcome<void, AgentSessionError>> {
    if (!runtime.pane.captureText) return okVoid();
    const deadline = Date.now() + TIMING.agentReadyTimeoutMs;
    let lastPaneText = "";
    while (Date.now() < deadline) {
      if (!(await runtime.pane.hasSession())) {
        return fail(
          serviceError({
            code: "codex_session_missing",
            kind: "transient",
            message: "Codex god-session disappeared before it became ready",
            details: { userId, agent: "codex" },
          })
        );
      }

      const paneText = normalizePaneText(await runtime.pane.captureText(120));
      lastPaneText = paneText.trim();
      if (CODEX_HOOK_REVIEW_RE.test(paneText)) {
        return fail(
          serviceError({
            code: "codex_hooks_untrusted",
            kind: "permanent",
            message:
              "Codex hooks are configured but not trusted; run managed hook sync or approve /hooks before delivery",
            details: { userId, agent: "codex" },
          })
        );
      }
      if (CODEX_READY_RE.test(paneText) && !CODEX_BUSY_RE.test(paneText)) return okVoid();
      await delay(TIMING.agentReadyPollMs);
    }

    return fail(
      serviceError({
        code: "codex_not_ready",
        kind: "transient",
        message: `Codex god-session did not become ready within ${TIMING.agentReadyTimeoutMs}ms`,
        details: { userId, agent: "codex", paneTail: lastPaneText.slice(-500) },
      })
    );
  }

  async function waitUntilReady(
    agent: AgentKind,
    runtime: GodRuntimeHandle,
    userId: number
  ): Promise<ServiceOutcome<void, AgentSessionError>> {
    if (agent === "codex") return waitForCodexReady(runtime, userId);
    return okVoid();
  }

  async function submitPrompt(
    command: AgentSubmitCommand
  ): Promise<ServiceOutcome<InboundMessage, AgentSessionError>> {
    try {
      const deliveredToPane = await deps.controlLane.run("deliver_inbound", async () => {
        deps.messagesRepo.update(command.row.id, { status: "delivering" });
        const ensured = await ensureRuntime(command.userId, command.row.agent);
        if (!ensured.ok) return fail(ensured.error);
        const ready = await waitUntilReady(command.row.agent, ensured.value, command.userId);
        if (!ready.ok) return fail(ready.error);
        await ensured.value.pane.send(command.row.text);
        return okVoid();
      });
      if (!deliveredToPane.ok) return deliveredToPane;

      const acknowledged = await waitForPromptSubmitAck(deps.messagesRepo, command.row.id);
      if (!acknowledged?.sessionId) {
        return fail(
          serviceError({
            code: "agent_prompt_ack_timeout",
            kind: "transient",
            message: `prompt submit hook was not observed within ${TIMING.inboundSubmitAckTimeoutMs}ms`,
            details: { id: command.row.id, agent: command.row.agent },
          })
        );
      }
      return ok(acknowledged);
    } catch (error) {
      deps.log.warn(
        { err: String(error), id: command.row.id, agent: command.row.agent },
        "agent prompt delivery failed"
      );
      return fail(
        serviceError({
          code: "agent_prompt_delivery_failed",
          kind: "transient",
          message: error instanceof Error ? error.message : String(error),
          details: { id: command.row.id, agent: command.row.agent },
          cause: error,
        })
      );
    }
  }

  return { submitPrompt };
}
