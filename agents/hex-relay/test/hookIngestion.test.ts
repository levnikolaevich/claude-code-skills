import { test } from "node:test";
import assert from "node:assert/strict";
import pino from "pino";
import { createHookIngestionService } from "../src/services/hookIngestion.service.js";
import type { Logger } from "../src/lib/logger.js";

const log = pino({ enabled: false }) as Logger;

function ok<T>(value: T) {
  return { ok: true as const, value };
}

function noop(): void {
  return;
}

function createService(overrides: Record<string, unknown> = {}) {
  const state = {
    updates: [] as unknown[],
    pendingSets: [] as unknown[],
    replies: [] as Record<string, unknown>[],
    acks: [] as Record<string, unknown>[],
    statuses: [] as Record<string, unknown>[],
    events: [] as unknown[],
    typed: [] as unknown[],
    owners: [] as unknown[],
    markedMemory: [] as number[],
  };
  const service = createHookIngestionService({
    log,
    messagesRepo: {
      findByTg: () => null,
      findById: () => null,
      getChatId: () => null,
      update: (...args: unknown[]) => state.updates.push(args),
      insertOutboundAudit: () => 700,
    },
    pendingRepo: {
      get: () => null,
      getAllForSession: () => [],
      set: (...args: unknown[]) => state.pendingSets.push(args),
      clear: noop,
      listOthers: () => [],
    },
    outbox: {
      enqueueReply: (args: Record<string, unknown>) => {
        state.replies.push(args);
        return ok(1);
      },
      enqueueAck: (args: Record<string, unknown>) => {
        state.acks.push(args);
        return ok(2);
      },
      enqueueStatus: (args: Record<string, unknown>) => {
        state.statuses.push(args);
        return ok(3);
      },
    },
    sessionService: {
      insertEvent: (...args: unknown[]) => state.events.push(args),
      ensureOwner: (...args: unknown[]) => state.owners.push(args),
      recordStart: () => 42,
    },
    todoDiff: { diffAndPersist: () => [] },
    memory: {
      recent: () => [],
      markUsed: (ids: number[]) => {
        state.markedMemory.push(...ids);
      },
    },
    dispatch: { recent: () => [] },
    verbosity: { allows: () => false },
    typing: {
      start: (...args: unknown[]) => state.typed.push(["start", ...args]),
      stop: (...args: unknown[]) => state.typed.push(["stop", ...args]),
      stopAll: noop,
      activeCount: () => 0,
    },
    primaryOperator: 999,
    dbPath: "Z:/missing/relay.db",
    ...overrides,
  } as any);
  return { service, state };
}

test("user-prompt-submit binds pending Telegram inbound", () => {
  const { service, state } = createService({
    messagesRepo: {
      findByTg: (chatId: number, msgId: number) =>
        chatId === 10 && msgId === 20
          ? ({ id: 5, tgChatId: 10, tgMsgId: 20, fromUserId: 123, agent: "claude" } as any)
          : null,
      findById: () => null,
      getChatId: () => null,
      update: (...args: unknown[]) => state.updates.push(args),
      insertOutboundAudit: () => 1,
    },
  });

  const outcome = service.userPromptSubmit({
    sessionId: "11111111-1111-4111-8111-111111111111",
    prompt: "[tg id=10:20 user=u123] hello",
    agent: "codex",
  });
  assert.equal(outcome.ok, true);

  assert.deepEqual(state.updates[0], [5, { sessionId: "11111111-1111-4111-8111-111111111111" }]);
  assert.deepEqual(state.pendingSets[0], [
    "11111111-1111-4111-8111-111111111111",
    5,
    "[tg id=10:20 user=u123] hello",
    "codex",
  ]);
  assert.deepEqual(state.owners[0], ["11111111-1111-4111-8111-111111111111", 123, "codex"]);
  assert.deepEqual(state.typed[0], ["start", "11111111-1111-4111-8111-111111111111", 10]);
});

test("stop enqueues final reply and orphan fanout ack", () => {
  let cleared = false;
  const pending = [
    { sessionId: "sid", inboundMsgId: 1, promptHash: "a", createdAt: 1, agent: "claude" },
    { sessionId: "sid", inboundMsgId: 2, promptHash: "b", createdAt: 2, agent: "codex" },
  ];
  const { service, state } = createService({
    messagesRepo: {
      findByTg: () => null,
      findById: (id: number) =>
        ({
          id,
          tgChatId: 50,
          tgMsgId: id + 100,
          fromUserId: 1,
          agent: id === 2 ? "codex" : "claude",
        }) as any,
      getChatId: () => 50,
      update: noop,
      insertOutboundAudit: () => 700,
    },
    pendingRepo: {
      get: () => null,
      getAllForSession: () => pending,
      set: noop,
      clear: () => {
        cleared = true;
      },
      listOthers: () => [],
    },
  });

  const outcome = service.stop({ sessionId: "sid", lastAssistantMessage: "done" });
  assert.equal(outcome.ok, true);

  assert.equal(state.replies.length, 1);
  assert.equal(state.replies[0]?.repliedToId, 102);
  assert.equal(state.replies[0]?.auditMsgId, 700);
  assert.match(String(state.replies[0]?.text), /\[codex\]/);
  assert.equal(state.acks.length, 1);
  assert.equal(state.acks[0]?.repliedToId, 101);
  assert.equal(cleared, true);
  assert.deepEqual(state.typed.at(-1), ["stop", "sid"]);
});

test("stop returns typed failure when final reply cannot be enqueued", () => {
  let cleared = false;
  const { service, state } = createService({
    messagesRepo: {
      findByTg: () => null,
      findById: (id: number) =>
        ({
          id,
          tgChatId: 50,
          tgMsgId: 100,
          fromUserId: 1,
          agent: "claude",
        }) as any,
      getChatId: () => 50,
      update: noop,
      insertOutboundAudit: () => 700,
    },
    pendingRepo: {
      get: () => null,
      getAllForSession: () => [
        { sessionId: "sid", inboundMsgId: 1, promptHash: "a", createdAt: 1, agent: "claude" },
      ],
      set: noop,
      clear: () => {
        cleared = true;
      },
      listOthers: () => [],
    },
    outbox: {
      enqueueReply: () => ({
        ok: false,
        error: {
          code: "outbox_down",
          kind: "transient",
          message: "outbox down",
          retryable: true,
        },
      }),
      enqueueAck: () => ok(2),
      enqueueStatus: () => ok(3),
    },
  });

  const outcome = service.stop({ sessionId: "sid", lastAssistantMessage: "done" });

  assert.equal(outcome.ok, false);
  if (!outcome.ok) assert.equal(outcome.error.code, "outbox_down");
  assert.equal(cleared, false, "pending reply must remain open when final reply enqueue fails");
  assert.equal(state.acks.length, 0);
});

test("stop-failure deduplicates admin alerts", () => {
  const { service, state } = createService();

  const first = service.stopFailure({
    sessionId: "sid",
    errorType: "unknown",
    agent: "claude",
    payload: { message: "API Error: 401 invalid authentication credentials" },
  });
  const second = service.stopFailure({
    sessionId: "sid",
    errorType: "unknown",
    agent: "claude",
    payload: { message: "API Error: 401 invalid authentication credentials" },
  });
  assert.equal(first.ok, true);
  assert.equal(second.ok, true);

  assert.equal(state.statuses.length, 1);
  assert.match(String(state.statuses[0]?.text), /auth_failed/);
  assert.equal(state.statuses[0]?.eventType, "system");
  assert.deepEqual(state.typed, [
    ["stop", "sid"],
    ["stop", "sid"],
  ]);
});

test("session-start additional context includes memories dispatch and orphan pending", () => {
  const { service, state } = createService({
    memory: {
      recent: () => [{ id: 7, category: "ops", text: "Remember deploy gate" }],
      markUsed: (ids: number[]) => {
        state.markedMemory.push(...ids);
      },
    },
    dispatch: {
      recent: () => [
        {
          id: 9,
          tsStarted: 1,
          issueNumber: 123,
          prNumber: 77,
          status: "running",
        },
      ],
    },
    pendingRepo: {
      get: () => null,
      getAllForSession: () => [],
      set: noop,
      clear: noop,
      listOthers: () => [{ sessionId: "other-session", inboundMsgId: 55 }],
    },
  });

  const result = service.sessionStart({
    sessionId: "current-session",
    source: "startup",
    model: "opus",
    cwd: "/repo",
    transcriptPath: "/tmp/t.jsonl",
    agent: "claude",
  });
  assert.equal(result.ok, true);
  if (!result.ok) throw new Error(result.error.message);

  assert.match(result.value.additionalContext, /Recent memories/);
  assert.match(result.value.additionalContext, /Remember deploy gate/);
  assert.match(result.value.additionalContext, /run 9/);
  assert.match(result.value.additionalContext, /inbound_msg_id=55/);
  assert.deepEqual(state.markedMemory, [7]);
});

test("verbosity gates subagent and tool status events", () => {
  const { service, state } = createService({
    verbosity: {
      allows: (layer: string) => layer === "L2" || layer === "L4" || layer === "verbose_bash",
    },
  });

  assert.equal(
    service.subagentStop({ sessionId: "sid", agentId: "agent-123456", agentType: "review-worker" })
      .ok,
    true
  );
  assert.equal(
    service.preToolUse({ sessionId: "sid", toolName: "Skill", toolInput: { skill: "ln-400" } }).ok,
    true
  );
  const post = service.postToolUse({
    sessionId: "sid",
    toolName: "Skill",
    toolInput: { skill: "ln-401" },
    durationMs: 1500,
  });
  assert.equal(post.ok, true);

  assert.equal(state.statuses.length, 3);
  assert.equal(state.statuses[0]?.eventType, "status_subagent");
  assert.equal(state.statuses[1]?.eventType, "status_skill");
  assert.match(String(state.statuses[2]?.text), /done \(1\.5s\)$/);
});
