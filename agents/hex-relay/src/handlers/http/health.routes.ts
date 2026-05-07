import { existsSync, statSync } from "node:fs";
import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import type { ControlLane } from "../../services/controlLane.service.js";
import type {
  GodStatusPort,
  MessagesRepository,
  OutboxRepository,
  SessionRepository,
} from "../../services/ports.js";
import type { BuildInfo } from "../../config/buildInfo.js";
import { HealthResponseSchema } from "./schemas.js";
import { getPendingFanoutAcksTotal } from "./hooks.routes.js";
import { renderPrometheusMetrics } from "../../observability/metrics.js";

interface RuntimePendingReplyRepository {
  countActive(maxAgeSec: number): number;
}

export interface RuntimeStatusDeps {
  outboxRepo: Pick<OutboxRepository, "counts">;
  messagesRepo: Pick<MessagesRepository, "counts">;
  pendingRepo: RuntimePendingReplyRepository;
  sessionsRepo: Pick<SessionRepository, "lastActiveSid">;
  controlLane: ControlLane;
  godStatus: Pick<GodStatusPort, "isAnyActive">;
  dbPath: string;
}

export interface RuntimeStatus {
  godSessionReady: boolean;
  controlBusy: boolean;
  controlPending: number;
  controlCurrent: string | null;
  controlLastAction: string | null;
  inboundQueued: number;
  inboundFailed: number;
  inboundRejected: number;
  pendingCount: number;
  pendingFanoutAcksTotal: number;
  outboxQueued: number;
  outboxAbandoned: number;
  outboxUnknown: number;
  activeSessionShort: string | null;
  dbSizeBytes: number;
}

export type HealthRoutesDeps = RuntimeStatusDeps & BuildInfo;

export async function collectRuntimeStatus(deps: RuntimeStatusDeps): Promise<RuntimeStatus> {
  const outbox = deps.outboxRepo.counts();
  const messages = deps.messagesRepo.counts();
  const pendingCount = deps.pendingRepo.countActive(3600);
  const lastSession = deps.sessionsRepo.lastActiveSid();
  const dbSize = existsSync(deps.dbPath) ? statSync(deps.dbPath).size : 0;
  const lane = deps.controlLane.state();
  const godReady = await deps.godStatus.isAnyActive();
  return {
    godSessionReady: godReady,
    controlBusy: lane.busy,
    controlPending: lane.pending,
    controlCurrent: lane.current,
    controlLastAction: lane.lastAction,
    inboundQueued: messages.inboundQueued,
    inboundFailed: messages.inboundFailed,
    inboundRejected: messages.inboundRejected,
    pendingCount,
    pendingFanoutAcksTotal: getPendingFanoutAcksTotal(),
    outboxQueued: outbox.queued,
    outboxAbandoned: outbox.abandoned,
    outboxUnknown: outbox.unknown,
    activeSessionShort: lastSession ? lastSession.slice(0, 8) : null,
    dbSizeBytes: dbSize,
  };
}

export function registerHealthRoutes(app: FastifyInstance, deps: HealthRoutesDeps): void {
  const zodApp = app.withTypeProvider<ZodTypeProvider>();
  zodApp.get("/live", async (_req, reply) => reply.send({ ok: true }));

  zodApp.route({
    method: "GET",
    url: "/health",
    schema: {
      response: { 200: HealthResponseSchema },
    },
    handler: async (_req, reply) => {
      const s = await collectRuntimeStatus(deps);
      return reply.send({
        ok: true,
        version: deps.relaySchemaVersion,
        relay_schema_version: deps.relaySchemaVersion,
        package_version: deps.packageVersion,
        god_session_ready: s.godSessionReady,
        control_busy: s.controlBusy,
        control_pending: s.controlPending,
        control_current: s.controlCurrent,
        control_last_action: s.controlLastAction,
        inbound_queued: s.inboundQueued,
        inbound_failed: s.inboundFailed,
        inbound_rejected: s.inboundRejected,
        pending_count: s.pendingCount,
        pending_fanout_acks_total: s.pendingFanoutAcksTotal,
        outbox_queued: s.outboxQueued,
        outbox_abandoned: s.outboxAbandoned,
        outbox_unknown: s.outboxUnknown,
        active_session_short: s.activeSessionShort,
        db_size_bytes: s.dbSizeBytes,
      });
    },
  });

  zodApp.get("/ready", async (_req, reply) => {
    try {
      await collectRuntimeStatus(deps);
      return reply.send({ ok: true });
    } catch (error) {
      return reply.code(503).send({
        ok: false,
        error: {
          code: "dependency_unavailable",
          message: "relay dependencies are not ready",
          retryable: true,
          details: { error: String(error) },
        },
      });
    }
  });

  zodApp.get("/metrics", async (_req, reply) => {
    const s = await collectRuntimeStatus(deps);
    return reply.type("text/plain; version=0.0.4; charset=utf-8").send(
      renderPrometheusMetrics({
        inboundQueued: s.inboundQueued,
        outboxQueued: s.outboxQueued,
        pendingReplies: s.pendingCount,
      })
    );
  });
}
