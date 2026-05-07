import { Composer, type Context } from "grammy";
import type { Logger } from "../../lib/logger.js";
import type { GodRuntimeService } from "../../services/godRuntime.service.js";

export type RunClaudeUsageReport = () => Promise<string>;

export interface UsageDeps {
  log: Logger;
  godRuntime: GodRuntimeService;
  runClaudeUsageReport: RunClaudeUsageReport;
}

const CLAUDE_FAILED_FALLBACK =
  "📊 Claude usage\n⚠️ Не удалось получить отчёт claude-usage-report (см. логи relay).";
const CODEX_STATUS_FAILED_FALLBACK = "🟢 Codex: статус недоступен (systemd query failed).";

function codexStatusLine(isActive: boolean): string {
  if (isActive) {
    return "🟢 Codex: сессия активна. Детали: `@codex /status` в этом чате.";
  }
  return "⚪ Codex: сессия не запущена. Старт: `@codex привет` или `/set_buddy codex`.";
}

export function buildUsageHandler(deps: UsageDeps): Composer<Context> {
  const c = new Composer<Context>();
  c.command("usage", async (ctx) => {
    const userId = ctx.from?.id;
    if (userId === undefined) return;

    let claudeReport: string;
    try {
      claudeReport = await deps.runClaudeUsageReport();
      if (claudeReport.trim().length === 0) claudeReport = CLAUDE_FAILED_FALLBACK;
    } catch (error) {
      deps.log.warn({ err: String(error) }, "claude-usage-report failed");
      claudeReport = CLAUDE_FAILED_FALLBACK;
    }

    let codexReport: string;
    try {
      const isActive = await deps.godRuntime.isActive(userId, "codex");
      codexReport = codexStatusLine(isActive);
    } catch (error) {
      deps.log.warn({ err: String(error) }, "codex status probe failed");
      codexReport = CODEX_STATUS_FAILED_FALLBACK;
    }

    await ctx.reply(`${claudeReport}\n\n${codexReport}`);
  });
  return c;
}
