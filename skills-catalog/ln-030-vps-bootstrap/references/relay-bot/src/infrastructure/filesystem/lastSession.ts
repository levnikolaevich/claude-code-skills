import { mkdirSync, renameSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { UUID_RE } from "../../config/paths.js";
import type { Logger } from "../../lib/logger.js";

export interface LastSessionDeps {
  filePath: string;
  log: Logger;
}

export function createLastSessionWriter(deps: LastSessionDeps) {
  return {
    write(sessionId: string): void {
      if (!sessionId || !UUID_RE.test(sessionId)) return;
      try {
        mkdirSync(dirname(deps.filePath), { recursive: true });
        const tmp = join(dirname(deps.filePath), `.last-session.id.tmp.${process.pid}`);
        writeFileSync(tmp, sessionId, "utf8");
        renameSync(tmp, deps.filePath);
      } catch (error) {
        deps.log.warn({ err: String(error) }, "could not write last-session.id");
      }
    },
  };
}
