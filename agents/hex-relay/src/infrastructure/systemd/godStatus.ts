import type { Logger } from "../../lib/logger.js";
import type { Env } from "../../config/env.js";
import { buildUserRuntimePaths } from "../../config/paths.js";
import { runProcess, type RunProcessResult } from "../process/runProcess.js";
import type { AgentKind } from "../../domain/message.js";

export interface GodStatusDeps {
  env: Env;
  log: Logger;
  timeoutMs?: number;
}

export type GodStatusProbe = ReturnType<typeof createGodStatusProbe>;

function runSystemctl(args: string[], timeoutMs: number): Promise<RunProcessResult> {
  return runProcess("sudo", ["-n", "systemctl", ...args], {
    timeoutMs,
    label: `systemctl ${args.join(" ")}`,
  });
}

export function createGodStatusProbe(deps: GodStatusDeps) {
  const timeout = deps.timeoutMs ?? 3000;
  function serviceName(userId: number, agent: AgentKind = "claude"): string {
    return buildUserRuntimePaths(deps.env, userId, agent).godServiceName;
  }
  return {
    async isActive(userId: number, agent: AgentKind = "claude"): Promise<boolean> {
      const service = serviceName(userId, agent);
      try {
        const r = await runSystemctl(["is-active", service], timeout);
        return r.stdout.trim() === "active";
      } catch (error) {
        deps.log.warn({ err: String(error), service }, "is-active probe failed");
        return false;
      }
    },
    async start(userId: number, agent: AgentKind = "claude"): Promise<void> {
      const service = serviceName(userId, agent);
      const r = await runSystemctl(["start", service], 10_000);
      if (r.code !== 0) {
        throw new Error(`systemctl start ${service} rc=${r.code}: ${r.stderr.slice(0, 240)}`);
      }
    },
    async restart(userId: number, agent: AgentKind = "claude"): Promise<void> {
      const service = serviceName(userId, agent);
      const r = await runSystemctl(["restart", service], 10_000);
      if (r.code !== 0) {
        throw new Error(`systemctl restart ${service} rc=${r.code}: ${r.stderr.slice(0, 240)}`);
      }
    },
    async stop(userId: number, agent: AgentKind = "claude"): Promise<void> {
      const service = serviceName(userId, agent);
      const r = await runSystemctl(["stop", service], 15_000);
      if (r.code !== 0) {
        throw new Error(`systemctl stop ${service} rc=${r.code}: ${r.stderr.slice(0, 240)}`);
      }
    },
    async listActiveInstances(): Promise<{ userId: number; agent: AgentKind }[]> {
      try {
        const r = await runSystemctl(
          [
            "list-units",
            `${deps.env.servicePrefix}-god@*.service`,
            `${deps.env.servicePrefix}-god-codex@*.service`,
            "--state=active",
            "--no-legend",
            "--plain",
          ],
          timeout
        );
        if (r.code !== 0) return [];
        const out: { userId: number; agent: AgentKind }[] = [];
        const codexRe = new RegExp(
          String.raw`^${deps.env.servicePrefix}-god-codex@(\d+)\.service\b`
        );
        const claudeRe = new RegExp(String.raw`^${deps.env.servicePrefix}-god@(\d+)\.service\b`);
        for (const line of r.stdout.split(/\r?\n/)) {
          const trimmed = line.trim();
          if (!trimmed) continue;
          const codex = codexRe.exec(trimmed);
          if (codex) {
            out.push({ userId: Number(codex[1]), agent: "codex" });
            continue;
          }
          const claude = claudeRe.exec(trimmed);
          if (claude) {
            out.push({ userId: Number(claude[1]), agent: "claude" });
          }
        }
        return out;
      } catch (error) {
        deps.log.warn({ err: String(error) }, "list active god instances failed");
        return [];
      }
    },
    async isAnyActive(): Promise<boolean> {
      try {
        const r = await runSystemctl(
          [
            "list-units",
            `${deps.env.servicePrefix}-god@*.service`,
            `${deps.env.servicePrefix}-god-codex@*.service`,
            "--state=active",
            "--no-legend",
          ],
          timeout
        );
        return r.code === 0 && r.stdout.trim().length > 0;
      } catch (error) {
        deps.log.warn({ err: String(error) }, "list active god instances failed");
        return false;
      }
    },
  };
}
