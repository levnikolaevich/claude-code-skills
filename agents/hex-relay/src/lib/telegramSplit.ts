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

/**
 * Code-fence-aware splitter for Telegram MarkdownV2 payloads.
 *
 * Tracks fenced code-block state so a cut never lands inside a fenced block
 * without closing it. When a chunk would exceed the limit while a fence is
 * open we close it (` ``` `), start the next chunk with the same opening fence
 * (preserving the language tag), and continue.
 *
 * Boundary preference outside fences: paragraph break (\n\n) > line break >
 * word boundary > hard cut. Inside a fence we only cut on a line break (never
 * mid-line in code).
 */
export function splitForTelegramMarkdown(text: string, limit: number): string[] {
  if (utf16Len(text) <= limit) {
    const trimmed = text.replace(/\s+$/u, "");
    return trimmed.length > 0 ? [trimmed] : [""];
  }

  const lines = text.split("\n");
  const chunks: string[] = [];
  const state = {
    current: "",
    fenceOpen: false,
    fenceLang: "",
    pendingFenceOpen: false,
    pendingFenceLang: "",
  };

  const fenceRe = /^(\s*)```(.*)$/u;
  const reservedForClose = "\n```".length;

  function flush(): void {
    const trimmed = state.current.replace(/\s+$/u, "");
    if (trimmed.length > 0) chunks.push(trimmed);
    state.current = "";
    if (state.pendingFenceOpen) {
      const opener = state.pendingFenceLang ? "```" + state.pendingFenceLang : "```";
      state.current = opener + "\n";
      state.fenceOpen = true;
      state.fenceLang = state.pendingFenceLang;
      state.pendingFenceOpen = false;
      state.pendingFenceLang = "";
    } else {
      state.fenceOpen = false;
      state.fenceLang = "";
    }
  }

  function forceSplitLongLine(line: string): void {
    if (state.fenceOpen) {
      // Inside a fence we cannot cut mid-line; emit as-is rather than corrupt code.
      state.current = state.current.length === 0 ? line : state.current + "\n" + line;
      return;
    }
    let rest = line;
    while (utf16Len(rest) > limit) {
      let end = rest.length;
      while (utf16Len(rest.slice(0, end)) > limit) {
        const wordCut = rest.slice(0, end).search(/\s\S*$/u);
        end = wordCut > 0 ? wordCut : end - 1;
        if (end <= 0) {
          end = 1;
          break;
        }
      }
      const piece = rest.slice(0, end).replace(/\s+$/u, "");
      if (piece.length > 0) chunks.push(piece);
      rest = rest.slice(end).replace(/^\s+/u, "");
    }
    state.current = rest;
  }

  function applyFenceToggle(openedLang: string): void {
    if (state.fenceOpen) {
      state.fenceOpen = false;
      state.fenceLang = "";
    } else {
      state.fenceOpen = true;
      state.fenceLang = openedLang;
    }
  }

  function appendLine(line: string, isFenceToggle: boolean, openedLang: string): void {
    const candidate = state.current.length === 0 ? line : state.current + "\n" + line;
    const cap = state.fenceOpen && !isFenceToggle ? limit - reservedForClose : limit;
    if (utf16Len(candidate) <= cap) {
      state.current = candidate;
      if (isFenceToggle) applyFenceToggle(openedLang);
      return;
    }
    if (state.current.length === 0) {
      forceSplitLongLine(line);
      if (isFenceToggle) applyFenceToggle(openedLang);
      return;
    }
    if (state.fenceOpen) {
      state.current += "\n```";
      state.pendingFenceOpen = true;
      state.pendingFenceLang = state.fenceLang;
    }
    flush();
    appendLine(line, isFenceToggle, openedLang);
  }

  for (const line of lines) {
    const fenceMatch = fenceRe.exec(line);
    if (fenceMatch) {
      const lang = state.fenceOpen ? "" : (fenceMatch[2] ?? "").trim();
      appendLine(line, true, lang);
    } else {
      appendLine(line, false, "");
    }
  }

  if (state.current.length > 0) flush();
  if (chunks.length === 0) chunks.push("");
  return chunks;
}
