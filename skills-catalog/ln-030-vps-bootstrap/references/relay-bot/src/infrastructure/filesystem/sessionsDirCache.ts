import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { Logger } from "../../lib/logger.js";
import { findFirstMetadataObj } from "../jsonl/sessionParser.js";

export interface SessionsDirCacheDeps {
  cacheFile: string;
  claudeProjectsHome: string;
  projectDir: string;
  log: Logger;
}

export type SessionsDirCache = ReturnType<typeof createSessionsDirCache>;

function isDir(path: string): boolean {
  try {
    return statSync(path).isDirectory();
  } catch {
    return false;
  }
}

export function createSessionsDirCache(deps: SessionsDirCacheDeps) {
  let cached: string | null = null;

  function readCacheFile(): string | null {
    if (!existsSync(deps.cacheFile)) return null;
    try {
      const candidate = readFileSync(deps.cacheFile, "utf8").trim();
      if (candidate && isDir(candidate)) return candidate;
      deps.log.warn({ candidate }, "cached sessions-dir gone — rediscovering");
    } catch (error) {
      deps.log.warn({ err: String(error) }, "read sessions-dir cache failed");
    }
    return null;
  }

  function writeCacheFile(path: string): void {
    try {
      writeFileSync(deps.cacheFile, path, "utf8");
    } catch (error) {
      deps.log.warn({ err: String(error) }, "cache sessions-dir write failed");
    }
  }

  function discover(): string | null {
    if (!existsSync(deps.claudeProjectsHome)) return null;
    const target = deps.projectDir.replace(/\/+$/, "").toLowerCase();
    let entries: string[];
    try {
      entries = readdirSync(deps.claudeProjectsHome);
    } catch {
      return null;
    }
    const dirs = entries
      .map((name) => join(deps.claudeProjectsHome, name))
      .filter(isDir)
      .map((path) => {
        try {
          return { path, mtime: statSync(path).mtimeMs };
        } catch {
          return { path, mtime: 0 };
        }
      })
      .sort((a, b) => b.mtime - a.mtime);

    for (const entry of dirs) {
      let jsonls: string[];
      try {
        jsonls = readdirSync(entry.path).filter((n) => n.endsWith(".jsonl"));
      } catch {
        continue;
      }
      for (const name of jsonls) {
        const meta = findFirstMetadataObj(join(entry.path, name), ["cwd"]);
        if (!meta) continue;
        const cwd = (typeof meta.cwd === "string" ? meta.cwd : "")
          .replace(/\/+$/, "")
          .toLowerCase();
        if (cwd === target) {
          writeCacheFile(entry.path);
          deps.log.info({ dir: entry.path }, "sessions-dir resolved");
          return entry.path;
        }
      }
    }
    return null;
  }

  return {
    get(): string | null {
      if (cached !== null) return cached;
      const fromFile = readCacheFile();
      if (fromFile !== null) {
        cached = fromFile;
        return cached;
      }
      const discovered = discover();
      if (discovered !== null) cached = discovered;
      return discovered;
    },
    invalidate(): void {
      cached = null;
    },
  };
}
