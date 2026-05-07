import { randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";
import type { Logger } from "../../../lib/logger.js";
import { recordHttpRequest } from "../../../observability/metrics.js";

export function registerRequestContext(app: FastifyInstance, log: Logger): void {
  app.addHook("onRequest", (req, reply, done) => {
    const raw = req.headers["x-request-id"];
    const requestId = typeof raw === "string" && raw.trim().length > 0 ? raw.trim() : randomUUID();
    reply.header("x-request-id", requestId);
    (req as { requestId?: string }).requestId = requestId;
    done();
  });

  app.addHook("onResponse", (req, reply, done) => {
    const route = req.routeOptions.url ?? req.url.split("?")[0] ?? req.url;
    recordHttpRequest(route, reply.statusCode);
    log.info(
      {
        requestId: (req as { requestId?: string }).requestId,
        method: req.method,
        route,
        status: reply.statusCode,
      },
      "http request complete"
    );
    done();
  });
}
