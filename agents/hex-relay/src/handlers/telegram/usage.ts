import { Composer, type Context } from "grammy";
import type { Logger } from "../../lib/logger.js";
import type { GodRuntimeService } from "../../services/godRuntime.service.js";
import type { UserBuddyService } from "../../services/userBuddy.service.js";
import type { MessagesRepository } from "../../services/ports.js";
import { type AgentKind, DEFAULT_AGENT } from "../../domain/message.js";
import { buildTgPrefix } from "../../domain/tgPrefix.js";
import { TELEGRAM_COMMANDS } from "../../domain/telegramCommands.js";
import { userTokenFromContext } from "./userToken.js";

export type RunClaudeUsageReport = () => Promise<string>;
export type RunCodexUsageReport = () => Promise<string>;

export interface UsageDeps {
  log: Logger;
  godRuntime: GodRuntimeService;
  messagesRepo: Pick<MessagesRepository, "insertInbound">;
  userBuddy: UserBuddyService;
  runClaudeUsageReport: RunClaudeUsageReport;
  runCodexUsageReport: RunCodexUsageReport;
}

const PROMPT_INSTRUCTION =
  "[system: usage report] Below is the current usage data. " +
  "Present it concisely (phone-friendly, no ASCII tables) " +
  "in the same language the user has been using in this chat. " +
  "Default to English if you cannot determine the language. " +
  "Keep numbers, percentages, and reset windows verbatim; only translate labels and prose.";

const CLAUDE_FAILED = "📊 Claude usage\n⚠️ live Claude usage query failed (see relay logs).";
const CODEX_FAILED =
  "\u{1F7E2} Codex usage\n⚠️ live Codex account/rateLimits/read failed (see relay logs).";
const CODEX_INACTIVE =
  "⚪ Codex god-session: not running. Start it with `@codex hi` or `/set_buddy codex` when you want to route work there.";
const SECONDS_PER_HOUR = 60 * 60;
const SECONDS_PER_DAY = 24 * SECONDS_PER_HOUR;

interface CodexRateLimitWindow {
  usedPercent?: unknown;
  windowDurationMins?: unknown;
  resetsAt?: unknown;
}

interface CodexRateLimitSnapshot {
  limitId?: unknown;
  limitName?: unknown;
  primary?: CodexRateLimitWindow | null;
  secondary?: CodexRateLimitWindow | null;
}

function formatReset(seconds: unknown): string {
  if (typeof seconds !== "number" || !Number.isFinite(seconds) || seconds <= 0) return "unknown";
  const deltaSeconds = Math.round(seconds - Date.now() / 1000);
  if (deltaSeconds <= 0) return "now";
  const days = Math.floor(deltaSeconds / SECONDS_PER_DAY);
  const hours = Math.floor((deltaSeconds % SECONDS_PER_DAY) / SECONDS_PER_HOUR);
  const minutes = Math.floor((deltaSeconds % SECONDS_PER_HOUR) / 60);
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

function formatWindowLabel(window: CodexRateLimitWindow, fallback: "session" | "week"): string {
  if (fallback === "session") return "Current session";
  const minutes = window.windowDurationMins;
  if (typeof minutes !== "number" || !Number.isFinite(minutes) || minutes <= 0) {
    return "Current week";
  }
  if (minutes >= 7 * 24 * 60) return "Current week";
  if (minutes >= 24 * 60) return `${Math.round(minutes / (24 * 60))}d window`;
  if (minutes >= 60) return `${Math.round(minutes / 60)}h window`;
  return `${Math.round(minutes)}m window`;
}

function formatUsedPercent(value: unknown): string | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return `${Math.round(Math.max(0, Math.min(100, value)))}%`;
}

function formatCodexWindow(
  window: CodexRateLimitWindow | null | undefined,
  fallback: "session" | "week"
): string | null {
  if (!window) return null;
  const used = formatUsedPercent(window.usedPercent);
  if (!used) return null;
  const label = formatWindowLabel(window, fallback);
  return `${label}: ${used} used — resets in ${formatReset(window.resetsAt)}`;
}

function formatCodexUsage(raw: string): string | null {
  let parsed: { rateLimits?: CodexRateLimitSnapshot };
  try {
    parsed = JSON.parse(raw) as { rateLimits?: CodexRateLimitSnapshot };
  } catch {
    return null;
  }
  const snapshot = parsed?.rateLimits;
  if (!snapshot) return null;
  const lines = [
    "\u{1F7E2} Codex usage",
    "",
    formatCodexWindow(snapshot.primary, "session"),
    formatCodexWindow(snapshot.secondary, "week"),
  ].filter((line): line is string => line !== null);
  return lines.length > 2 ? lines.join("\n") : null;
}

async function runCodexJsonReport(deps: UsageDeps): Promise<string> {
  try {
    const out = await deps.runCodexUsageReport();
    const trimmed = out.trim();
    if (trimmed.length === 0) return CODEX_FAILED;
    return formatCodexUsage(trimmed) ?? CODEX_FAILED;
  } catch (error) {
    deps.log.warn({ err: String(error) }, "codex usage query failed");
    return CODEX_FAILED;
  }
}

async function gatherClaudeBlock(deps: UsageDeps): Promise<string> {
  try {
    const out = await deps.runClaudeUsageReport();
    const trimmed = out.trim();
    return trimmed.length > 0 ? trimmed : CLAUDE_FAILED;
  } catch (error) {
    deps.log.warn({ err: String(error) }, "claude usage query failed");
    return CLAUDE_FAILED;
  }
}

async function gatherCodexBlock(deps: UsageDeps, userId: number): Promise<string> {
  const usage = await runCodexJsonReport(deps);
  let runtimeNote = "";
  try {
    const isActive = await deps.godRuntime.isActive(userId, "codex");
    if (!isActive.ok) {
      deps.log.warn({ error: isActive.error }, "codex status probe failed");
      runtimeNote = "\u{1F7E2} Codex god-session: status unavailable (systemd query failed).";
    } else if (!isActive.value) {
      runtimeNote = CODEX_INACTIVE;
    }
  } catch (error) {
    deps.log.warn({ err: String(error) }, "codex status probe failed");
    runtimeNote = "\u{1F7E2} Codex god-session: status unavailable (systemd query failed).";
  }
  return runtimeNote.length > 0 ? `${usage}\n\n${runtimeNote}` : usage;
}

export function buildUsageHandler(deps: UsageDeps): Composer<Context> {
  const c = new Composer<Context>();
  c.command(TELEGRAM_COMMANDS.usage.command, async (ctx) => {
    const userId = ctx.from?.id;
    if (userId === undefined || ctx.message === undefined) return;

    const claudeBlock = await gatherClaudeBlock(deps);
    const codexBlock = await gatherCodexBlock(deps, userId);
    const dataPayload =
      `--- Claude usage ---\n${claudeBlock}\n\n` + `--- Codex usage ---\n${codexBlock}`;

    const targetAgent: AgentKind = deps.userBuddy.getDefault(userId) ?? DEFAULT_AGENT;
    let targetActiveOutcome;
    try {
      targetActiveOutcome = await deps.godRuntime.isActive(userId, targetAgent);
    } catch (error) {
      deps.log.warn({ err: String(error) }, "target agent isActive probe failed");
      targetActiveOutcome = { ok: true, value: false } as const;
    }
    if (!targetActiveOutcome.ok) {
      deps.log.warn({ error: targetActiveOutcome.error }, "target agent isActive probe failed");
    }
    const targetActive = targetActiveOutcome.ok ? targetActiveOutcome.value : false;

    if (targetActive) {
      const prefix = buildTgPrefix({
        chatId: ctx.chat.id,
        msgId: ctx.message.message_id,
        userToken: userTokenFromContext(ctx),
      });
      const paneText = `${prefix} ${PROMPT_INSTRUCTION}\n\n${dataPayload}`;
      deps.messagesRepo.insertInbound(
        paneText,
        ctx.chat.id,
        ctx.message.message_id,
        userId,
        targetAgent
      );
      deps.log.info(
        { userId, targetAgent },
        "/usage routed to agent for language-aware formatting"
      );
      return;
    }

    deps.log.info(
      { userId, targetAgent },
      "/usage target agent inactive, replying directly in English"
    );
    await ctx.reply(`${claudeBlock}\n\n${codexBlock}`);
  });
  return c;
}
