import { existsSync, statSync } from "node:fs";
import type { FastifyInstance } from "fastify";
import type { OutboxRepo } from "../../infrastructure/db/repositories/outbox.repo.js";
import type { MessagesRepo } from "../../infrastructure/db/repositories/messages.repo.js";
import type { PendingReplyRepo } from "../../infrastructure/db/repositories/pendingReply.repo.js";
import type { SessionsRepo } from "../../infrastructure/db/repositories/sessions.repo.js";
import type { ControlLane } from "../../services/controlLane.service.js";
import type { GodStatusProbe } from "../../infrastructure/systemd/godStatus.js";

export interface HealthRoutesDeps {
  outboxRepo: OutboxRepo;
  messagesRepo: MessagesRepo;
  pendingRepo: PendingReplyRepo;
  sessionsRepo: SessionsRepo;
  controlLane: ControlLane;
  godStatus: GodStatusProbe;
  dbPath: string;
  version?: string;
}

export function registerHealthRoutes(app: FastifyInstance, deps: HealthRoutesDeps): void {
  const version = deps.version ?? "v6.3";
  app.get("/health", async (_req, reply) => {
    const outbox = deps.outboxRepo.counts();
    const messages = deps.messagesRepo.counts();
    const pendingCount = deps.pendingRepo.countActive(3600);
    const lastSession = deps.sessionsRepo.lastActiveSid();
    const dbSize = existsSync(deps.dbPath) ? statSync(deps.dbPath).size : 0;
    const lane = deps.controlLane.state();
    const godReady = await deps.godStatus.isAnyActive();
    return reply.send({
      ok: true,
      version,
      god_session_ready: godReady,
      control_busy: lane.busy,
      control_pending: lane.pending,
      control_current: lane.current,
      control_last_action: lane.lastAction,
      inbound_queued: messages.inboundQueued,
      inbound_failed: messages.inboundFailed,
      inbound_rejected: messages.inboundRejected,
      pending_count: pendingCount,
      outbox_queued: outbox.queued,
      outbox_abandoned: outbox.abandoned,
      outbox_unknown: outbox.unknown,
      active_session_short: lastSession ? lastSession.slice(0, 8) : null,
      db_size_bytes: dbSize,
    });
  });
}
