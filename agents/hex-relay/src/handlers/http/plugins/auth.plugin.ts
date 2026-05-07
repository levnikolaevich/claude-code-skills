import { timingSafeEqual } from "node:crypto";
import type { FastifyInstance } from "fastify";

export interface BearerAuthOptions {
  token: string;
  protectedPrefixes: string[];
}

function matchesToken(actual: string, expected: string): boolean {
  const actualBuf = Buffer.from(actual);
  const expectedBuf = Buffer.from(expected);
  return actualBuf.length === expectedBuf.length && timingSafeEqual(actualBuf, expectedBuf);
}

export function registerBearerAuth(app: FastifyInstance, opts: BearerAuthOptions): void {
  app.addHook("preHandler", (req, reply, done) => {
    const pathname = req.url.split("?")[0] ?? req.url;
    if (
      !opts.protectedPrefixes.some(
        (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
      )
    ) {
      done();
      return;
    }

    const authorization = req.headers.authorization;
    const prefix = "Bearer ";
    const token =
      typeof authorization === "string" && authorization.startsWith(prefix)
        ? authorization.slice(prefix.length)
        : null;
    if (!token || !matchesToken(token, opts.token)) {
      reply.code(401).send({
        ok: false,
        error: {
          code: "unauthorized",
          message: "valid bearer token required",
          retryable: false,
        },
      });
      return;
    }
    done();
  });
}
