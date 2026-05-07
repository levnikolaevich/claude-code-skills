import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import Fastify from "fastify";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import pino from "pino";
import { z } from "zod/v4";
import { configureZodFastify } from "../src/handlers/http/zodFastify.js";
import { registerErrorHandler } from "../src/handlers/http/plugins/errorHandler.plugin.js";
import { registerBearerAuth } from "../src/handlers/http/plugins/auth.plugin.js";
import {
  registerHealthRoutes,
  type RuntimeStatusDeps,
} from "../src/handlers/http/health.routes.js";
import { registerDispatchRoutes } from "../src/handlers/http/dispatch.routes.js";
import { registerMemoryRoutes } from "../src/handlers/http/memory.routes.js";
import { registerTaskRoutes } from "../src/handlers/http/tasks.routes.js";
import { registerHookRoutes } from "../src/handlers/http/hooks.routes.js";
import {
  createHookIngestionService,
  type HookIngestionDeps,
} from "../src/services/hookIngestion.service.js";
import type { BuildInfo } from "../src/config/buildInfo.js";
import type { Logger } from "../src/lib/logger.js";
import { closeDb, createDb } from "../src/infrastructure/db/client.js";
import { createRepositories } from "../src/infrastructure/db/repositories/index.js";

const log = pino({ enabled: false }) as Logger;

function noop(): void {
  return;
}

function ok<T>(value: T) {
  return { ok: true as const, value };
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

function registerHooks(app: ReturnType<typeof createApp>, overrides: Record<string, unknown> = {}) {
  const hookIngestion = createHookIngestionService({
    log,
    messagesRepo: {
      findByTg: () => null,
      findById: () => null,
      getChatId: () => null,
      update: noop,
      insertOutboundAudit: () => 1,
    },
    pendingRepo: {
      get: () => null,
      getAllForSession: () => [],
      set: noop,
      clear: noop,
      listOthers: () => [],
    },
    outbox: {
      enqueueReply: () => ok(1),
      enqueueAck: () => ok(1),
      enqueueStatus: () => ok(1),
    },
    sessionService: {
      insertEvent: noop,
      ensureOwner: noop,
      recordStart: () => 1,
    },
    todoDiff: { diffAndPersist: () => [] },
    memory: { recent: () => [], markUsed: noop },
    dispatch: { recent: () => [] },
    verbosity: { allows: () => false },
    typing: { start: noop, stop: noop, stopAll: noop, activeCount: () => 0 },
    primaryOperator: 1,
    dbPath: "Z:/missing/relay.db",
    ...overrides,
  } as HookIngestionDeps);
  registerHookRoutes(app, { hookIngestion });
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

test("live ready and metrics are public operational endpoints", async () => {
  const app = createApp();
  registerBearerAuth(app, {
    token: "x".repeat(32),
    protectedPrefixes: ["/hook", "/tasks", "/dispatch", "/memory"],
  });
  registerHealthRoutes(app, runtimeDeps());

  const live = await app.inject({ method: "GET", url: "/live" });
  assert.equal(live.statusCode, 200);
  assert.deepEqual(live.json(), { ok: true });

  const ready = await app.inject({ method: "GET", url: "/ready" });
  assert.equal(ready.statusCode, 200);
  assert.deepEqual(ready.json(), { ok: true });

  const metrics = await app.inject({ method: "GET", url: "/metrics" });
  assert.equal(metrics.statusCode, 200);
  assert.match(metrics.body, /hex_relay_queue_depth\{queue="inbound"\} 3/);
  assert.match(metrics.body, /hex_relay_queue_depth\{queue="outbox"\} 2/);
  assert.match(metrics.body, /hex_relay_queue_depth\{queue="pending_replies"\} 5/);
  await app.close();
});

test("ready returns 503 when dependencies fail", async () => {
  const app = createApp();
  registerHealthRoutes(app, {
    ...runtimeDeps(),
    outboxRepo: {
      counts: () => {
        throw new Error("db closed");
      },
    },
  });

  const response = await app.inject({ method: "GET", url: "/ready" });
  assert.equal(response.statusCode, 503);
  assert.equal(response.json().error.code, "dependency_unavailable");
  await app.close();
});

test("protected HTTP routes require bearer token", async () => {
  const app = createApp();
  registerBearerAuth(app, {
    token: "super-secret-token-value-32-chars",
    protectedPrefixes: ["/hook", "/tasks", "/dispatch", "/memory"],
  });
  registerDispatchRoutes(app, {
    log,
    dispatch: {
      start: () => 1,
      phase: noop,
      end: noop,
      recent: () => [],
    },
  });
  registerHealthRoutes(app, runtimeDeps());

  const missing = await app.inject({ method: "GET", url: "/dispatch/recent" });
  assert.equal(missing.statusCode, 401);
  assert.equal(missing.json().error.code, "unauthorized");

  const wrong = await app.inject({
    method: "GET",
    url: "/dispatch/recent",
    headers: { authorization: "Bearer wrong" },
  });
  assert.equal(wrong.statusCode, 401);

  const health = await app.inject({ method: "GET", url: "/health" });
  assert.equal(health.statusCode, 200);

  const okResponse = await app.inject({
    method: "GET",
    url: "/dispatch/recent",
    headers: { authorization: "Bearer super-secret-token-value-32-chars" },
  });
  assert.equal(okResponse.statusCode, 200);
  assert.deepEqual(okResponse.json(), { runs: [] });
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
  assert.equal(bad.json().error.code, "request_validation_failed");
  const badStatus = await app.inject({
    method: "POST",
    url: "/dispatch/phase",
    payload: { run_id: 11, phase: "review", status: "surprised" },
  });
  assert.equal(badStatus.statusCode, 400);
  const ok = await app.inject({
    method: "POST",
    url: "/dispatch/phase",
    payload: { run_id: "11", phase: "review" },
  });
  assert.equal(ok.statusCode, 200);
  assert.equal(phaseRunId, 11);
  const recent = await app.inject({ method: "GET", url: "/dispatch/recent?n=1" });
  assert.equal(recent.json().runs[0].id, 7);
  const zero = await app.inject({ method: "GET", url: "/dispatch/recent?n=0" });
  assert.equal(zero.statusCode, 400);
  const tooMany = await app.inject({ method: "GET", url: "/dispatch/recent?n=101" });
  assert.equal(tooMany.statusCode, 400);
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
      fetchOpenTasks: async () => ok([]),
      pollAndNotifyPrimary: async () => ok({ count: 3, notified: false }),
      queueTaskForUser: async () => ({
        ok: false,
        error: {
          code: "task_not_found",
          kind: "not_found",
          message: "task not found",
          retryable: false,
        },
      }),
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
  const negativeRecent = await app.inject({ method: "GET", url: "/memory/recent?n=-1" });
  assert.equal(negativeRecent.statusCode, 400);
  const tooManyRecent = await app.inject({ method: "GET", url: "/memory/recent?n=101" });
  assert.equal(tooManyRecent.statusCode, 400);
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
  assert.deepEqual(response.json(), {
    ok: false,
    error: {
      code: "response_serialization_failed",
      message: "response serialization failed",
      retryable: false,
    },
  });
  await app.close();
});

test("Claude hook malformed payload returns typed validation error", async () => {
  const app = createApp();
  registerHooks(app);
  const response = await app.inject({
    method: "POST",
    url: "/hook/user-prompt-submit",
    payload: {},
  });
  assert.equal(response.statusCode, 400);
  assert.equal(response.json().error.code, "hook_payload_invalid");
  await app.close();
});

test("pending reply updates to the latest prompt for steering bursts", async () => {
  const dir = await mkdtemp(join(tmpdir(), "hex-relay-pending-"));
  const db = createDb({
    dbPath: join(dir, "relay.db"),
    log,
    primaryOperator: 1,
    sessionsDir: () => null,
  });
  try {
    const repos = createRepositories(db);
    repos.pendingReply.set("sid", 101, "first prompt");
    repos.pendingReply.set("sid", 102, "second prompt");

    assert.equal(repos.pendingReply.get("sid")?.inboundMsgId, 102);
  } finally {
    closeDb(db);
  }
});

test("stop hook fans out acks for orphan pending inbounds", async () => {
  const app = createApp();
  const replies: Record<string, unknown>[] = [];
  const acks: Record<string, unknown>[] = [];
  const inboundsById = new Map<
    number,
    { id: number; tgChatId: number; tgMsgId: number; fromUserId: number; agent: "claude" }
  >([
    [201, { id: 201, tgChatId: 999, tgMsgId: 1001, fromUserId: 5, agent: "claude" }],
    [202, { id: 202, tgChatId: 999, tgMsgId: 1002, fromUserId: 5, agent: "claude" }],
    [203, { id: 203, tgChatId: 999, tgMsgId: 1003, fromUserId: 5, agent: "claude" }],
  ]);
  const pending = [
    {
      sessionId: "sid-burst",
      inboundMsgId: 201,
      promptHash: "h1",
      createdAt: 1000,
      agent: "claude",
    },
    {
      sessionId: "sid-burst",
      inboundMsgId: 202,
      promptHash: "h2",
      createdAt: 1001,
      agent: "claude",
    },
    {
      sessionId: "sid-burst",
      inboundMsgId: 203,
      promptHash: "h3",
      createdAt: 1002,
      agent: "claude",
    },
  ];
  let cleared = 0;
  registerHooks(app, {
    messagesRepo: {
      findById: (id: number) => inboundsById.get(id) ?? null,
      findByTg: () => null,
      getChatId: (id: number) => inboundsById.get(id)?.tgChatId ?? null,
      update: noop,
      insertOutboundAudit: () => 777,
    },
    pendingRepo: {
      get: () => null,
      getAllForSession: (sid: string) => (sid === "sid-burst" ? pending : []),
      set: noop,
      clear: () => {
        cleared += 1;
      },
      listOthers: () => [],
    },
    outbox: {
      enqueueReply: (args: Record<string, unknown>) => {
        replies.push(args);
        return ok(91);
      },
      enqueueAck: (args: Record<string, unknown>) => {
        acks.push(args);
        return ok(92);
      },
      enqueueStatus: () => ok(1),
    },
  });

  const stopped = await app.inject({
    method: "POST",
    url: "/hook/stop",
    payload: { session_id: "sid-burst", last_assistant_message: "Готово, ответ один" },
  });
  assert.equal(stopped.statusCode, 200);
  assert.equal(replies.length, 1);
  assert.equal((replies[0] as { repliedToId: number }).repliedToId, 1003);
  assert.equal((replies[0] as { auditMsgId: number }).auditMsgId, 777);
  assert.equal(acks.length, 2);
  assert.equal((acks[0] as { repliedToId: number }).repliedToId, 1001);
  assert.equal((acks[1] as { repliedToId: number }).repliedToId, 1002);
  assert.ok((acks[0] as { text: string }).text.includes("merged"));
  assert.equal(cleared, 1);
  await app.close();
});

test("post-tool-use Skill emits duration suffix in verbose_bash", async () => {
  const app = createApp();
  const statuses: Record<string, unknown>[] = [];
  registerHooks(app, {
    pendingRepo: { get: () => null },
    outbox: {
      enqueueStatus: (args: Record<string, unknown>) => {
        statuses.push(args);
        return ok(1);
      },
    },
    verbosity: { allows: (layer: string) => layer === "verbose_bash" },
  });

  const subSecond = await app.inject({
    method: "POST",
    url: "/hook/post-tool-use",
    payload: {
      session_id: "sid-fast",
      tool_name: "Skill",
      tool_input: { skill: "ln-100-task-implementer" },
      duration_ms: 423,
    },
  });
  assert.equal(subSecond.statusCode, 200);
  assert.equal(statuses.length, 1);
  assert.match(String((statuses[0] as { text: string }).text), / done \(423 ms\)$/);

  const multiSecond = await app.inject({
    method: "POST",
    url: "/hook/post-tool-use",
    payload: {
      session_id: "sid-slow",
      tool_name: "Skill",
      tool_input: { skill: "ln-200-implementer" },
      duration_ms: 12_734,
    },
  });
  assert.equal(multiSecond.statusCode, 200);
  assert.equal(statuses.length, 2);
  assert.match(String((statuses[1] as { text: string }).text), / done \(13s\)$/);

  const fractional = await app.inject({
    method: "POST",
    url: "/hook/post-tool-use",
    payload: {
      session_id: "sid-mid",
      tool_name: "Skill",
      tool_input: { skill: "ln-300-validator" },
      duration_ms: 2456,
    },
  });
  assert.equal(fractional.statusCode, 200);
  assert.equal(statuses.length, 3);
  assert.match(String((statuses[2] as { text: string }).text), / done \(2\.5s\)$/);

  const noDuration = await app.inject({
    method: "POST",
    url: "/hook/post-tool-use",
    payload: {
      session_id: "sid-nd",
      tool_name: "Skill",
      tool_input: { skill: "ln-400-merger" },
    },
  });
  assert.equal(noDuration.statusCode, 200);
  assert.equal(statuses.length, 4);
  assert.match(String((statuses[3] as { text: string }).text), / done$/);

  await app.close();
});

test("post-tool-use stays silent below verbose verbosity", async () => {
  const app = createApp();
  const statuses: Record<string, unknown>[] = [];
  registerHooks(app, {
    pendingRepo: { get: () => null },
    outbox: {
      enqueueStatus: (args: Record<string, unknown>) => {
        statuses.push(args);
        return ok(1);
      },
    },
    verbosity: { allows: () => false },
  });

  const response = await app.inject({
    method: "POST",
    url: "/hook/post-tool-use",
    payload: {
      session_id: "sid-quiet",
      tool_name: "Skill",
      tool_input: { skill: "ln-100-task-implementer" },
      duration_ms: 999,
    },
  });
  assert.equal(response.statusCode, 200);
  assert.equal(statuses.length, 0);

  await app.close();
});

test("post-tool-use ignores non-Skill tools even with verbose_bash and duration_ms", async () => {
  const app = createApp();
  const statuses: Record<string, unknown>[] = [];
  registerHooks(app, {
    pendingRepo: { get: () => null },
    outbox: {
      enqueueStatus: (args: Record<string, unknown>) => {
        statuses.push(args);
        return ok(1);
      },
    },
    verbosity: { allows: () => true },
  });

  for (const tool_name of ["Bash", "TodoWrite", "Agent", "Read", "Edit"]) {
    const response = await app.inject({
      method: "POST",
      url: "/hook/post-tool-use",
      payload: {
        session_id: "sid-bash",
        tool_name,
        tool_input: {},
        duration_ms: 12_345,
      },
    });
    assert.equal(response.statusCode, 200);
  }
  assert.equal(statuses.length, 0, "only Skill emits a duration suffix; other tools stay silent");
  await app.close();
});
