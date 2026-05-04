import path from "node:path";
import type { Env } from "./env.js";

export interface Paths {
  stateDir: string;
  cmdLockFile: string;
  errorFile: string;
  mediaDir: string;
  godServiceName: string;
}

export interface UserRuntimePaths {
  userId: number;
  userStateDir: string;
  cmdFile: string;
  lastCmdFile: string;
  lastSessionFile: string;
  sessionsDirCacheFile: string;
  claudeProjectsHome: string;
  cmdLockFile: string;
  tmuxTarget: string;
  godServiceName: string;
}

export function buildPaths(env: Env): Paths {
  const stateDir = `/var/lib/${env.projectName}`;
  return {
    stateDir,
    cmdLockFile: path.join(stateDir, ".cmd-lock"),
    errorFile: path.join(stateDir, "last-god-error.json"),
    mediaDir: path.join(stateDir, "tg-media"),
    godServiceName: `${env.servicePrefix}-god@.service`,
  };
}

export function buildUserRuntimePaths(env: Env, userId: number): UserRuntimePaths {
  if (!Number.isSafeInteger(userId) || userId <= 0) {
    throw new Error(`invalid Telegram user id: ${String(userId)}`);
  }
  const stateDir = `/var/lib/${env.projectName}`;
  const userStateDir = path.join(stateDir, "users", String(userId));
  return {
    userId,
    userStateDir,
    cmdFile: path.join(userStateDir, "god-command.json"),
    lastCmdFile: path.join(userStateDir, "last-god-command.json"),
    lastSessionFile: path.join(userStateDir, "last-session.id"),
    sessionsDirCacheFile: path.join(userStateDir, "sessions-dir.path"),
    claudeProjectsHome: path.join(
      env.projectDir,
      ".agent-home",
      "users",
      String(userId),
      ".claude",
      "projects"
    ),
    cmdLockFile: path.join(userStateDir, ".cmd-lock"),
    tmuxTarget: `${env.servicePrefix}-god-${userId}`,
    godServiceName: `${env.servicePrefix}-god@${userId}.service`,
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
