import { existsSync, readdirSync, statSync, unlinkSync } from "node:fs";
import { join, resolve } from "node:path";
import { UUID_RE, TIMING } from "../../config/paths.js";
import type { SessionListItem } from "../../domain/session.js";
import type { Logger } from "../../lib/logger.js";
import type { SessionTranscriptStore } from "../../services/ports.js";
import type { SessionsDirCache } from "./sessionsDirCache.js";
import {
  parseIso8601ToEpoch,
  readLastJsonlObject,
  sessionDisplayName,
} from "../jsonl/sessionParser.js";

export function createSessionTranscriptStore(deps: {
  log: Logger;
  sessionsDir: SessionsDirCache;
}): SessionTranscriptStore {
  function resolvePath(sessionId: string, ownerUserId: number | null): string | null {
    if (!UUID_RE.test(sessionId) || ownerUserId === null) return null;
    const sessionDir = deps.sessionsDir.get(ownerUserId);
    if (!sessionDir) return null;
    const target = resolve(sessionDir, `${sessionId}.jsonl`);
    if (resolve(target, "..") !== resolve(sessionDir)) {
      deps.log.warn({ sessionId, target }, "path traversal rejected");
      return null;
    }
    return existsSync(target) ? target : null;
  }

  function listSessions(ownerIds: number[], owners: Map<string, number | null>): SessionListItem[] {
    const out: SessionListItem[] = [];
    for (const ownerId of ownerIds) {
      const sessionDir = deps.sessionsDir.get(ownerId);
      if (!sessionDir || !existsSync(sessionDir)) continue;
      let entries: string[];
      try {
        entries = readdirSync(sessionDir);
      } catch {
        continue;
      }
      for (const name of entries) {
        if (!name.endsWith(".jsonl")) continue;
        const sid = name.slice(0, -".jsonl".length);
        if (!UUID_RE.test(sid)) continue;
        const owner = owners.get(sid) ?? null;
        if (owner === null) {
          deps.log.warn({ sid }, "session has no owner — skipping");
          continue;
        }
        if (owner !== ownerId) continue;
        const full = join(sessionDir, name);
        let ts: number;
        try {
          ts = statSync(full).mtimeMs / 1000;
        } catch {
          continue;
        }
        const last = readLastJsonlObject(full);
        if (last) {
          const parsed = parseIso8601ToEpoch(last.timestamp as string | undefined);
          if (parsed) ts = parsed;
        }
        out.push({ sid, slug: sessionDisplayName(full, sid), ts, owner });
      }
    }
    out.sort((a, b) => b.ts - a.ts);
    return out.slice(0, TIMING.sessionsAllCap);
  }

  return {
    resolvePath,
    listSessions,
    deleteSessionFile(sessionId: string, ownerUserId: number | null): boolean {
      const path = resolvePath(sessionId, ownerUserId);
      if (!path) return false;
      try {
        unlinkSync(path);
        return true;
      } catch (error) {
        deps.log.warn({ err: String(error), sessionId }, "delete session file failed");
        return false;
      }
    },
    remember(ownerUserId: number, transcriptPath: string | null): void {
      deps.sessionsDir.remember(ownerUserId, transcriptPath);
    },
  };
}
