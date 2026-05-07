import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import type { Logger } from "../../lib/logger.js";
import type { DispatchService } from "../../services/dispatch.service.js";
import {
  DispatchStartBodySchema,
  DispatchPhaseBodySchema,
  DispatchEndBodySchema,
  DispatchRecentQuerySchema,
  DispatchStartResponseSchema,
  DispatchRecentResponseSchema,
  OkResponseSchema,
} from "./schemas.js";
import { dispatchRunToWire } from "./apiSerializers.js";

export interface DispatchRoutesDeps {
  log: Logger;
  dispatch: DispatchService;
}

export function registerDispatchRoutes(app: FastifyInstance, deps: DispatchRoutesDeps): void {
  const zodApp = app.withTypeProvider<ZodTypeProvider>();
  zodApp.route({
    method: "POST",
    url: "/dispatch/start",
    schema: {
      body: DispatchStartBodySchema,
      response: { 200: DispatchStartResponseSchema },
    },
    handler: async (req, reply) => {
      const data = req.body;
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
    },
  });

  zodApp.route({
    method: "POST",
    url: "/dispatch/phase",
    schema: {
      body: DispatchPhaseBodySchema,
      response: { 200: OkResponseSchema },
    },
    handler: async (req, reply) => {
      const d = req.body;
      deps.dispatch.phase({
        runId: d.run_id,
        phase: d.phase,
        status: d.status,
        verdict: d.verdict ?? null,
        details: d.details ?? null,
      });
      return reply.send({ ok: true });
    },
  });

  zodApp.route({
    method: "POST",
    url: "/dispatch/end",
    schema: {
      body: DispatchEndBodySchema,
      response: { 200: OkResponseSchema },
    },
    handler: async (req, reply) => {
      const d = req.body;
      deps.dispatch.end(d.run_id, {
        status: d.status,
        prNumber: d.pr_number ?? null,
        prUrl: d.pr_url ?? null,
        branch: d.branch ?? null,
        error: d.error ?? null,
      });
      deps.log.info({ runId: d.run_id, status: d.status }, "DISPATCH end");
      return reply.send({ ok: true });
    },
  });

  zodApp.route({
    method: "GET",
    url: "/dispatch/recent",
    schema: {
      querystring: DispatchRecentQuerySchema,
      response: { 200: DispatchRecentResponseSchema },
    },
    handler: async (req, reply) => {
      const runs = deps.dispatch.recent(req.query.n);
      return reply.send({ runs: runs.map(dispatchRunToWire) });
    },
  });
}
