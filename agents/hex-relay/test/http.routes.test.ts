import { test } from "node:test";
import assert from "node:assert/strict";
import Fastify from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import pino from "pino";
import { z } from "zod/v4";
import { configureZodFastify } from "../src/handlers/http/zodFastify.js";
import { registerErrorHandler } from "../src/handlers/http/plugins/errorHandler.plugin.js";
import {
  registerHealthRoutes,
  type RuntimeStatusDeps,
} from "../src/handlers/http/health.routes.js";
import { registerDispatchRoutes } from "../src/handlers/http/dispatch.routes.js";
import { registerMemoryRoutes } from "../src/handlers/http/memory.routes.js";
import { registerTaskRoutes } from "../src/handlers/http/tasks.routes.js";
import { registerHookRoutes } from "../src/handlers/http/hooks.routes.js";
import type { BuildInfo } from "../src/config/buildInfo.js";
import type { Logger } from "../src/lib/logger.js";

const log = pino({ enabled: false }) as Logger;

function noop(): void {
  return;
}

async function asyncNoop(): Promise<void> {
  return;
}

function createApp() {
  const app = Fastify({ logger: false });
  configureZodFastify(app);
  registerErrorHandler(app, log);
  return app;
}

function runtimeDeps(): RuntimeStatusDeps & BuildInfo {
  return {
    outboxRepo: {
      counts: () => ({ queued: 2, abandoned: 1, unknown: 0 }),
    },
    messagesRepo: {
      counts: () => ({ inboundQueued: 3, inboundFailed: 1, inboundRejected: 4 }),
    },
    pendingRepo: {
      countActive: () => 5,
    },
    sessionsRepo: {
      lastActiveSid: () => "1234567890abcdef",
    },
    controlLane: {
      run: async (_action, op) => op(),
      state: () => ({ busy: true, pending: 2, current: "restart", lastAction: "restart" }),
    },
    godStatus: {
      isActive: async () => true,
      start: asyncNoop,
      restart: asyncNoop,
      isAnyActive: async () => true,
    },
    dbPath: "Z:/missing/relay.db",
    relaySchemaVersion: "v6.3",
    packageVersion: "1.0.0-test",
  } as RuntimeStatusDeps & BuildInfo;
}

test("health returns compatible fields plus explicit versions", async () => {
  const app = createApp();
  registerHealthRoutes(app, runtimeDeps());
  const response = await app.inject({ method: "GET", url: "/health" });
  assert.equal(response.statusCode, 200);
  const body = response.json();
  assert.equal(body.version, "v6.3");
  assert.equal(body.relay_schema_version, "v6.3");
  assert.equal(body.package_version, "1.0.0-test");
  assert.equal(body.god_session_ready, true);
  assert.equal(body.active_session_short, "12345678");
  await app.close();
});

test("dispatch routes use Fastify schema validation", async () => {
  const app = createApp();
  let phaseRunId = 0;
  registerDispatchRoutes(app, {
    log,
    dispatch: {
      start: () => 42,
      phase: (args) => {
        phaseRunId = args.runId;
      },
      end: noop,
      recent: () => [
        {
          id: 7,
          tsStarted: 1,
          tsFinished: null,
          trigger: "manual",
          sessionId: null,
          issueNumber: null,
          issueTitle: null,
          status: "running",
          budget5hPct: null,
          budgetWeekPct: null,
          prNumber: null,
          prUrl: null,
          branch: null,
          error: null,
          phases: [],
        },
      ],
    },
  });
  const bad = await app.inject({ method: "POST", url: "/dispatch/phase", payload: { phase: "x" } });
  assert.equal(bad.statusCode, 400);
  assert.equal(bad.json().error, "validation");
  const ok = await app.inject({
    method: "POST",
    url: "/dispatch/phase",
    payload: { run_id: "11", phase: "review" },
  });
  assert.equal(ok.statusCode, 200);
  assert.equal(phaseRunId, 11);
  const recent = await app.inject({ method: "GET", url: "/dispatch/recent?n=1" });
  assert.equal(recent.json().runs[0].id, 7);
  await app.close();
});

test("memory and task routes validate and serialize stable contracts", async () => {
  const app = createApp();
  registerMemoryRoutes(app, {
    log,
    memory: {
      add: () => 9,
      recent: () => [
        {
          id: 1,
          tsCreated: 10,
          tsUsed: null,
          category: "decision",
          text: "keep hooks compatible",
          tags: null,
          source: null,
          expiresAt: null,
        },
      ],
      forget: () => 1,
      markUsed: noop,
    },
  });
  registerTaskRoutes(app, {
    log,
    tasks: {
      listOpenTasks: async () => [],
      pollAndNotifyPrimary: async () => ({ count: 3 }),
      queueTaskForUser: async () => null,
    },
  });
  const bad = await app.inject({ method: "POST", url: "/memory/add", payload: { category: "x" } });
  assert.equal(bad.statusCode, 400);
  const added = await app.inject({
    method: "POST",
    url: "/memory/add",
    payload: { category: "decision", text: "ship it" },
  });
  assert.deepEqual(added.json(), { memory_id: 9 });
  const recent = await app.inject({ method: "GET", url: "/memory/recent" });
  assert.equal(recent.json().memories[0].text, "keep hooks compatible");
  const tasks = await app.inject({ method: "POST", url: "/tasks/poll" });
  assert.deepEqual(tasks.json(), { ok: true, count: 3 });
  await app.close();
});

test("response serialization errors return internal error", async () => {
  const app = createApp().withTypeProvider<ZodTypeProvider>();
  app.route({
    method: "GET",
    url: "/bad-response",
    schema: {
      response: {
        200: z.object({ ok: z.boolean() }),
      },
    },
    handler: () => ({ ok: "not boolean" }) as unknown as { ok: boolean },
  });

  const response = await app.inject({ method: "GET", url: "/bad-response" });
  assert.equal(response.statusCode, 500);
  assert.deepEqual(response.json(), { error: "internal" });
  await app.close();
});

test("Claude hook malformed payload compatibility stays 200 empty object", async () => {
  const app = createApp();
  registerHookRoutes(app, {
    log,
    messagesRepo: {},
    pendingRepo: {},
    sessionsRepo: {},
    outbox: {},
    sessionService: {},
    todoDiff: {},
    memory: {},
    dispatch: {},
    verbosity: {},
    primaryOperator: 1,
    dbPath: "Z:/missing/relay.db",
  } as Parameters<typeof registerHookRoutes>[1]);
  const response = await app.inject({
    method: "POST",
    url: "/hook/user-prompt-submit",
    payload: {},
  });
  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.json(), {});
  await app.close();
});
