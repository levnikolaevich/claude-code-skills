import { spawn } from "node:child_process";
import type { Logger } from "../../lib/logger.js";
import type { Env } from "../../config/env.js";
import { buildUserRuntimePaths } from "../../config/paths.js";

export interface GodStatusDeps {
  env: Env;
  log: Logger;
  timeoutMs?: number;
}

export type GodStatusProbe = ReturnType<typeof createGodStatusProbe>;

interface RunResult {
  code: number;
  stdout: string;
  stderr: string;
}

function runSystemctl(args: string[], timeoutMs: number): Promise<RunResult> {
  return new Promise((resolve, reject) => {
    const child = spawn("sudo", ["-n", "systemctl", ...args], {
      stdio: ["ignore", "pipe", "pipe"],
    });
    const stdout: Buffer[] = [];
    const stderr: Buffer[] = [];
    child.stdout.on("data", (b: Buffer) => stdout.push(b));
    child.stderr.on("data", (b: Buffer) => stderr.push(b));
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new Error(`systemctl ${args.join(" ")} timed out after ${timeoutMs}ms`));
    }, timeoutMs);
    child.on("error", (err) => {
      clearTimeout(timer);
      reject(err);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      resolve({
        code: code ?? -1,
        stdout: Buffer.concat(stdout).toString("utf8"),
        stderr: Buffer.concat(stderr).toString("utf8"),
      });
    });
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
