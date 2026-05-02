import {
  closeSync,
  fsyncSync,
  mkdirSync,
  mkdtempSync,
  openSync,
  renameSync,
  unlinkSync,
  writeSync,
  writeFileSync,
  readFileSync,
} from "node:fs";
import { join } from "node:path";
import { randomBytes } from "node:crypto";
import fsExt from "fs-ext";
import type { GodCommand } from "../../domain/command.js";
import type { Logger } from "../../lib/logger.js";

export interface AtomicCommandDeps {
  cmdFile: string;
  stateDir: string;
  log: Logger;
}

export type AtomicCommandWriter = ReturnType<typeof createAtomicCommandWriter>;

const flockSync: (fd: number, op: string) => void = (
  fsExt as unknown as { flockSync: (fd: number, op: string) => void }
).flockSync;

export function createAtomicCommandWriter(deps: AtomicCommandDeps) {
  return {
    write(
      action: "new" | "resume",
      sessionId: string | null,
      operatorChatId: number | null
    ): string {
      if (action !== "new" && action !== "resume") {
        throw new Error(`invalid action: ${String(action)}`);
      }
      const cmdId = randomBytes(12).toString("hex");
      const payload: GodCommand = {
        command_id: cmdId,
        ts: Math.floor(Date.now() / 1000),
        action,
        session_id: sessionId,
        operator_chat_id: operatorChatId,
      };
      mkdirSync(deps.stateDir, { recursive: true });
      const tmpPath = join(deps.stateDir, `.cmd-${cmdId}.tmp`);
      const fd = openSync(tmpPath, "w");
      try {
        flockSync(fd, "ex");
        const buf = Buffer.from(JSON.stringify(payload), "utf8");
        writeSync(fd, buf, 0, buf.length, 0);
        fsyncSync(fd);
      } finally {
        try {
          closeSync(fd);
        } catch {
          /* ignore */
        }
      }
      try {
        renameSync(tmpPath, deps.cmdFile);
      } catch (error) {
        try {
          unlinkSync(tmpPath);
        } catch {
          /* ignore */
        }
        throw error;
      }
      return cmdId;
    },
  };
}

export function readJsonFile<T>(path: string, log?: Logger): T | null {
  try {
    const raw = readFileSync(path, "utf8");
    return JSON.parse(raw) as T;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    log?.warn({ err: String(error), path }, "readJsonFile failed");
    return null;
  }
}

void mkdtempSync;
void writeFileSync;
