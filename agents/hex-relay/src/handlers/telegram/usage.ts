import { Composer, type Context } from "grammy";
import type { Logger } from "../../lib/logger.js";
import type { GodRuntimeService } from "../../services/godRuntime.service.js";
import type { UserBuddyService } from "../../services/userBuddy.service.js";
import type { MessagesRepository } from "../../services/ports.js";
import { type AgentKind, DEFAULT_AGENT } from "../../domain/message.js";
import { buildTgPrefix } from "../../domain/tgPrefix.js";
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

const CLAUDE_FAILED = "📊 Claude usage\n⚠️ claude-usage-report failed (see relay logs).";
const CODEX_FAILED =
  "\u{1F7E2} Codex usage\n⚠️ codex app-server account/rateLimits/read failed (see relay logs).";
const CODEX_INACTIVE =
  "⚪ Codex god-session: not running. Start: `@codex hi` or `/set_buddy codex`.";

async function runCodexJsonReport(deps: UsageDeps): Promise<string> {
  try {
    const out = await deps.runCodexUsageReport();
    const trimmed = out.trim();
    return trimmed.length > 0 ? trimmed : CODEX_FAILED;
  } catch (error) {
    deps.log.warn({ err: String(error) }, "codex-usage-report failed");
    return CODEX_FAILED;
  }
}

async function gatherClaudeBlock(deps: UsageDeps): Promise<string> {
  try {
    const out = await deps.runClaudeUsageReport();
    const trimmed = out.trim();
    return trimmed.length > 0 ? trimmed : CLAUDE_FAILED;
  } catch (error) {
    deps.log.warn({ err: String(error) }, "claude-usage-report failed");
    return CLAUDE_FAILED;
  }
}

async function gatherCodexBlock(deps: UsageDeps, userId: number): Promise<string> {
  let isActive;
  try {
    isActive = await deps.godRuntime.isActive(userId, "codex");
  } catch (error) {
    deps.log.warn({ err: String(error) }, "codex status probe failed");
    return "\u{1F7E2} Codex god-session: status unavailable (systemd query failed).";
  }
  if (!isActive.ok) {
    deps.log.warn({ error: isActive.error }, "codex status probe failed");
    return "\u{1F7E2} Codex god-session: status unavailable (systemd query failed).";
  }
  if (!isActive.value) return CODEX_INACTIVE;
  return runCodexJsonReport(deps);
}

export function buildUsageHandler(deps: UsageDeps): Composer<Context> {
  const c = new Composer<Context>();
  c.command("usage", async (ctx) => {
    const userId = ctx.from?.id;
    if (userId === undefined || ctx.message === undefined) return;

    const claudeBlock = await gatherClaudeBlock(deps);
    const codexBlock = await gatherCodexBlock(deps, userId);
    const dataPayload =
      `--- Claude usage ---\n${claudeBlock}\n\n` + `--- Codex status ---\n${codexBlock}`;

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
      "/usage target agent inactive, falling back to direct English reply"
    );
    await ctx.reply(`${claudeBlock}\n\n${codexBlock}`);
  });
  return c;
}
