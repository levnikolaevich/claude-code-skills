import { setTimeout as delay } from "node:timers/promises";
import { randomBytes } from "node:crypto";
import type { Logger } from "../../lib/logger.js";
import { runProcess as runChildProcess, type RunProcessResult } from "../process/runProcess.js";

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

function runTmuxProcess(cmd: string, args: string[], timeoutMs: number): Promise<RunProcessResult> {
  return runChildProcess(cmd, args, { timeoutMs });
}

function makeBufferName(): string {
  return `hex-${Date.now().toString(36)}-${randomBytes(4).toString("hex")}`;
}

export function createTmuxPane(deps: TmuxPaneDeps) {
  const target = deps.target;
  const socketName = deps.socketName;
  const retries = deps.retries ?? DEFAULT_RETRIES;
  const retryDelay = deps.retryDelayMs ?? DEFAULT_RETRY_DELAY_MS;

  function tmuxArgs(args: string[]): string[] {
    return socketName ? ["-L", socketName, ...args] : args;
  }

  // Use the tmux paste-buffer path instead of `send-keys -l`. With a multi-line
  // payload, `send-keys -l` re-parses each line through tmux's argv parser, so a
  // line that begins with `-` (e.g. a markdown bullet or `--- divider`) gets
  // rejected as an invalid flag. set-buffer + paste-buffer treats the whole
  // payload as opaque data; `--` terminates option parsing for set-buffer.
  async function sendKeysOnce(text: string): Promise<void> {
    const bufferName = makeBufferName();
    const setBuf = await runTmuxProcess(
      "tmux",
      tmuxArgs(["set-buffer", "-b", bufferName, "--", text]),
      STEP_TIMEOUT_MS
    );
    if (setBuf.code !== 0) {
      throw new Error(`set-buffer rc=${setBuf.code}: ${setBuf.stderr.slice(0, 200)}`);
    }
    const paste = await runTmuxProcess(
      "tmux",
      tmuxArgs(["paste-buffer", "-d", "-p", "-r", "-b", bufferName, "-t", target]),
      STEP_TIMEOUT_MS
    );
    if (paste.code !== 0) {
      await runTmuxProcess(
        "tmux",
        tmuxArgs(["delete-buffer", "-b", bufferName]),
        STEP_TIMEOUT_MS
      ).catch(() => null);
      throw new Error(`paste-buffer rc=${paste.code}: ${paste.stderr.slice(0, 200)}`);
    }
    const enter = await runTmuxProcess(
      "tmux",
      tmuxArgs(["send-keys", "-t", target, "Enter"]),
      STEP_TIMEOUT_MS
    );
    if (enter.code !== 0) {
      throw new Error(`send-keys Enter rc=${enter.code}: ${enter.stderr.slice(0, 200)}`);
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
        await runTmuxProcess("tmux", tmuxArgs(["send-keys", "-t", target, "C-c", "C-c"]), 3000);
      } catch (error) {
        deps.log.warn({ err: String(error) }, "graceful tmux Ctrl-C step failed");
      }
      await delay(1500);
      try {
        await runTmuxProcess("tmux", tmuxArgs(["send-keys", "-t", target, "/exit", "Enter"]), 3000);
      } catch (error) {
        deps.log.warn({ err: String(error) }, "graceful tmux /exit step failed");
      }
      await delay(1500);
      try {
        await runTmuxProcess("tmux", tmuxArgs(["kill-session", "-t", target]), 5000);
      } catch (error) {
        deps.log.error({ err: String(error) }, "tmux kill-session failed");
      }
    },

    async hasSession(): Promise<boolean> {
      try {
        const r = await runTmuxProcess("tmux", tmuxArgs(["has-session", "-t", target]), 3000);
        return r.code === 0;
      } catch {
        return false;
      }
    },
  };
}
