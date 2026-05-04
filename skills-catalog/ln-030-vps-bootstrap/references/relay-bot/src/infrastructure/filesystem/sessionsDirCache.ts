import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import type { Logger } from "../../lib/logger.js";
import { findFirstMetadataObj } from "../jsonl/sessionParser.js";

export interface SessionsDirCacheDeps {
  cacheFileForUser(userId: number): string;
  claudeProjectsHomeForUser(userId: number): string;
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
  const cached = new Map<number, string>();

  function readCacheFile(userId: number): string | null {
    const cacheFile = deps.cacheFileForUser(userId);
    if (!existsSync(cacheFile)) return null;
    try {
      const candidate = readFileSync(cacheFile, "utf8").trim();
      if (candidate && isDir(candidate)) return candidate;
      deps.log.warn({ userId, candidate }, "cached sessions-dir gone — rediscovering");
    } catch (error) {
      deps.log.warn({ err: String(error), userId }, "read sessions-dir cache failed");
    }
    return null;
  }

  function writeCacheFile(userId: number, path: string): void {
    const cacheFile = deps.cacheFileForUser(userId);
    try {
      writeFileSync(cacheFile, path, "utf8");
    } catch (error) {
      deps.log.warn({ err: String(error), userId }, "cache sessions-dir write failed");
    }
  }

  function discover(userId: number): string | null {
    const claudeProjectsHome = deps.claudeProjectsHomeForUser(userId);
    if (!existsSync(claudeProjectsHome)) return null;
    const target = deps.projectDir.replace(/\/+$/, "").toLowerCase();
    let entries: string[];
    try {
      entries = readdirSync(claudeProjectsHome);
    } catch {
      return null;
    }
    const dirs = entries
      .map((name) => join(claudeProjectsHome, name))
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
          writeCacheFile(userId, entry.path);
          deps.log.info({ userId, dir: entry.path }, "sessions-dir resolved");
          return entry.path;
        }
      }
    }
    return null;
  }

  return {
    get(userId: number): string | null {
      const existing = cached.get(userId);
      if (existing !== undefined) return existing;
      const fromFile = readCacheFile(userId);
      if (fromFile !== null) {
        cached.set(userId, fromFile);
        return fromFile;
      }
      const discovered = discover(userId);
      if (discovered !== null) cached.set(userId, discovered);
      return discovered;
    },
    remember(userId: number, transcriptPath: string | null): void {
      if (!transcriptPath) return;
      const dir = dirname(transcriptPath);
      if (!isDir(dir)) return;
      cached.set(userId, dir);
      writeCacheFile(userId, dir);
    },
    invalidate(userId?: number): void {
      if (userId === undefined) cached.clear();
      else cached.delete(userId);
    },
  };
}
