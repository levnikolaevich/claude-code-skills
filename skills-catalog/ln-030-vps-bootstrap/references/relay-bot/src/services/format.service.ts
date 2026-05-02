import { TIMING } from "../config/paths.js";
import {
  mdSafe,
  truncate,
  formatSkillEvent,
  formatAgentEvent,
  prefixReply,
} from "../domain/events.js";
import { utf16Len, splitForTelegram } from "../lib/telegramSplit.js";

export const FormatService = {
  splitForTelegram(text: string): string[] {
    return splitForTelegram(text, TIMING.tgMaxLen);
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
  prefixReply(text: string): string {
    return prefixReply(text);
  },
  subagentDone(agentType: string): string {
    return `✅ Subagent: ${mdSafe(truncate(agentType, 40))} done`;
  },
};
