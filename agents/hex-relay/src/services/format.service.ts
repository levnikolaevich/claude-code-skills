import { TIMING } from "../config/paths.js";
import type { AgentKind } from "../domain/message.js";
import {
  mdSafe,
  truncate,
  formatSkillEvent,
  formatAgentEvent,
  prefixReply,
} from "../domain/events.js";
import { utf16Len, splitForTelegram, splitForTelegramMarkdown } from "../lib/telegramSplit.js";
import { toTelegramMarkdownV2 } from "../lib/telegramMarkdown.js";

export const FormatService = {
  splitForTelegram(text: string): string[] {
    return splitForTelegram(text, TIMING.tgMaxLen);
  },
  splitForTelegramMarkdown(text: string): string[] {
    return splitForTelegramMarkdown(text, TIMING.tgMaxLen);
  },
  toTelegramMarkdownV2(text: string): string | null {
    return toTelegramMarkdownV2(text);
  },
  utf16Len,
  mdSafe,
  truncate,
  formatSkill(input: unknown, prefix = "🔧"): string | null {
    return formatSkillEvent(input, TIMING.skillNameMaxLen, prefix);
  },
  formatAgent(input: unknown): string | null {
    return formatAgentEvent(input);
  },
  prefixReply(text: string, agent: AgentKind = "claude"): string {
    return prefixReply(text, agent);
  },
  subagentDone(agentType: string): string {
    return `✅ Subagent: ${mdSafe(truncate(agentType, 40))} done`;
  },
};
