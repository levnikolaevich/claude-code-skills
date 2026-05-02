import pino from "pino";

export type Logger = pino.Logger;

export function createLogger(): Logger {
  return pino({
    level: process.env.LOG_LEVEL ?? "info",
    base: { app: "claude-relay-bot" },
    timestamp: pino.stdTimeFunctions.isoTime,
  });
}
