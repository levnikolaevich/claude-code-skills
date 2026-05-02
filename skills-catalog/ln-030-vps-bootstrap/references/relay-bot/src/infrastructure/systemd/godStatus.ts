import { spawn } from "node:child_process";
import type { Logger } from "../../lib/logger.js";

export interface GodStatusDeps {
  serviceName: string;
  log: Logger;
  timeoutMs?: number;
}

export type GodStatusProbe = ReturnType<typeof createGodStatusProbe>;

export function createGodStatusProbe(deps: GodStatusDeps) {
  const timeout = deps.timeoutMs ?? 3000;
  return {
    isActive(): Promise<boolean> {
      return new Promise((resolve) => {
        const child = spawn("systemctl", ["is-active", deps.serviceName], {
          stdio: ["ignore", "pipe", "pipe"],
        });
        const chunks: Buffer[] = [];
        child.stdout.on("data", (b: Buffer) => chunks.push(b));
        const timer = setTimeout(() => {
          child.kill("SIGKILL");
          deps.log.warn({ service: deps.serviceName }, "is-active probe timed out");
          resolve(false);
        }, timeout);
        child.on("error", (err) => {
          clearTimeout(timer);
          deps.log.warn({ err: String(err) }, "is-active probe failed");
          resolve(false);
        });
        child.on("close", () => {
          clearTimeout(timer);
          const out = Buffer.concat(chunks).toString("utf8").trim();
          resolve(out === "active");
        });
      });
    },
  };
}
