import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import type { Logger } from "../../lib/logger.js";
import type { MemoryService } from "../../services/memory.service.js";
import {
  MemoryAddBodySchema,
  MemoryForgetBodySchema,
  MemoryRecentQuerySchema,
  MemoryAddResponseSchema,
  MemoryRecentResponseSchema,
  MemoryForgetResponseSchema,
} from "./schemas.js";
import { memoryRowToWire } from "./apiSerializers.js";

export interface MemoryRoutesDeps {
  log: Logger;
  memory: MemoryService;
}

export function registerMemoryRoutes(app: FastifyInstance, deps: MemoryRoutesDeps): void {
  const zodApp = app.withTypeProvider<ZodTypeProvider>();
  zodApp.route({
    method: "POST",
    url: "/memory/add",
    schema: {
      body: MemoryAddBodySchema,
      response: { 200: MemoryAddResponseSchema },
    },
    handler: async (req, reply) => {
      const d = req.body;
      const memId = deps.memory.add({
        category: d.category,
        text: d.text,
        tags: d.tags ?? null,
        source: d.source ?? null,
        expiresAt: d.expires_at ?? null,
      });
      deps.log.info({ memId, category: d.category }, "MEMORY add");
      return reply.send({ memory_id: memId });
    },
  });

  zodApp.route({
    method: "GET",
    url: "/memory/recent",
    schema: {
      querystring: MemoryRecentQuerySchema,
      response: { 200: MemoryRecentResponseSchema },
    },
    handler: async (req, reply) => {
      const rows = deps.memory.recent(req.query.n, req.query.category ?? null);
      return reply.send({ memories: rows.map(memoryRowToWire) });
    },
  });

  zodApp.route({
    method: "POST",
    url: "/memory/forget",
    schema: {
      body: MemoryForgetBodySchema,
      response: { 200: MemoryForgetResponseSchema },
    },
    handler: async (req, reply) => {
      const d = req.body;
      const deleted = deps.memory.forget(d.memory_id ?? null, d.tag_match ?? null);
      return reply.send({ deleted });
    },
  });
}
