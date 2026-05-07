import telegramifyMarkdown from "telegramify-markdown";

/**
 * Convert plain Markdown to Telegram MarkdownV2. Returns null if the converter
 * throws (callers fall back to raw text + no parse_mode).
 */
export function toTelegramMarkdownV2(text: string): string | null {
  try {
    return telegramifyMarkdown(text, "escape");
  } catch {
    return null;
  }
}
