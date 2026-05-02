import type { Logger } from "./logger.js";

export interface ShutdownTask {
  name: string;
  fn: () => Promise<void> | void;
}

/**
 * Register SIGTERM/SIGINT handler that runs ordered shutdown tasks once.
 */
export function installSignalHandlers(
  log: Logger,
  tasks: ShutdownTask[],
  timeoutMs = 10_000
): void {
  let shuttingDown = false;
  const handle = (sig: NodeJS.Signals) => {
    if (shuttingDown) return;
    shuttingDown = true;
    log.info({ signal: sig }, "shutdown requested");
    const drainTimer = setTimeout(() => {
      log.error({ timeoutMs }, "shutdown timeout exceeded — forcing exit");
      process.exit(1);
    }, timeoutMs);
    drainTimer.unref();
    runTasks(tasks, log)
      .then(() => {
        log.info("shutdown complete");
        process.exit(0);
      })
      .catch((error: unknown) => {
        log.error({ err: error }, "shutdown failed");
        process.exit(1);
      });
  };
  process.on("SIGTERM", handle);
  process.on("SIGINT", handle);
}

async function runTasks(tasks: ShutdownTask[], log: Logger): Promise<void> {
  for (const task of tasks) {
    try {
      await task.fn();
      log.debug({ task: task.name }, "shutdown task done");
    } catch (error) {
      log.error({ err: error, task: task.name }, "shutdown task failed");
    }
  }
}
