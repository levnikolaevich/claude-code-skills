import type { FastifyInstance } from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import type { Logger } from "../../lib/logger.js";
import type { TaskService } from "../../services/task.service.js";
import { TaskPollResponseSchema } from "./schemas.js";
import { sendOutcome } from "./serviceErrors.js";

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
      if (result.ok) {
        deps.log.info({ count: result.value.count }, "TASKS poll endpoint complete");
      }
      return sendOutcome(reply, result, (value) => ({ ok: true, count: value.count }));
    },
  });
}
