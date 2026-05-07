import type { FastifyReply } from "fastify";
import type { ServiceError, ServiceOutcome } from "../../services/outcome.js";

export interface ErrorEnvelope {
  ok: false;
  error: {
    code: string;
    message: string;
    retryable: boolean;
    details?: Record<string, unknown>;
  };
}

export function statusForServiceError(error: ServiceError): number {
  if (error.kind === "validation") return 400;
  if (error.kind === "not_found") return 404;
  if (error.kind === "conflict") return 409;
  if (error.kind === "rate_limited") return 429;
  if (error.kind === "transient") return 503;
  return 500;
}

export function errorEnvelope(error: ServiceError): ErrorEnvelope {
  return {
    ok: false,
    error: {
      code: error.code,
      message: error.message,
      retryable: error.retryable,
      details: error.details,
    },
  };
}

export function sendServiceError(reply: FastifyReply, error: ServiceError): FastifyReply {
  return reply.code(statusForServiceError(error)).send(errorEnvelope(error));
}

export function sendOutcome<T>(
  reply: FastifyReply,
  outcome: ServiceOutcome<T>,
  buildSuccess: (value: T) => Record<string, unknown>
): FastifyReply {
  if (!outcome.ok) return sendServiceError(reply, outcome.error);
  return reply.send(buildSuccess(outcome.value));
}
