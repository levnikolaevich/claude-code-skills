import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import type { Logger } from "../../lib/logger.js";
import type { TaskService } from "../../services/task.service.js";
import { TaskPollResponseSchema } from "./schemas.js";

export interface TaskRoutesDeps {
  log: Logger;
  tasks: TaskService;
}

export function registerTaskRoutes(app: FastifyInstance, deps: TaskRoutesDeps): void {
  const zodApp = app.withTypeProvider<ZodTypeProvider>();
  zodApp.route({
    method: "POST",
    url: "/tasks/poll",
    schema: {
      response: { 200: TaskPollResponseSchema },
    },
    handler: async (_req, reply) => {
      const result = await deps.tasks.pollAndNotifyPrimary();
      deps.log.info({ count: result.count }, "TASKS poll endpoint complete");
      return reply.send({ ok: true, count: result.count });
    },
  });
}
