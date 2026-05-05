import { spawn } from "node:child_process";

export interface RunProcessOptions {
  timeoutMs: number;
  label?: string;
  killSignal?: NodeJS.Signals;
}

export interface RunProcessResult {
  code: number;
  signal: NodeJS.Signals | null;
  stdout: string;
  stderr: string;
}

export class RunProcessTimeoutError extends Error {
  readonly code: number;
  readonly signal: NodeJS.Signals | null;
  readonly stdout: string;
  readonly stderr: string;
  readonly timeoutMs: number;

  constructor(label: string, timeoutMs: number, result: RunProcessResult) {
    super(`${label} timed out after ${timeoutMs}ms`);
    this.name = "RunProcessTimeoutError";
    this.code = result.code;
    this.signal = result.signal;
    this.stdout = result.stdout;
    this.stderr = result.stderr;
    this.timeoutMs = timeoutMs;
  }
}

export function runProcess(
  cmd: string,
  args: string[],
  options: RunProcessOptions
): Promise<RunProcessResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: ["ignore", "pipe", "pipe"] });
    const stdout: Buffer[] = [];
    const stderr: Buffer[] = [];
    let timedOut = false;
    const label = options.label ?? [cmd, ...args].join(" ");
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill(options.killSignal ?? "SIGKILL");
    }, options.timeoutMs);
    child.stdout.on("data", (b: Buffer) => stdout.push(b));
    child.stderr.on("data", (b: Buffer) => stderr.push(b));
    child.on("error", (err) => {
      clearTimeout(timer);
      reject(err);
    });
    child.on("close", (code, signal) => {
      clearTimeout(timer);
      const result = {
        code: code ?? -1,
        signal,
        stdout: Buffer.concat(stdout).toString("utf8"),
        stderr: Buffer.concat(stderr).toString("utf8"),
      };
      if (timedOut) {
        reject(new RunProcessTimeoutError(label, options.timeoutMs, result));
        return;
      }
      resolve(result);
    });
  });
}
