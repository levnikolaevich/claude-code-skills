import { z } from "zod/v4";

const RawEnvSchema = z.object({
  TELEGRAM_BOT_TOKEN: z.string().min(1, "TELEGRAM_BOT_TOKEN required"),
  TELEGRAM_CHAT_ID: z.coerce.number().int(),
  PROJECT_NAME: z.string().min(1, "PROJECT_NAME required"),
  PROJECT_DIR: z.string().min(1, "PROJECT_DIR required"),
  SERVICE_PREFIX: z.string().min(1, "SERVICE_PREFIX required"),
  BOT_USER: z.string().min(1, "BOT_USER required"),
  TMUX_TARGET: z.string().optional(),
  TMUX_USER: z.string().optional(),
  RELAY_DB_PATH: z.string().optional(),
  RELAY_HOOK_HOST: z.string().default("127.0.0.1"),
  RELAY_HOOK_PORT: z.coerce.number().int().min(1).max(65_535).default(9999),
  RELAY_VERBOSITY: z.enum(["quiet", "normal", "verbose"]).default("normal"),
  RELAY_INBOUND_REACTIONS: z.string().optional(),
});

export interface Env {
  tgToken: string;
  allowedChat: number;
  projectName: string;
  projectDir: string;
  servicePrefix: string;
  botUser: string;
  tmuxTarget: string;
  tmuxUser: string;
  dbPath: string;
  hookHost: string;
  hookPort: number;
  verbosity: "quiet" | "normal" | "verbose";
  inboundReactions: string[];
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
  return {
    tgToken: v.TELEGRAM_BOT_TOKEN,
    allowedChat: v.TELEGRAM_CHAT_ID,
    projectName: v.PROJECT_NAME,
    projectDir: v.PROJECT_DIR,
    servicePrefix,
    botUser,
    tmuxTarget: v.TMUX_TARGET ?? `${servicePrefix}-god`,
    tmuxUser: v.TMUX_USER ?? botUser,
    dbPath: v.RELAY_DB_PATH ?? `/var/lib/${v.PROJECT_NAME}/relay.db`,
    hookHost: v.RELAY_HOOK_HOST,
    hookPort: v.RELAY_HOOK_PORT,
    verbosity: v.RELAY_VERBOSITY,
    inboundReactions: parseReactions(v.RELAY_INBOUND_REACTIONS),
  };
}
