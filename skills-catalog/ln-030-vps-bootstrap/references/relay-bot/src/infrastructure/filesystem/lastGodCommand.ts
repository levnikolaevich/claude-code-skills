import { existsSync, readFileSync, unlinkSync } from "node:fs";
import type { Logger } from "../../lib/logger.js";

export interface LastGodCommandDeps {
  filePath: string;
  ttlSec: number;
  log: Logger;
}

interface StoredCommand {
  ts?: number;
  operator_chat_id?: number;
}

export type LastGodCommandReader = ReturnType<typeof createLastGodCommandReader>;

export function createLastGodCommandReader(deps: LastGodCommandDeps) {
  return {
    consumeOwner(): number | null {
      if (!existsSync(deps.filePath)) return null;
      try {
        const raw = readFileSync(deps.filePath, "utf8");
        const data = JSON.parse(raw) as StoredCommand;
        const ts = Number(data?.ts ?? 0);
        const now = Math.floor(Date.now() / 1000);
        if (now - ts > deps.ttlSec) {
          deps.log.info({ age: now - ts, ttl: deps.ttlSec }, "last-god-command stale — ignoring");
          try {
            unlinkSync(deps.filePath);
          } catch {
            /* ignore */
          }
          return null;
        }
        const owner = data?.operator_chat_id;
        try {
          unlinkSync(deps.filePath);
        } catch {
          /* ignore */
        }
        return typeof owner === "number" ? owner : null;
      } catch (error) {
        deps.log.warn({ err: String(error) }, "read last-god-command.json failed");
        return null;
      }
    },
  };
}
