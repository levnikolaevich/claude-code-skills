import type { Logger } from "../lib/logger.js";
import { UUID_RE, TIMING } from "../config/paths.js";
import type { SessionListItem } from "../domain/session.js";
import { resolveSessionOwner } from "../domain/session.js";
import type { AgentKind } from "../domain/message.js";
import {
  type LastGodCommandPort,
  type LastSessionWriterPort,
  type SessionEventsRepository,
  type SessionRepository,
  type SessionTranscriptStore,
} from "./ports.js";

export type SessionService = ReturnType<typeof createSessionService>;

export interface SessionStartCommand {
  sessionId: string;
  source: string;
  model: string | null;
  cwd: string | null;
  transcriptPath: string | null;
  previousSession: string | null;
  primaryOperator: number;
  agent?: AgentKind;
}

export function createSessionService(deps: {
  log: Logger;
  sessionsRepo: SessionRepository;
  sessionEventsRepo: SessionEventsRepository;
  transcriptStore: SessionTranscriptStore;
  lastGodCommand: LastGodCommandPort;
  lastSessionForUser(userId: number, agent: AgentKind): LastSessionWriterPort;
  primaryOperator: number;
}) {
  function validateSessionPath(sid: string, ownerUserId?: number | null): string | null {
    if (!UUID_RE.test(sid)) return null;
    const owner = ownerUserId ?? deps.sessionsRepo.getOwner(sid);
    return deps.transcriptStore.resolvePath(sid, owner);
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
    const out: SessionListItem[] = deps.transcriptStore.listSessions(ownerIds, owners);
    out.sort((a, b) => b.ts - a.ts);
    if (args.limit) return out.slice(0, args.limit);
    return out.slice(0, TIMING.sessionsAllCap);
  }

  function deleteSessionFile(sid: string): boolean {
    const owner = deps.sessionsRepo.getOwner(sid);
    return deps.transcriptStore.deleteSessionFile(sid, owner);
  }

  function recordStart(args: SessionStartCommand): number {
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
      agent: args.agent,
    });
    deps.transcriptStore.remember(owner, args.transcriptPath);
    deps.lastSessionForUser(owner, args.agent ?? "claude").write(args.sessionId);
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
    ensureOwner(sessionId: string, owner: number, agent: AgentKind = "claude"): void {
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
      deps.lastSessionForUser(owner, agent).write(sessionId);
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
