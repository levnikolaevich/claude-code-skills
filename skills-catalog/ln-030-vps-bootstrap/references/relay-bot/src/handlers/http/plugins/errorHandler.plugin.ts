import type { FastifyInstance } from "fastify";
import { ZodError } from "zod/v4";
import type { Logger } from "../../../lib/logger.js";

export function registerErrorHandler(app: FastifyInstance, log: Logger): void {
  app.setErrorHandler((err, _req, reply) => {
    if (err instanceof ZodError) {
      log.warn({ issues: err.issues }, "request validation failed");
      reply.code(400).send({
        error: "validation",
        issues: err.issues.map((i) => ({
          path: i.path,
          message: i.message,
        })),
      });
      return;
    }
    log.error({ err: String(err) }, "unhandled http error");
    reply.code(500).send({ error: "internal" });
  });
}
