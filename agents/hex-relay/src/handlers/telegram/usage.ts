import { Composer, type Context } from "grammy";
import type { Logger } from "../../lib/logger.js";
import type { GodRuntimeService } from "../../services/godRuntime.service.js";
import type { MessagesRepo } from "../../infrastructure/db/repositories/messages.repo.js";
import type { UserBuddyService } from "../../services/userBuddy.service.js";
import { type AgentKind, DEFAULT_AGENT } from "../../domain/message.js";

export type RunClaudeUsageReport = () => Promise<string>;

export interface UsageDeps {
  log: Logger;
  godRuntime: GodRuntimeService;
  messagesRepo: MessagesRepo;
  userBuddy: UserBuddyService;
  runClaudeUsageReport: RunClaudeUsageReport;
}

const PROMPT_INSTRUCTION =
  "[system: usage report] Below is the current usage data. " +
  "Present it concisely (phone-friendly, no ASCII tables) " +
  "in the same language the user has been using in this chat. " +
  "Default to English if you cannot determine the language. " +
  "Keep numbers, percentages, and reset windows verbatim; only translate labels and prose.";

const CLAUDE_FAILED = "📊 Claude usage\n⚠️ claude-usage-report failed (see relay logs).";
const CODEX_STATUS_FAILED = "🟢 Codex god-session: status unavailable (systemd query failed).";

function codexStatusLine(isActive: boolean): string {
  if (isActive) {
    return "🟢 Codex god-session: active. Detailed limits via `@codex /status` in this chat.";
  }
  return "⚪ Codex god-session: not running. Start: `@codex hi` or `/set_buddy codex`.";
}

function userTag(ctx: Context): string {
  const u = ctx.from;
  if (!u) return "";
  if (u.username) return ` user=${u.username}`;
  return ` user=${u.id}`;
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
  try {
    const isActive = await deps.godRuntime.isActive(userId, "codex");
    return codexStatusLine(isActive);
  } catch (error) {
    deps.log.warn({ err: String(error) }, "codex status probe failed");
    return CODEX_STATUS_FAILED;
  }
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
    const targetActive = await deps.godRuntime
      .isActive(userId, targetAgent)
      .catch((error: unknown) => {
        deps.log.warn({ err: String(error) }, "target agent isActive probe failed");
        return false;
      });

    if (targetActive) {
      const tag = userTag(ctx);
      const paneText =
        `[tg id=${ctx.chat.id}:${ctx.message.message_id}${tag}] ` +
        `${PROMPT_INSTRUCTION}\n\n${dataPayload}`;
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
