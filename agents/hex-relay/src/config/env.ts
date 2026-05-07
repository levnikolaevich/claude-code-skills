import { z } from "zod/v4";

const UnitFragmentSchema = z
  .string()
  .min(1)
  .regex(/^[A-Za-z0-9_.-]+$/, "must contain only letters, digits, dot, underscore, or dash");
const LinuxUserSchema = z
  .string()
  .min(1)
  .regex(/^[a-z_][a-z0-9_-]*$/, "must be a safe Linux user name");
const AbsolutePosixPathSchema = z.string().min(1).regex(/^\/.+/, "must be an absolute POSIX path");
const OptionalNoWhitespaceSchema = z
  .string()
  .optional()
  .refine((v) => !v || !/\s/.test(v), "must not contain whitespace");
const OptionalHostnameSchema = z
  .string()
  .optional()
  .refine(
    (v) => !v || (!/^https?:\/\//i.test(v) && !v.includes("/")),
    "must be a hostname, without scheme or path"
  );
const OptionalCommandSchema = z
  .string()
  .optional()
  .refine((v) => !v || v.trim().length > 0);

const RawEnvSchema = z.object({
  TELEGRAM_BOT_TOKEN: z.string().min(1, "TELEGRAM_BOT_TOKEN required"),
  TELEGRAM_CHAT_ID: z.coerce.number().int(),
  PROJECT_NAME: UnitFragmentSchema,
  PROJECT_DIR: AbsolutePosixPathSchema,
  SERVICE_PREFIX: UnitFragmentSchema,
  BOT_USER: LinuxUserSchema,
  RELAY_HOOK_PORT: z.coerce.number().int().min(1).max(65_535),
  RELAY_HTTP_TOKEN: z.string().min(32, "RELAY_HTTP_TOKEN must be at least 32 characters"),
  RELAY_VERBOSITY: z.enum(["quiet", "normal", "verbose"]).default("normal"),
  RELAY_INBOUND_REACTIONS: z.string().optional(),
  RELAY_VOICE_TRANSCRIPTION: z.enum(["off", "local"]).default("off"),
  FFMPEG_BIN: OptionalCommandSchema,
  WHISPER_CPP_BIN: OptionalCommandSchema,
  WHISPER_CPP_MODEL: OptionalCommandSchema,
  RELAY_VOICE_MAX_DURATION_SEC: z.coerce.number().int().min(1).max(3600).default(90),
  RELAY_VOICE_TRANSCRIBE_TIMEOUT_SEC: z.coerce.number().int().min(1).max(3600).default(120),
  GIT_PROVIDER: z.enum(["github", "gitlab"]).default("github"),
  REPO_SLUG: OptionalNoWhitespaceSchema,
  GITHUB_APP_ID: OptionalNoWhitespaceSchema,
  GITHUB_INSTALLATION_ID: OptionalNoWhitespaceSchema,
  GITHUB_APP_PRIVATE_KEY_PATH: AbsolutePosixPathSchema.optional(),
  GITLAB_HOST: OptionalHostnameSchema,
  GITLAB_API_TOKEN: OptionalNoWhitespaceSchema,
  RELAY_IDLE_SHUTDOWN_ENABLED: z
    .enum(["true", "false"])
    .default("true")
    .transform((v) => v === "true"),
  RELAY_IDLE_SHUTDOWN_SEC: z.coerce.number().int().min(60).max(86_400).default(600),
  RELAY_IDLE_TICK_SEC: z.coerce.number().int().min(15).max(3600).default(60),
  RELAY_IDLE_BOOT_GRACE_SEC: z.coerce.number().int().min(0).max(3600).default(120),
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
  httpToken: string;
  verbosity: "quiet" | "normal" | "verbose";
  inboundReactions: string[];
  voiceTranscription: "off" | "local";
  ffmpegBin: string;
  whisperCppBin: string;
  whisperCppModel: string;
  voiceMaxDurationSec: number;
  voiceTranscribeTimeoutSec: number;
  gitProvider: "github" | "gitlab";
  repoSlug: string | null;
  githubAppId: string | null;
  githubInstallationId: string | null;
  githubAppPrivateKeyPath: string | null;
  gitlabHost: string | null;
  gitlabApiToken: string | null;
  idleShutdownEnabled: boolean;
  idleShutdownSec: number;
  idleTickSec: number;
  idleBootGraceSec: number;
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

function withDefault(raw: string | undefined, fallback: string): string {
  const trimmed = raw?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : fallback;
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
    httpToken: v.RELAY_HTTP_TOKEN,
    verbosity: v.RELAY_VERBOSITY,
    inboundReactions: parseReactions(v.RELAY_INBOUND_REACTIONS),
    voiceTranscription: v.RELAY_VOICE_TRANSCRIPTION,
    ffmpegBin: withDefault(v.FFMPEG_BIN, "ffmpeg"),
    whisperCppBin: withDefault(v.WHISPER_CPP_BIN, "/opt/whisper.cpp/build/bin/whisper-cli"),
    whisperCppModel: withDefault(
      v.WHISPER_CPP_MODEL,
      "/opt/whisper.cpp/models/ggml-small-q5_1.bin"
    ),
    voiceMaxDurationSec: v.RELAY_VOICE_MAX_DURATION_SEC,
    voiceTranscribeTimeoutSec: v.RELAY_VOICE_TRANSCRIBE_TIMEOUT_SEC,
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
    idleShutdownEnabled: v.RELAY_IDLE_SHUTDOWN_ENABLED,
    idleShutdownSec: v.RELAY_IDLE_SHUTDOWN_SEC,
    idleTickSec: v.RELAY_IDLE_TICK_SEC,
    idleBootGraceSec: v.RELAY_IDLE_BOOT_GRACE_SEC,
  };
}
