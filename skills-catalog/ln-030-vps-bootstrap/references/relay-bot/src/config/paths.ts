import path from "node:path";
import type { Env } from "./env.js";

export interface Paths {
  stateDir: string;
  cmdFile: string;
  lastCmdFile: string;
  cmdLockFile: string;
  sessionsDirCacheFile: string;
  errorFile: string;
  lastSessionFile: string;
  mediaDir: string;
  godServiceName: string;
  claudeProjectsHome: string;
}

export function buildPaths(env: Env): Paths {
  const stateDir = `/var/lib/${env.projectName}`;
  return {
    stateDir,
    cmdFile: path.join(stateDir, "god-command.json"),
    lastCmdFile: path.join(stateDir, "last-god-command.json"),
    cmdLockFile: path.join(stateDir, ".cmd-lock"),
    sessionsDirCacheFile: path.join(stateDir, "sessions-dir.path"),
    errorFile: path.join(stateDir, "last-god-error.json"),
    lastSessionFile: path.join(stateDir, "last-session.id"),
    mediaDir: path.join(stateDir, "tg-media"),
    godServiceName: `${env.servicePrefix}-god.service`,
    claudeProjectsHome: `/home/${env.botUser}/.claude/projects`,
  };
}

export const TIMING = {
  outboxPollMs: 2000,
  outboxMaxAttempts: 5,
  outboxAbandonTtlSec: 24 * 3600,
  inboundPollMs: 1000,
  inboundMaxAttempts: 30,
  inboundAbandonTtlSec: 24 * 3600,
  errorAlerterPollMs: 5000,
  mediaRetentionDays: 14,
  lastCmdTtlSec: 300,
  tgMaxLen: 4096,
  memoryInjectLimit: 20,
  dispatchRecentLimit: 3,
  sessionsTopN: 10,
  sessionsAllCap: 50,
  tokenBucketMax: 5,
  tokenBucketWindowSec: 60,
  skillNameMaxLen: 60,
  todoTextMaxLen: 80,
  sendKeysRetries: 8,
  sendKeysRetryDelayMs: 1500,
  mediaMaxBytes: 25 * 1024 * 1024,
} as const;

export const IMAGE_MIMES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

export const REACTION_FALLBACK = "❤";
export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const TG_PREFIX_RE = /^\[tg id=(\d+):(\d+)(?:\s+user=\S+)?\]\s?/;
export const CMD_MESSAGE_RE = /<command-message>\s*([^<]+?)\s*<\/command-message>/i;
