import type { FastifyInstance } from "fastify";
import type { Logger } from "../../lib/logger.js";
import type { DispatchService } from "../../services/dispatch.service.js";
import {
  DispatchStartBodySchema,
  DispatchPhaseBodySchema,
  DispatchEndBodySchema,
} from "./schemas.js";
import type { DispatchPhaseStatus, DispatchRunStatus } from "../../domain/dispatch.js";
import { dispatchRunToWire } from "./apiSerializers.js";

export interface DispatchRoutesDeps {
  log: Logger;
  dispatch: DispatchService;
}

export function registerDispatchRoutes(app: FastifyInstance, deps: DispatchRoutesDeps): void {
  app.post("/dispatch/start", async (req, reply) => {
    const parsed = DispatchStartBodySchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "bad body" });
    }
    const data = parsed.data;
    const runId = deps.dispatch.start({
      trigger: data.trigger,
      sessionId: data.session_id ?? null,
      issueNumber: data.issue_number ?? null,
      issueTitle: data.issue_title ?? null,
      budget5h: data.budget_5h_pct ?? null,
      budgetWeek: data.budget_week_pct ?? null,
    });
    deps.log.info({ runId, trigger: data.trigger }, "DISPATCH start");
    return reply.send({ run_id: runId });
  });

  app.post("/dispatch/phase", async (req, reply) => {
    const parsed = DispatchPhaseBodySchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "run_id and phase required" });
    }
    const d = parsed.data;
    deps.dispatch.phase({
      runId: d.run_id,
      phase: d.phase,
      status: d.status as DispatchPhaseStatus,
      verdict: d.verdict ?? null,
      details: d.details ?? null,
    });
    return reply.send({ ok: true });
  });

  app.post("/dispatch/end", async (req, reply) => {
    const parsed = DispatchEndBodySchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "run_id required" });
    }
    const d = parsed.data;
    deps.dispatch.end(d.run_id, {
      status: d.status as DispatchRunStatus,
      prNumber: d.pr_number ?? null,
      prUrl: d.pr_url ?? null,
      branch: d.branch ?? null,
      error: d.error ?? null,
    });
    deps.log.info({ runId: d.run_id, status: d.status }, "DISPATCH end");
    return reply.send({ ok: true });
  });

  app.get("/dispatch/recent", async (req, reply) => {
    const q = req.query as Record<string, string | undefined>;
    const n = Number.parseInt(q.n ?? "10", 10);
    const runs = deps.dispatch.recent(Number.isFinite(n) ? n : 10);
    return reply.send({ runs: runs.map(dispatchRunToWire) });
  });
}
