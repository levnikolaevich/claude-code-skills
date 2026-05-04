import { createSign } from "node:crypto";
import { readFileSync } from "node:fs";
import type { Env } from "../config/env.js";
import type { ProviderTask } from "../domain/task.js";
import type { Logger } from "../lib/logger.js";

export type TaskProviderService = ReturnType<typeof createTaskProviderService>;

const API_VERSION = "2022-11-28";

function b64url(input: string | Buffer): string {
  return Buffer.from(input)
    .toString("base64")
    .replaceAll("=", "")
    .replaceAll("+", "-")
    .replaceAll("/", "_");
}

function githubJwt(appId: string, privateKeyPath: string): string {
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const payload = b64url(JSON.stringify({ iat: now - 60, exp: now + 540, iss: appId }));
  const data = `${header}.${payload}`;
  const key = readFileSync(privateKeyPath, "utf8");
  const signature = createSign("RSA-SHA256").update(data).sign(key);
  return `${data}.${b64url(signature)}`;
}

async function fetchJson<T>(url: string, init: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`provider HTTP ${res.status}: ${body.slice(0, 200)}`);
  }
  return (await res.json()) as T;
}

interface GitHubIssue {
  number: number;
  title: string;
  html_url: string;
  labels: ({ name?: string } | string)[];
  created_at: string;
  body?: string | null;
  pull_request?: unknown;
}

interface GitLabIssue {
  iid: number;
  title: string;
  web_url: string;
  labels?: string[];
  created_at: string;
  description?: string | null;
}

function labelNames(raw: ({ name?: string } | string)[] | undefined): string[] {
  return (raw ?? [])
    .map((l) => (typeof l === "string" ? l : (l.name ?? "")))
    .filter((l) => l.length > 0);
}

function priorityRank(task: ProviderTask): number {
  const labels = new Set(task.labels.map((l) => l.toLowerCase()));
  if (labels.has("priority:p1")) return 0;
  if (labels.has("priority:p2")) return 1;
  if (labels.has("priority:p3")) return 2;
  return 3;
}

function sortTasks(tasks: ProviderTask[]): ProviderTask[] {
  return [...tasks].sort((a, b) => {
    const pa = priorityRank(a);
    const pb = priorityRank(b);
    if (pa !== pb) return pa - pb;
    return Date.parse(a.createdAt) - Date.parse(b.createdAt);
  });
}

export function createTaskProviderService(deps: { env: Env; log: Logger }) {
  async function githubToken(): Promise<string> {
    const { githubAppId, githubInstallationId, githubAppPrivateKeyPath } = deps.env;
    if (!githubAppId || !githubInstallationId || !githubAppPrivateKeyPath) {
      throw new Error("GitHub App credentials are not configured");
    }
    const jwt = githubJwt(githubAppId, githubAppPrivateKeyPath);
    const data = await fetchJson<{ token: string }>(
      `https://api.github.com/app/installations/${githubInstallationId}/access_tokens`,
      {
        method: "POST",
        headers: {
          Accept: "application/vnd.github+json",
          Authorization: `Bearer ${jwt}`,
          "X-GitHub-Api-Version": API_VERSION,
          "User-Agent": "ln-030-relay-bot",
        },
      }
    );
    return data.token;
  }

  async function listGithubTasks(): Promise<ProviderTask[]> {
    if (!deps.env.repoSlug) throw new Error("REPO_SLUG is not configured");
    const token = await githubToken();
    const issues = await fetchJson<GitHubIssue[]>(
      `https://api.github.com/repos/${deps.env.repoSlug}/issues?state=open&per_page=100`,
      {
        headers: {
          Accept: "application/vnd.github+json",
          Authorization: `Bearer ${token}`,
          "X-GitHub-Api-Version": API_VERSION,
          "User-Agent": "ln-030-relay-bot",
        },
      }
    );
    return sortTasks(
      issues
        .filter((i) => i.pull_request === undefined)
        .map((i) => ({
          id: i.number,
          title: i.title,
          url: i.html_url,
          labels: labelNames(i.labels),
          createdAt: i.created_at,
          body: i.body ?? "",
        }))
    );
  }

  async function listGitlabTasks(): Promise<ProviderTask[]> {
    if (!deps.env.repoSlug) throw new Error("REPO_SLUG is not configured");
    if (!deps.env.gitlabHost) throw new Error("GITLAB_HOST is not configured");
    if (!deps.env.gitlabApiToken) throw new Error("GITLAB_API_TOKEN is not configured");
    const project = encodeURIComponent(deps.env.repoSlug);
    const issues = await fetchJson<GitLabIssue[]>(
      `https://${deps.env.gitlabHost}/api/v4/projects/${project}/issues?state=opened&per_page=100`,
      {
        headers: {
          "PRIVATE-TOKEN": deps.env.gitlabApiToken,
          "User-Agent": "ln-030-relay-bot",
        },
      }
    );
    return sortTasks(
      issues.map((i) => ({
        id: i.iid,
        title: i.title,
        url: i.web_url,
        labels: i.labels ?? [],
        createdAt: i.created_at,
        body: i.description ?? "",
      }))
    );
  }

  return {
    async listOpenTasks(): Promise<ProviderTask[]> {
      const tasks =
        deps.env.gitProvider === "github" ? await listGithubTasks() : await listGitlabTasks();
      deps.log.info({ count: tasks.length, provider: deps.env.gitProvider }, "TASKS provider list");
      return tasks;
    },
  };
}
