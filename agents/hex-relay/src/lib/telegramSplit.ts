/**
 * Telegram counts message length in UTF-16 code units. Astral-plane characters
 * (emoji like 🤖) count as 2. We split on newlines when possible.
 */

export function utf16Len(s: string): number {
  let n = 0;
  for (const ch of s) {
    n += (ch.codePointAt(0) ?? 0) > 0xff_ff ? 2 : 1;
  }
  return n;
}

export function splitForTelegram(text: string, limit: number): string[] {
  if (utf16Len(text) <= limit) return [text];
  const chunks: string[] = [];
  let rest = text;
  while (rest.length > 0) {
    let end = rest.length;
    while (utf16Len(rest.slice(0, end)) > limit) {
      const splitAt = rest.slice(0, end).lastIndexOf("\n");
      end = splitAt > 0 ? splitAt : end - 1;
      if (end <= 0) {
        end = 1;
        break;
      }
    }
    const chunk = rest.slice(0, end).replace(/\s+$/u, "");
    if (chunk.length > 0) chunks.push(chunk);
    rest = rest.slice(end).replace(/^\s+/u, "");
  }
  return chunks;
}
