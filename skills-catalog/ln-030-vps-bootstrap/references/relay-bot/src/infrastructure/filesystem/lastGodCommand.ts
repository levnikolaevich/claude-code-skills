import { existsSync, readdirSync, readFileSync, statSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import type { Logger } from "../../lib/logger.js";

export interface LastGodCommandDeps {
  usersDir: string;
  ttlSec: number;
  log: Logger;
}

interface StoredCommand {
  ts?: number;
  operator_chat_id?: number;
}

export type LastGodCommandReader = ReturnType<typeof createLastGodCommandReader>;

export function createLastGodCommandReader(deps: LastGodCommandDeps) {
  function candidateFiles(): string[] {
    if (!existsSync(deps.usersDir)) return [];
    try {
      return readdirSync(deps.usersDir)
        .filter((name) => /^\d+$/.test(name))
        .map((name) => join(deps.usersDir, name, "last-god-command.json"))
        .filter((filePath) => existsSync(filePath))
        .sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs);
    } catch (error) {
      deps.log.warn({ err: String(error) }, "scan user last-god-command files failed");
      return [];
    }
  }

  return {
    consumeOwner(): number | null {
      const filePath = candidateFiles()[0];
      if (!filePath) return null;
      try {
        const raw = readFileSync(filePath, "utf8");
        const data = JSON.parse(raw) as StoredCommand;
        const ts = Number(data?.ts ?? 0);
        const now = Math.floor(Date.now() / 1000);
        if (now - ts > deps.ttlSec) {
          deps.log.info({ age: now - ts, ttl: deps.ttlSec }, "last-god-command stale — ignoring");
          try {
            unlinkSync(filePath);
          } catch {
            /* ignore */
          }
          return null;
        }
        const owner = data?.operator_chat_id;
        try {
          unlinkSync(filePath);
        } catch {
          /* ignore */
        }
        return typeof owner === "number" ? owner : null;
      } catch (error) {
        deps.log.warn({ err: String(error), filePath }, "read last-god-command.json failed");
        return null;
      }
    },
  };
}
