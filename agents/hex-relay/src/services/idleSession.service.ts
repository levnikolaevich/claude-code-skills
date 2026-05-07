import type { Logger } from "../lib/logger.js";
import type { GodStatusProbe } from "../infrastructure/systemd/godStatus.js";
import type { MessagesRepo } from "../infrastructure/db/repositories/messages.repo.js";
import type { PendingReplyRepo } from "../infrastructure/db/repositories/pendingReply.repo.js";

export interface IdleSessionDeps {
  log: Logger;
  godStatus: GodStatusProbe;
  messagesRepo: MessagesRepo;
  pendingRepo: PendingReplyRepo;
  /** Seconds; if last activity was longer ago, the instance is eligible for shutdown. */
  idleThresholdSec: number;
  /** Seconds since `bootTimestampSec`; instances are not evaluated until this elapses. */
  bootGraceSec: number;
  /** Process-boot timestamp in seconds (overridable for tests). */
  bootTimestampSec: number;
  /** Optional override for `now()` in tests; defaults to `Date.now() / 1000`. */
  nowFn?: () => number;
}

export interface IdleSessionService {
  evaluate(): Promise<IdleEvaluationResult>;
}

export interface IdleEvaluationResult {
  active: number;
  stopped: number;
  skippedMidTurn: number;
  skippedRecent: number;
  skippedBootGrace: boolean;
  errors: number;
}

export function createIdleSessionService(deps: IdleSessionDeps): IdleSessionService {
  const now = deps.nowFn ?? (() => Math.floor(Date.now() / 1000));
  return {
    async evaluate(): Promise<IdleEvaluationResult> {
      const result: IdleEvaluationResult = {
        active: 0,
        stopped: 0,
        skippedMidTurn: 0,
        skippedRecent: 0,
        skippedBootGrace: false,
        errors: 0,
      };

      const sinceBoot = now() - deps.bootTimestampSec;
      if (sinceBoot < deps.bootGraceSec) {
        result.skippedBootGrace = true;
        deps.log.debug({ sinceBoot, bootGraceSec: deps.bootGraceSec }, "idle worker boot grace");
        return result;
      }

      const instances = await deps.godStatus.listActiveInstances();
      result.active = instances.length;
      for (const inst of instances) {
        try {
          const decision = decide({
            now: now(),
            lastActivity: deps.messagesRepo.lastActivityForUserAgent(inst.userId, inst.agent),
            inFlight: deps.pendingRepo.hasOpenForUserAgent(inst.userId, inst.agent),
            idleThresholdSec: deps.idleThresholdSec,
          });
          if (decision === "skip_recent") {
            result.skippedRecent += 1;
            continue;
          }
          if (decision === "skip_mid_turn") {
            result.skippedMidTurn += 1;
            deps.log.info(
              { userId: inst.userId, agent: inst.agent },
              "idle worker: skipping mid-turn instance"
            );
            continue;
          }
          await deps.godStatus.stop(inst.userId, inst.agent);
          result.stopped += 1;
          deps.log.info(
            { userId: inst.userId, agent: inst.agent, idleThresholdSec: deps.idleThresholdSec },
            "idle worker: stopped idle god-session"
          );
        } catch (error) {
          result.errors += 1;
          deps.log.warn(
            { err: String(error), userId: inst.userId, agent: inst.agent },
            "idle worker: evaluation/stop failed"
          );
        }
      }
      return result;
    },
  };
}

export type IdleDecision = "stop" | "skip_recent" | "skip_mid_turn";

export function decide(args: {
  now: number;
  lastActivity: number | null;
  inFlight: boolean;
  idleThresholdSec: number;
}): IdleDecision {
  if (args.inFlight) return "skip_mid_turn";
  if (args.lastActivity === null) return "skip_recent";
  const idleFor = args.now - args.lastActivity;
  if (idleFor < args.idleThresholdSec) return "skip_recent";
  return "stop";
}
