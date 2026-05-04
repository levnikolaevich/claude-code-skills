import type { FastifyInstance } from "fastify";
import type { Logger } from "../../lib/logger.js";
import type { TaskService } from "../../services/task.service.js";

export interface TaskRoutesDeps {
  log: Logger;
  tasks: TaskService;
}

export function registerTaskRoutes(app: FastifyInstance, deps: TaskRoutesDeps): void {
  app.post("/tasks/poll", async (_req, reply) => {
    const result = await deps.tasks.pollAndNotifyPrimary();
    deps.log.info({ count: result.count }, "TASKS poll endpoint complete");
    return reply.send({ ok: true, count: result.count });
  });
}
