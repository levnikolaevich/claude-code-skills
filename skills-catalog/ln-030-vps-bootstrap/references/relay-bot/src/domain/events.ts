/**
 * Pure formatters for status events. No I/O. md_safe / truncate live here so
 * services can compose lines without touching infra.
 */

export function mdSafe(text: string): string {
  return "`" + text.replaceAll("`", "′") + "`";
}

export function truncate(text: string, maxLen: number): string {
  return text.length > maxLen ? `${text.slice(0, maxLen)}…` : text;
}

export interface SkillToolInput {
  skill?: unknown;
  name?: unknown;
  agent_type?: unknown;
}

export function formatSkillEvent(
  toolInput: unknown,
  skillNameMaxLen: number,
  prefix = "🔧"
): string | null {
  if (!toolInput || typeof toolInput !== "object") return null;
  const o = toolInput as SkillToolInput;
  const raw = o.skill ?? o.name ?? o.agent_type;
  if (typeof raw !== "string" || raw.trim().length === 0) return null;
  return `${prefix} Skill: ${mdSafe(truncate(raw, skillNameMaxLen))}`;
}

export interface AgentToolInput {
  subagent_type?: unknown;
  agent_type?: unknown;
  description?: unknown;
}

export function formatAgentEvent(toolInput: unknown): string | null {
  if (!toolInput || typeof toolInput !== "object") return null;
  const o = toolInput as AgentToolInput;
  const sub =
    typeof o.subagent_type === "string" && o.subagent_type
      ? o.subagent_type
      : typeof o.agent_type === "string" && o.agent_type
        ? o.agent_type
        : "subagent";
  const desc = typeof o.description === "string" ? o.description : "";
  let label = `🤖 Subagent: ${mdSafe(truncate(sub, 30))}`;
  if (desc.length > 0) label += ` — ${truncate(desc, 60)}`;
  return label;
}

/**
 * Decorate a final assistant reply for L5 outbox. Idempotent: leaves an
 * already-prefixed message intact.
 */
export function prefixReply(text: string): string {
  return text.startsWith("💬") ? text : `💬 ${text}`;
}
