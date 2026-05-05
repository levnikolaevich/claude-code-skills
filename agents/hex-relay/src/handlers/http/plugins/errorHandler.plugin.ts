import type { FastifyInstance } from "fastify";
import {
  hasZodFastifySchemaValidationErrors,
  isResponseSerializationError,
} from "fastify-type-provider-zod";
import { ZodError } from "zod/v4";
import type { Logger } from "../../../lib/logger.js";

export function registerErrorHandler(app: FastifyInstance, log: Logger): void {
  app.setErrorHandler((err, req, reply) => {
    if (hasZodFastifySchemaValidationErrors(err)) {
      const validation = (err as { validation: unknown[] }).validation;
      log.warn(
        { issues: validation, method: req.method, url: req.url },
        "request validation failed"
      );
      reply.code(400).send({
        error: "validation",
        issues: validation.map(validationIssueToWire),
      });
      return;
    }
    if (isResponseSerializationError(err)) {
      const responseErr = err as {
        cause?: { issues?: unknown };
        method?: string;
        url?: string;
      };
      log.error(
        { issues: responseErr.cause?.issues, method: responseErr.method, url: responseErr.url },
        "response validation failed"
      );
      reply.code(500).send({ error: "internal" });
      return;
    }
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

function validationIssueToWire(issue: unknown): { path: string; message: string } {
  const rec = issue as Record<string, unknown>;
  return {
    path: typeof rec.instancePath === "string" ? rec.instancePath : "",
    message: typeof rec.message === "string" ? rec.message : "invalid request",
  };
}
