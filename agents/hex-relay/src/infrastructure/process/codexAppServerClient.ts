import { spawn } from "node:child_process";

const INITIALIZE_REQUEST = {
  jsonrpc: "2.0" as const,
  id: 1,
  method: "initialize",
  params: {
    clientInfo: {
      name: "hex-relay",
      title: "hex-relay /usage probe",
      version: "1.0.0",
    },
  },
};

const RATE_LIMITS_REQUEST = {
  jsonrpc: "2.0" as const,
  id: 2,
  method: "account/rateLimits/read",
  params: null,
};

export interface CodexRateLimitsOptions {
  timeoutMs: number;
}

interface JsonRpcResponse {
  id?: number | string;
  jsonrpc?: string;
  result?: unknown;
  error?: { code?: number; message?: string };
  method?: string;
}

export class CodexAppServerError extends Error {
  readonly stderr: string;
  readonly exitCode: number | null;

  constructor(message: string, stderr: string, exitCode: number | null) {
    super(message);
    this.name = "CodexAppServerError";
    this.stderr = stderr;
    this.exitCode = exitCode;
  }
}

/**
 * Issues a single `account/rateLimits/read` JSON-RPC call to `codex app-server`
 * over stdio and returns the raw `result` payload as JSON-stringified text.
 *
 * Codex 0.125.0+ ships the app-server transport (#18255). The method mirrors
 * what the TUI `/status` shows: 5h/weekly `usedPercent`, `windowDurationMins`,
 * `resetsAt`, plus per-`limitId` breakdown. No LLM round-trip is performed.
 */
export function readCodexRateLimitsJson(options: CodexRateLimitsOptions): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn("codex", ["app-server"], {
      stdio: ["pipe", "pipe", "pipe"],
    });

    let stdoutBuf = "";
    let stderrBuf = "";
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      try {
        child.kill("SIGKILL");
      } catch {
        /* ignore */
      }
      reject(
        new CodexAppServerError(
          `codex app-server timed out after ${options.timeoutMs}ms`,
          stderrBuf,
          null
        )
      );
    }, options.timeoutMs);

    function tryResolveFromBuffer(): void {
      let newlineIdx = stdoutBuf.indexOf("\n");
      while (newlineIdx !== -1) {
        const line = stdoutBuf.slice(0, newlineIdx).trim();
        stdoutBuf = stdoutBuf.slice(newlineIdx + 1);
        if (line.length > 0) {
          let parsed: JsonRpcResponse | null = null;
          try {
            parsed = JSON.parse(line) as JsonRpcResponse;
          } catch {
            /* skip non-JSON line */
          }
          if (parsed?.id === 2) {
            if (settled) return;
            settled = true;
            clearTimeout(timer);
            try {
              child.kill("SIGTERM");
            } catch {
              /* ignore */
            }
            if (parsed.error) {
              reject(
                new CodexAppServerError(
                  `account/rateLimits/read error: ${parsed.error.message ?? "unknown"}`,
                  stderrBuf,
                  null
                )
              );
            } else {
              resolve(JSON.stringify(parsed.result ?? null));
            }
            return;
          }
        }
        newlineIdx = stdoutBuf.indexOf("\n");
      }
    }

    child.stdout.on("data", (chunk: Buffer) => {
      stdoutBuf += chunk.toString("utf8");
      tryResolveFromBuffer();
    });
    child.stderr.on("data", (chunk: Buffer) => {
      stderrBuf += chunk.toString("utf8");
    });

    child.on("error", (err) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(err);
    });
    child.on("close", (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(
        new CodexAppServerError(
          `codex app-server exited (code ${code ?? "null"}) before responding to id=2`,
          stderrBuf,
          code ?? null
        )
      );
    });

    child.stdin.on("error", () => {
      /* the server may close stdin after responding; ignore EPIPE */
    });
    child.stdin.write(JSON.stringify(INITIALIZE_REQUEST) + "\n");
    child.stdin.write(JSON.stringify(RATE_LIMITS_REQUEST) + "\n");
  });
}
