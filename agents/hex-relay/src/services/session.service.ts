import { unlinkSync, statSync, readdirSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";
import type { Logger } from "../lib/logger.js";
import { UUID_RE, TIMING } from "../config/paths.js";
import type { SessionsRepo } from "../infrastructure/db/repositories/sessions.repo.js";
import type { SessionEventsRepo } from "../infrastructure/db/repositories/sessionEvents.repo.js";
import type { SessionsDirCache } from "../infrastructure/filesystem/sessionsDirCache.js";
import type { LastGodCommandReader } from "../infrastructure/filesystem/lastGodCommand.js";
import type { SessionListItem } from "../domain/session.js";
import { resolveSessionOwner } from "../domain/session.js";
import {
  parseIso8601ToEpoch,
  readLastJsonlObject,
  sessionDisplayName,
} from "../infrastructure/jsonl/sessionParser.js";

export type SessionService = ReturnType<typeof createSessionService>;

export interface SessionUpsertArgs {
  sessionId: string;
  source: string;
  model: string | null;
  cwd: string | null;
  transcriptPath: string | null;
  previousSession: string | null;
  primaryOperator: number;
}

export function createSessionService(deps: {
  log: Logger;
  sessionsRepo: SessionsRepo;
  sessionEventsRepo: SessionEventsRepo;
  sessionsDir: SessionsDirCache;
  lastGodCommand: LastGodCommandReader;
  lastSessionForUser(userId: number): { write(sid: string): void };
  primaryOperator: number;
}) {
  function validateSessionPath(sid: string, ownerUserId?: number | null): string | null {
    if (!UUID_RE.test(sid)) return null;
    const owner = ownerUserId ?? deps.sessionsRepo.getOwner(sid);
    if (owner === null) return null;
    const sd = deps.sessionsDir.get(owner);
    if (!sd) return null;
    const target = resolve(sd, `${sid}.jsonl`);
    if (resolve(target, "..") !== resolve(sd)) {
      deps.log.warn({ sid, target }, "path traversal rejected");
      return null;
    }
    if (!existsSync(target)) return null;
    return target;
  }

  function listSessions(args: {
    ownerUserId: number | null;
    limit: number | null;
  }): SessionListItem[] {
    let owners: Map<string, number | null>;
    try {
      owners = deps.sessionsRepo.allOwners();
    } catch (error) {
      deps.log.error({ err: String(error) }, "list sessions owners lookup failed");
      owners = new Map();
    }
    const ownerIds =
      args.ownerUserId === null
        ? [...new Set([...owners.values()].filter((v): v is number => v !== null))]
        : [args.ownerUserId];
    const out: SessionListItem[] = [];
    for (const ownerId of ownerIds) {
      const sd = deps.sessionsDir.get(ownerId);
      if (!sd || !existsSync(sd)) continue;
      let entries: string[];
      try {
        entries = readdirSync(sd);
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
        const full = join(sd, name);
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
        const slug = sessionDisplayName(full, sid);
        out.push({ sid, slug, ts, owner });
      }
    }
    out.sort((a, b) => b.ts - a.ts);
    if (args.limit) return out.slice(0, args.limit);
    return out.slice(0, TIMING.sessionsAllCap);
  }

  function deleteSessionFile(sid: string): boolean {
    const path = validateSessionPath(sid);
    if (!path) return false;
    try {
      unlinkSync(path);
      return true;
    } catch (error) {
      deps.log.warn({ err: String(error), sid }, "delete session file failed");
      return false;
    }
  }

  function recordStart(args: SessionUpsertArgs): number {
    const ownerFromCmd = deps.lastGodCommand.consumeOwner();
    const existingOwner = deps.sessionsRepo.getOwner(args.sessionId);
    const previousSession =
      args.previousSession ??
      (ownerFromCmd === null ? null : deps.sessionsRepo.lastActiveSid(ownerFromCmd));
    const previousOwner =
      previousSession === null ? null : deps.sessionsRepo.getOwner(previousSession);
    const owner = resolveSessionOwner({
      existingOwner,
      fromCommandFile: ownerFromCmd,
      previousOwner,
      primaryOperator: args.primaryOperator,
    });
    deps.sessionsRepo.upsert({
      sessionId: args.sessionId,
      source: args.source,
      model: args.model,
      cwd: args.cwd,
      transcriptPath: args.transcriptPath,
      previousSession,
      createdByUserId: owner,
    });
    deps.sessionsDir.remember(owner, args.transcriptPath);
    deps.lastSessionForUser(owner).write(args.sessionId);
    deps.sessionEventsRepo.insert(args.sessionId, "session_start", {
      source: args.source,
      model: args.model,
      previous: previousSession,
      owner,
    });
    return owner;
  }

  return {
    validateSessionPath,
    listSessions,
    deleteSessionFile,
    ensureOwner(sessionId: string, owner: number): void {
      if (!UUID_RE.test(sessionId)) return;
      deps.sessionsRepo.upsert({
        sessionId,
        source: "user_prompt_submit",
        model: null,
        cwd: null,
        transcriptPath: null,
        previousSession: deps.sessionsRepo.lastActiveSid(owner),
        createdByUserId: owner,
      });
      deps.lastSessionForUser(owner).write(sessionId);
    },
    recordStart,
    getOwner(sid: string) {
      return deps.sessionsRepo.getOwner(sid);
    },
    insertEvent: (...args: Parameters<typeof deps.sessionEventsRepo.insert>) =>
      deps.sessionEventsRepo.insert(...args),
    primaryOperator: deps.primaryOperator,
  };
}
