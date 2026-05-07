import type { AgentKind } from "../domain/message.js";
import type {
  AtomicCommandWriterPort,
  GodRuntimeAdapters,
  GodRuntimePathResolver,
  GodRuntimePaths,
  GodStatusPort,
  LastSessionWriterPort,
  TmuxPanePort,
} from "./ports.js";
import {
  fail,
  ok,
  okVoid,
  serviceError,
  type ServiceError,
  type ServiceOutcome,
} from "./outcome.js";

export type GodRuntimeService = ReturnType<typeof createGodRuntimeService>;
export type GodRuntimeError = ServiceError;

export interface GodRuntimeHandle {
  paths: GodRuntimePaths;
  pane: TmuxPanePort;
  atomicCmd: AtomicCommandWriterPort;
  lastSession: LastSessionWriterPort;
}

export function createGodRuntimeService(deps: {
  runtimePaths: GodRuntimePathResolver;
  adapters: GodRuntimeAdapters;
  godStatus: GodStatusPort;
}) {
  function runtimeFor(
    userId: number,
    agent: AgentKind = "claude"
  ): ServiceOutcome<GodRuntimeHandle, GodRuntimeError> {
    try {
      const paths = deps.runtimePaths.forUser(userId, agent);
      return ok({
        paths,
        pane: deps.adapters.pane(paths),
        atomicCmd: deps.adapters.atomicCommand(paths),
        lastSession: deps.adapters.lastSession(paths),
      });
    } catch (error) {
      return fail(
        serviceError({
          code: "god_runtime_path_failed",
          kind: "invariant",
          message: "failed to resolve god runtime paths",
          details: { userId, agent },
          cause: error,
        })
      );
    }
  }

  async function ensureStarted(
    userId: number,
    agent: AgentKind = "claude"
  ): Promise<ServiceOutcome<void, GodRuntimeError>> {
    const active = await isActive(userId, agent);
    if (!active.ok) return active;
    if (active.value) return okVoid();
    const runtime = runtimeFor(userId, agent);
    if (!runtime.ok) return runtime;
    try {
      runtime.value.atomicCmd.write("default", null, userId);
      await deps.godStatus.start(userId, agent);
      return okVoid();
    } catch (error) {
      return fail(
        serviceError({
          code: "god_runtime_start_failed",
          kind: "transient",
          message: "failed to start god runtime",
          details: { userId, agent },
          cause: error,
        })
      );
    }
  }

  async function isActive(
    userId: number,
    agent: AgentKind = "claude"
  ): Promise<ServiceOutcome<boolean, GodRuntimeError>> {
    try {
      return ok(await deps.godStatus.isActive(userId, agent));
    } catch (error) {
      return fail(
        serviceError({
          code: "god_runtime_status_failed",
          kind: "transient",
          message: "failed to query god runtime status",
          details: { userId, agent },
          cause: error,
        })
      );
    }
  }

  async function restart(
    userId: number,
    agent: AgentKind = "claude"
  ): Promise<ServiceOutcome<void, GodRuntimeError>> {
    try {
      await deps.godStatus.restart(userId, agent);
      return okVoid();
    } catch (error) {
      return fail(
        serviceError({
          code: "god_runtime_restart_failed",
          kind: "transient",
          message: "failed to restart god runtime",
          details: { userId, agent },
          cause: error,
        })
      );
    }
  }

  return {
    runtimeFor,
    ensureStarted,
    isActive,
    restart,
  };
}
