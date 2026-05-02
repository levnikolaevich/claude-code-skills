import type { FastifyInstance } from "fastify";
import type { Logger } from "../../lib/logger.js";
import type { MemoryService } from "../../services/memory.service.js";
import { MemoryAddBodySchema, MemoryForgetBodySchema } from "./schemas.js";
import { memoryRowToWire } from "./apiSerializers.js";

export interface MemoryRoutesDeps {
  log: Logger;
  memory: MemoryService;
}

export function registerMemoryRoutes(app: FastifyInstance, deps: MemoryRoutesDeps): void {
  app.post("/memory/add", async (req, reply) => {
    const parsed = MemoryAddBodySchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "category and text required" });
    }
    const d = parsed.data;
    const memId = deps.memory.add({
      category: d.category,
      text: d.text,
      tags: d.tags ?? null,
      source: d.source ?? null,
      expiresAt: d.expires_at ?? null,
    });
    deps.log.info({ memId, category: d.category }, "MEMORY add");
    return reply.send({ memory_id: memId });
  });

  app.get("/memory/recent", async (req, reply) => {
    const q = req.query as Record<string, string | undefined>;
    const n = Number.parseInt(q.n ?? "20", 10);
    const cat = q.category ?? null;
    const rows = deps.memory.recent(Number.isFinite(n) ? n : 20, cat);
    return reply.send({ memories: rows.map(memoryRowToWire) });
  });

  app.post("/memory/forget", async (req, reply) => {
    const parsed = MemoryForgetBodySchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: "bad body" });
    const d = parsed.data;
    const deleted = deps.memory.forget(d.memory_id ?? null, d.tag_match ?? null);
    return reply.send({ deleted });
  });
}
