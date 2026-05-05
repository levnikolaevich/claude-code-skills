import { loadEnv } from "./config/env.js";
import { createLogger } from "./lib/logger.js";
import { installSignalHandlers } from "./lib/shutdown.js";
import { buildApp } from "./app.js";

async function main(): Promise<void> {
  const log = createLogger();
  let env;
  try {
    env = loadEnv();
  } catch (error) {
    log.error({ err: String(error) }, "invalid environment — aborting");
    process.exit(2);
  }
  const app = buildApp(env, log);
  installSignalHandlers(log, [
    {
      name: "app.stop",
      fn: () => app.stop(),
    },
  ]);
  try {
    await app.start();
  } catch (error) {
    log.error({ err: String(error) }, "fatal startup error");
    await app
      .stop()
      .catch((error: unknown) => log.warn({ err: String(error) }, "app.stop failed during fatal"));
    process.exit(1);
  }
}

void main();
