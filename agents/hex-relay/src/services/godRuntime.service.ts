import type { Env } from "../config/env.js";
import { buildUserRuntimePaths } from "../config/paths.js";
import type { Logger } from "../lib/logger.js";
import { createTmuxPane } from "../infrastructure/tmux/pane.js";
import { createAtomicCommandWriter } from "../infrastructure/filesystem/atomicCommand.js";
import { createLastSessionWriter } from "../infrastructure/filesystem/lastSession.js";
import type { GodStatusProbe } from "../infrastructure/systemd/godStatus.js";

export type GodRuntimeService = ReturnType<typeof createGodRuntimeService>;

export function createGodRuntimeService(deps: {
  env: Env;
  log: Logger;
  godStatus: GodStatusProbe;
}) {
  function runtimeFor(userId: number) {
    const paths = buildUserRuntimePaths(deps.env, userId);
    return {
      paths,
      pane: createTmuxPane({
        target: paths.tmuxTarget,
        socketName: deps.env.tmuxSocketName,
        log: deps.log,
      }),
      atomicCmd: createAtomicCommandWriter({
        cmdFile: paths.cmdFile,
        stateDir: paths.userStateDir,
        log: deps.log,
      }),
      lastSession: createLastSessionWriter({
        filePath: paths.lastSessionFile,
        log: deps.log,
      }),
    };
  }

  async function ensureStarted(userId: number): Promise<void> {
    if (await deps.godStatus.isActive(userId)) return;
    runtimeFor(userId).atomicCmd.write("default", null, userId);
    await deps.godStatus.start(userId);
  }

  return {
    runtimeFor,
    ensureStarted,
    async isActive(userId: number): Promise<boolean> {
      return deps.godStatus.isActive(userId);
    },
    async restart(userId: number): Promise<void> {
      await deps.godStatus.restart(userId);
    },
  };
}
