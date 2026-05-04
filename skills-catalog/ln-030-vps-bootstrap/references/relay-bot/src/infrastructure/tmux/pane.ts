import { spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";
import type { Logger } from "../../lib/logger.js";

export interface TmuxPaneDeps {
  target: string;
  socketName?: string;
  log: Logger;
  retries?: number;
  retryDelayMs?: number;
}

const DEFAULT_RETRIES = 8;
const DEFAULT_RETRY_DELAY_MS = 1500;
const STEP_TIMEOUT_MS = 5000;

export type TmuxPane = ReturnType<typeof createTmuxPane>;

interface RunResult {
  code: number;
  stderr: string;
}

function runProcess(cmd: string, args: string[], timeoutMs: number): Promise<RunResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: ["ignore", "pipe", "pipe"] });
    const chunks: Buffer[] = [];
    child.stderr.on("data", (b: Buffer) => chunks.push(b));
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new Error(`${cmd} ${args.join(" ")} timed out after ${timeoutMs}ms`));
    }, timeoutMs);
    child.on("error", (err) => {
      clearTimeout(timer);
      reject(err);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      const stderr = Buffer.concat(chunks).toString("utf8");
      resolve({ code: code ?? -1, stderr });
    });
  });
}

export function createTmuxPane(deps: TmuxPaneDeps) {
  const target = deps.target;
  const socketName = deps.socketName;
  const retries = deps.retries ?? DEFAULT_RETRIES;
  const retryDelay = deps.retryDelayMs ?? DEFAULT_RETRY_DELAY_MS;

  function tmuxArgs(args: string[]): string[] {
    return socketName ? ["-L", socketName, ...args] : args;
  }

  async function sendKeysOnce(text: string): Promise<void> {
    const r1 = await runProcess(
      "tmux",
      tmuxArgs(["send-keys", "-l", "-t", target, text]),
      STEP_TIMEOUT_MS
    );
    if (r1.code !== 0) {
      throw new Error(`send-keys -l rc=${r1.code}: ${r1.stderr.slice(0, 200)}`);
    }
    const r2 = await runProcess(
      "tmux",
      tmuxArgs(["send-keys", "-t", target, "Enter"]),
      STEP_TIMEOUT_MS
    );
    if (r2.code !== 0) {
      throw new Error(`send-keys Enter rc=${r2.code}: ${r2.stderr.slice(0, 200)}`);
    }
  }

  return {
    async send(text: string): Promise<void> {
      let lastErr: unknown = null;
      for (let attempt = 0; attempt < retries; attempt += 1) {
        try {
          await sendKeysOnce(text);
          if (attempt > 0) {
            deps.log.info({ attempts: attempt }, "send-keys recovered after retries");
          }
          return;
        } catch (error) {
          lastErr = error;
          if (attempt < retries - 1) {
            deps.log.warn(
              { attempt: attempt + 1, retries, err: String(error) },
              "send-keys attempt failed — retrying"
            );
            await delay(retryDelay);
          }
        }
      }
      throw new Error(`send-keys failed after ${retries} retries: ${String(lastErr)}`);
    },

    async killGracefully(): Promise<void> {
      try {
        await runProcess("tmux", tmuxArgs(["send-keys", "-t", target, "C-c", "C-c"]), 3000);
      } catch (error) {
        deps.log.warn({ err: String(error) }, "graceful tmux Ctrl-C step failed");
      }
      await delay(1500);
      try {
        await runProcess("tmux", tmuxArgs(["send-keys", "-t", target, "/exit", "Enter"]), 3000);
      } catch (error) {
        deps.log.warn({ err: String(error) }, "graceful tmux /exit step failed");
      }
      await delay(1500);
      try {
        await runProcess("tmux", tmuxArgs(["kill-session", "-t", target]), 5000);
      } catch (error) {
        deps.log.error({ err: String(error) }, "tmux kill-session failed");
      }
    },

    async hasSession(): Promise<boolean> {
      try {
        const r = await runProcess("tmux", tmuxArgs(["has-session", "-t", target]), 3000);
        return r.code === 0;
      } catch {
        return false;
      }
    },
  };
}
