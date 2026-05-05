import type { Logger } from "../../lib/logger.js";
import type { Env } from "../../config/env.js";
import { buildUserRuntimePaths } from "../../config/paths.js";
import { runProcess, type RunProcessResult } from "../process/runProcess.js";

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
  function serviceName(userId: number): string {
    return buildUserRuntimePaths(deps.env, userId).godServiceName;
  }
  return {
    async isActive(userId: number): Promise<boolean> {
      const service = serviceName(userId);
      try {
        const r = await runSystemctl(["is-active", service], timeout);
        return r.stdout.trim() === "active";
      } catch (error) {
        deps.log.warn({ err: String(error), service }, "is-active probe failed");
        return false;
      }
    },
    async start(userId: number): Promise<void> {
      const service = serviceName(userId);
      const r = await runSystemctl(["start", service], 10_000);
      if (r.code !== 0) {
        throw new Error(`systemctl start ${service} rc=${r.code}: ${r.stderr.slice(0, 240)}`);
      }
    },
    async restart(userId: number): Promise<void> {
      const service = serviceName(userId);
      const r = await runSystemctl(["restart", service], 10_000);
      if (r.code !== 0) {
        throw new Error(`systemctl restart ${service} rc=${r.code}: ${r.stderr.slice(0, 240)}`);
      }
    },
    async isAnyActive(): Promise<boolean> {
      try {
        const r = await runSystemctl(
          [
            "list-units",
            `${deps.env.servicePrefix}-god@*.service`,
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
