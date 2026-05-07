import { test } from "node:test";
import assert from "node:assert/strict";
import { createGodRuntimeService } from "../src/services/godRuntime.service.js";
import type { AgentKind } from "../src/domain/message.js";

function noop(): void {
  void 0;
}

async function asyncNoop(): Promise<void> {
  noop();
}

test("god runtime uses injected path resolver and adapters", () => {
  const resolved: { userId: number; agent: AgentKind }[] = [];
  const service = createGodRuntimeService({
    runtimePaths: {
      forUser: (userId, agent) => {
        resolved.push({ userId, agent });
        return {
          tmuxTarget: `target-${agent}-${userId}`,
          cmdFile: `/state/${userId}/cmd.json`,
          userStateDir: `/state/${userId}`,
          lastSessionFile: `/state/${userId}/last-${agent}.id`,
        };
      },
    },
    adapters: {
      pane: (paths) => ({
        send: asyncNoop,
        killGracefully: asyncNoop,
        hasSession: async () => paths.tmuxTarget.length > 0,
      }),
      atomicCommand: (paths) => ({
        write: (mode, sessionId, operatorUserId) => {
          assert.equal(paths.cmdFile, "/state/42/cmd.json");
          assert.equal(mode, "resume");
          assert.equal(sessionId, "sid");
          assert.equal(operatorUserId, 42);
        },
      }),
      lastSession: (paths) => ({
        write: (sid) => {
          assert.equal(paths.lastSessionFile, "/state/42/last-codex.id");
          assert.equal(sid, "sid");
        },
      }),
    },
    godStatus: {
      isActive: async () => false,
      start: asyncNoop,
      restart: asyncNoop,
      stop: asyncNoop,
      isAnyActive: async () => false,
      listActiveInstances: async () => [],
    },
  });

  const runtime = service.runtimeFor(42, "codex");
  assert.equal(runtime.ok, true);
  if (!runtime.ok) throw new Error(runtime.error.message);
  runtime.value.atomicCmd.write("resume", "sid", 42);
  runtime.value.lastSession.write("sid");

  assert.deepEqual(resolved, [{ userId: 42, agent: "codex" }]);
});

test("ensureStarted writes default command only when runtime is inactive", async () => {
  const writes: unknown[] = [];
  const starts: unknown[] = [];
  let active = true;
  const service = createGodRuntimeService({
    runtimePaths: {
      forUser: (userId, agent) => ({
        tmuxTarget: `target-${agent}-${userId}`,
        cmdFile: `/state/${userId}/cmd.json`,
        userStateDir: `/state/${userId}`,
        lastSessionFile: `/state/${userId}/last.id`,
      }),
    },
    adapters: {
      pane: () => ({
        send: asyncNoop,
        killGracefully: asyncNoop,
        hasSession: async () => true,
      }),
      atomicCommand: () => ({
        write: (...args) => writes.push(args),
      }),
      lastSession: () => ({
        write: noop,
      }),
    },
    godStatus: {
      isActive: async () => active,
      start: async (...args) => {
        starts.push(args);
      },
      restart: asyncNoop,
      stop: asyncNoop,
      isAnyActive: async () => false,
      listActiveInstances: async () => [],
    },
  });

  const activeOutcome = await service.ensureStarted(42, "claude");
  assert.equal(activeOutcome.ok, true);
  active = false;
  const startedOutcome = await service.ensureStarted(42, "claude");
  assert.equal(startedOutcome.ok, true);

  assert.deepEqual(writes, [["default", null, 42]]);
  assert.deepEqual(starts, [[42, "claude"]]);
});
