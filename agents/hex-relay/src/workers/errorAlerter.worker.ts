import { setTimeout as delay } from "node:timers/promises";
import type { Bot } from "grammy";
import type { Logger } from "../lib/logger.js";
import type { GodErrorReader } from "../infrastructure/filesystem/godError.js";
import { TIMING } from "../config/paths.js";

export interface ErrorAlerterWorker {
  start(): Promise<void>;
  stop(): void;
}

function stringValue(value: unknown): string {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return "";
}

function numberValue(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  return null;
}

function classifyGodError(err: Record<string, unknown>): string {
  const raw = JSON.stringify(err).toLowerCase();
  const explicit = stringValue(err.kind) || stringValue(err.reason) || "unknown";
  if (
    explicit === "auth_failed" ||
    raw.includes("authentication_error") ||
    raw.includes("invalid authentication credentials") ||
    raw.includes("please run /login") ||
    raw.includes("api error: 401")
  ) {
    return "auth_failed";
  }
  if (explicit !== "unknown") return explicit;
  return "god_session_error";
}

function formatGodError(err: Record<string, unknown>): string {
  const kind = classifyGodError(err);
  const project = stringValue(err.project_name);
  const user = stringValue(err.user_id);
  const session = stringValue(err.session_id) || stringValue(err.session);
  const reason = stringValue(err.reason);
  const details = stringValue(err.details);
  const runtimeSeconds = numberValue(err.runtime_seconds);
  const runtime = runtimeSeconds === null ? "" : `${runtimeSeconds}s`;
  const lines = [
    `[admin] god-session error: ${kind}`,
    project ? `project: ${project}` : "",
    user ? `user: ${user}` : "",
    session ? `session: ${session}` : "",
    runtime ? `runtime: ${runtime}` : "",
    reason ? `reason: ${reason}` : "",
    details ? `details: ${details}` : "",
  ].filter(Boolean);
  if (kind === "auth_failed") {
    lines.push(
      "action: verify sandbox mounts ~/.claude and ~/.codex as writable directories, then run Claude login for the VPS-wide agent account if needed and restart affected god sessions."
    );
  }
  return lines.join("\n").slice(0, 3500);
}

export function createErrorAlerterWorker(deps: {
  log: Logger;
  bot: Bot;
  reader: GodErrorReader;
  primaryOperator: number;
}): ErrorAlerterWorker {
  let running = false;
  return {
    async start() {
      if (running) return;
      running = true;
      deps.log.info({ pollMs: TIMING.errorAlerterPollMs }, "error alerter started");
      while (running) {
        try {
          const err = deps.reader.consume();
          if (err) {
            const kind = classifyGodError(err);
            try {
              await deps.bot.api.sendMessage(deps.primaryOperator, formatGodError(err));
              deps.log.info({ kind }, "alerted operator about god-session error");
            } catch (error) {
              deps.log.warn({ err: String(error) }, "error alerter sendMessage failed");
            }
          }
        } catch (error) {
          deps.log.error({ err: String(error) }, "error_alerter iteration failed");
        }
        await delay(TIMING.errorAlerterPollMs);
      }
    },
    stop() {
      running = false;
    },
  };
}
