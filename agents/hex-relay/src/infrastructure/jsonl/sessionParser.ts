import { closeSync, openSync, readSync, statSync } from "node:fs";
import { TG_PREFIX_RE, CMD_MESSAGE_RE } from "../../config/paths.js";

const DEFAULT_MAX_LINES = 100;

function readFirstLines(path: string, maxLines: number): string[] {
  let fd: number;
  try {
    fd = openSync(path, "r");
  } catch {
    return [];
  }
  try {
    const buf = Buffer.alloc(64 * 1024);
    const lines: string[] = [];
    let pending = "";
    let pos = 0;
    while (lines.length < maxLines) {
      const n = readSync(fd, buf, 0, buf.length, pos);
      if (n <= 0) break;
      pos += n;
      pending += buf.subarray(0, n).toString("utf8");
      let nl: number;
      while ((nl = pending.indexOf("\n")) !== -1) {
        const line = pending.slice(0, nl);
        pending = pending.slice(nl + 1);
        lines.push(line);
        if (lines.length >= maxLines) break;
      }
    }
    if (pending && lines.length < maxLines) lines.push(pending);
    return lines;
  } finally {
    try {
      closeSync(fd);
    } catch {
      /* ignore */
    }
  }
}

export function findFirstMetadataObj(
  path: string,
  required: string[],
  maxLines = 50
): Record<string, unknown> | null {
  for (const raw of readFirstLines(path, maxLines)) {
    const line = raw.trim();
    if (!line) continue;
    let obj: unknown;
    try {
      obj = JSON.parse(line);
    } catch {
      continue;
    }
    if (obj === null || typeof obj !== "object") continue;
    const rec = obj as Record<string, unknown>;
    if (required.every((field) => rec[field])) return rec;
  }
  return null;
}

export function findFirstUserMessage(path: string, maxLines = DEFAULT_MAX_LINES): string | null {
  for (const raw of readFirstLines(path, maxLines)) {
    const line = raw.trim();
    if (!line) continue;
    let obj: unknown;
    try {
      obj = JSON.parse(line);
    } catch {
      continue;
    }
    if (obj === null || typeof obj !== "object") continue;
    const rec = obj as Record<string, unknown>;
    if (rec.type !== "user") continue;
    const msg = rec.message;
    if (msg === null || typeof msg !== "object") continue;
    const content = (msg as Record<string, unknown>).content;
    let text = "";
    if (typeof content === "string") {
      text = content.trim();
    } else if (Array.isArray(content) && content.length > 0) {
      const first: unknown = (content as unknown[])[0];
      if (first && typeof first === "object") {
        const v = (first as Record<string, unknown>).text;
        if (typeof v === "string") text = v.trim();
      }
    }
    if (!text) continue;
    text = text.replace(TG_PREFIX_RE, "").trim();
    const cmdMatch = CMD_MESSAGE_RE.exec(text);
    if (cmdMatch?.[1]) {
      text = "/" + cmdMatch[1].trim();
    }
    if (text) return text;
  }
  return null;
}

export function readLastJsonlObject(path: string): Record<string, unknown> | null {
  let fd: number;
  try {
    fd = openSync(path, "r");
  } catch {
    return null;
  }
  try {
    let size: number;
    try {
      size = statSync(path).size;
    } catch {
      return null;
    }
    if (size === 0) return null;
    const chunkSize = Math.min(size, 65_536);
    const buf = Buffer.alloc(chunkSize);
    readSync(fd, buf, 0, chunkSize, size - chunkSize);
    const tail = buf.toString("utf8");
    const lines = tail.split("\n").reverse();
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      try {
        const obj: unknown = JSON.parse(trimmed);
        if (obj && typeof obj === "object") return obj as Record<string, unknown>;
      } catch {
        continue;
      }
    }
    return null;
  } finally {
    try {
      closeSync(fd);
    } catch {
      /* ignore */
    }
  }
}

export function parseIso8601ToEpoch(s: string | null | undefined): number | null {
  if (!s || typeof s !== "string") return null;
  const t = Date.parse(s);
  return Number.isFinite(t) ? t / 1000 : null;
}

export function sessionDisplayName(jsonlPath: string, sid: string): string {
  const meta = findFirstMetadataObj(jsonlPath, ["slug"], 50);
  if (meta && typeof meta.slug === "string" && meta.slug) {
    return meta.slug;
  }
  const firstMsg = findFirstUserMessage(jsonlPath);
  if (firstMsg) {
    const clean = firstMsg.split(/\s+/).filter(Boolean).join(" ");
    if (clean.startsWith("/")) {
      const label = clean.split(/\s+/)[0] ?? clean;
      return `\u{1F916} ${label}`;
    }
    if (clean.length > 40) return `${clean.slice(0, 40).replace(/\s+$/, "")}…`;
    return clean;
  }
  return sid.slice(0, 8);
}
