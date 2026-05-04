import { z } from "zod/v4";

const RawEnvSchema = z.object({
  TELEGRAM_BOT_TOKEN: z.string().min(1, "TELEGRAM_BOT_TOKEN required"),
  TELEGRAM_CHAT_ID: z.coerce.number().int(),
  PROJECT_NAME: z.string().min(1, "PROJECT_NAME required"),
  PROJECT_DIR: z.string().min(1, "PROJECT_DIR required"),
  SERVICE_PREFIX: z.string().min(1, "SERVICE_PREFIX required"),
  BOT_USER: z.string().min(1, "BOT_USER required"),
  RELAY_HOOK_PORT: z.coerce.number().int().min(1).max(65_535),
  RELAY_VERBOSITY: z.enum(["quiet", "normal", "verbose"]).default("normal"),
  RELAY_INBOUND_REACTIONS: z.string().optional(),
  GIT_PROVIDER: z.enum(["github", "gitlab"]).default("github"),
  REPO_SLUG: z.string().optional(),
  GITHUB_APP_ID: z.string().optional(),
  GITHUB_INSTALLATION_ID: z.string().optional(),
  GITHUB_APP_PRIVATE_KEY_PATH: z.string().optional(),
  GITLAB_HOST: z.string().optional(),
  GITLAB_API_TOKEN: z.string().optional(),
});

export interface Env {
  tgToken: string;
  allowedChat: number;
  projectName: string;
  projectDir: string;
  servicePrefix: string;
  botUser: string;
  tmuxSocketName: string;
  dbPath: string;
  hookHost: string;
  hookPort: number;
  verbosity: "quiet" | "normal" | "verbose";
  inboundReactions: string[];
  gitProvider: "github" | "gitlab";
  repoSlug: string | null;
  githubAppId: string | null;
  githubInstallationId: string | null;
  githubAppPrivateKeyPath: string | null;
  gitlabHost: string | null;
  gitlabApiToken: string | null;
}

const DEFAULT_REACTIONS = "👀,👍,✅,🫡,🤝,✍,🆒,👌,🙏";

function parseReactions(raw: string | undefined): string[] {
  const src = raw && raw.trim().length > 0 ? raw : DEFAULT_REACTIONS;
  const parts = src
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  return parts.length > 0 ? parts : ["👀"];
}

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const parsed = RawEnvSchema.safeParse(source);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
    throw new Error(`invalid environment: ${issues}`);
  }
  const v = parsed.data;
  const servicePrefix = v.SERVICE_PREFIX;
  const botUser = v.BOT_USER;
  const projectName = v.PROJECT_NAME;
  return {
    tgToken: v.TELEGRAM_BOT_TOKEN,
    allowedChat: v.TELEGRAM_CHAT_ID,
    projectName,
    projectDir: v.PROJECT_DIR,
    servicePrefix,
    botUser,
    tmuxSocketName: servicePrefix,
    dbPath: `/var/lib/${projectName}/relay.db`,
    hookHost: "127.0.0.1",
    hookPort: v.RELAY_HOOK_PORT,
    verbosity: v.RELAY_VERBOSITY,
    inboundReactions: parseReactions(v.RELAY_INBOUND_REACTIONS),
    gitProvider: v.GIT_PROVIDER,
    repoSlug: v.REPO_SLUG && v.REPO_SLUG.trim().length > 0 ? v.REPO_SLUG.trim() : null,
    githubAppId:
      v.GITHUB_APP_ID && v.GITHUB_APP_ID.trim().length > 0 ? v.GITHUB_APP_ID.trim() : null,
    githubInstallationId:
      v.GITHUB_INSTALLATION_ID && v.GITHUB_INSTALLATION_ID.trim().length > 0
        ? v.GITHUB_INSTALLATION_ID.trim()
        : null,
    githubAppPrivateKeyPath:
      v.GITHUB_APP_PRIVATE_KEY_PATH && v.GITHUB_APP_PRIVATE_KEY_PATH.trim().length > 0
        ? v.GITHUB_APP_PRIVATE_KEY_PATH.trim()
        : null,
    gitlabHost: v.GITLAB_HOST && v.GITLAB_HOST.trim().length > 0 ? v.GITLAB_HOST.trim() : null,
    gitlabApiToken:
      v.GITLAB_API_TOKEN && v.GITLAB_API_TOKEN.trim().length > 0 ? v.GITLAB_API_TOKEN.trim() : null,
  };
}
