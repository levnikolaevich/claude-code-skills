import pino from "pino";

export type Logger = pino.Logger;

export function createLogger(): Logger {
  return pino({
    level: process.env.LOG_LEVEL ?? "info",
    base: { app: "hex-relay" },
    timestamp: pino.stdTimeFunctions.isoTime,
  });
}
