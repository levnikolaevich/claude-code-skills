import type { AgentKind } from "../domain/message.js";
import type { GodRuntimeAdapters, GodRuntimePathResolver, GodStatusPort } from "./ports.js";

export type GodRuntimeService = ReturnType<typeof createGodRuntimeService>;

export function createGodRuntimeService(deps: {
  runtimePaths: GodRuntimePathResolver;
  adapters: GodRuntimeAdapters;
  godStatus: GodStatusPort;
}) {
  function runtimeFor(userId: number, agent: AgentKind = "claude") {
    const paths = deps.runtimePaths.forUser(userId, agent);
    return {
      paths,
      pane: deps.adapters.pane(paths),
      atomicCmd: deps.adapters.atomicCommand(paths),
      lastSession: deps.adapters.lastSession(paths),
    };
  }

  async function ensureStarted(userId: number, agent: AgentKind = "claude"): Promise<void> {
    if (await deps.godStatus.isActive(userId, agent)) return;
    runtimeFor(userId, agent).atomicCmd.write("default", null, userId);
    await deps.godStatus.start(userId, agent);
  }

  return {
    runtimeFor,
    ensureStarted,
    async isActive(userId: number, agent: AgentKind = "claude"): Promise<boolean> {
      return deps.godStatus.isActive(userId, agent);
    },
    async restart(userId: number, agent: AgentKind = "claude"): Promise<void> {
      await deps.godStatus.restart(userId, agent);
    },
  };
}
