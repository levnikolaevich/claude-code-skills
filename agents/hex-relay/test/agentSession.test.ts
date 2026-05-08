import { test } from "node:test";
import assert from "node:assert/strict";
import pino from "pino";
import { TIMING } from "../src/config/paths.js";
import type { InboundMessage } from "../src/domain/message.js";
import type { Logger } from "../src/lib/logger.js";
import { createAgentSessionService } from "../src/services/agentSession.service.js";

const log = pino({ enabled: false }) as Logger;

function ok<T>(value: T) {
  return { ok: true as const, value };
}

function makeRow(agent: "claude" | "codex" = "claude"): InboundMessage {
  const ts = Math.floor(Date.now() / 1000);
  return {
    id: 7,
    ts,
    direction: "inbound",
    kind: "text",
    status: "queued",
    text: "[tg id=10:20 user=u] hello",
    tgChatId: 10,
    tgMsgId: 20,
    fromUserId: 42,
    sessionId: null,
    mediaPath: null,
    attempts: 0,
    nextAttemptAt: ts,
    deliveredAt: null,
    error: null,
    agent,
  };
}

function makeMessagesRepo(row: InboundMessage, getSessionId: () => string | null) {
  return {
    update: () => row.id,
    findById: () => ({ ...row, sessionId: getSessionId() }),
    claimDue: () => [],
    selectDue: () => [],
    findByTg: () => null,
    getChatId: () => null,
    counts: () => ({ inboundQueued: 0, inboundFailed: 0, inboundRejected: 0 }),
    insertInbound: () => row.id,
    lastActivityForUserAgent: () => null,
    hasActiveInboundForUserAgent: () => false,
    hasActiveWorkForUserAgent: () => false,
  };
}

test("agent session adapter submits a Claude prompt and waits for hook ack", async () => {
  const row = makeRow("claude");
  let sent = false;
  const service = createAgentSessionService({
    log,
    messagesRepo: makeMessagesRepo(row, () => (sent ? "sid" : null)),
    controlLane: { run: async (_name: string, fn: () => Promise<unknown>) => fn() },
    godRuntime: {
      ensureStarted: async () => ok(null),
      runtimeFor: () =>
        ok({
          pane: {
            send: async () => {
              sent = true;
            },
            hasSession: async () => true,
          },
        }),
    },
  } as any);

  const result = await service.submitPrompt({ row, userId: 42 });

  assert.equal(result.ok, true);
  assert.equal(result.ok ? result.value.sessionId : null, "sid");
});

test("agent session adapter reports untrusted Codex hooks before sending prompt", async () => {
  const originalReadyTimeout = TIMING.agentReadyTimeoutMs;
  const originalReadyPoll = TIMING.agentReadyPollMs;
  (TIMING as any).agentReadyTimeoutMs = 5;
  (TIMING as any).agentReadyPollMs = 1;
  const row = makeRow("codex");
  let sent = false;
  const service = createAgentSessionService({
    log,
    messagesRepo: makeMessagesRepo(row, () => null),
    controlLane: { run: async (_name: string, fn: () => Promise<unknown>) => fn() },
    godRuntime: {
      ensureStarted: async () => ok(null),
      runtimeFor: () =>
        ok({
          pane: {
            send: async () => {
              sent = true;
            },
            hasSession: async () => true,
            captureText: async () =>
              "⚠ 5 hooks need review before they can run. Open /hooks to review them.",
          },
        }),
    },
  } as any);

  try {
    const result = await service.submitPrompt({ row, userId: 42 });

    assert.equal(result.ok, false);
    assert.equal(result.ok ? "" : result.error.code, "codex_hooks_untrusted");
    assert.equal(sent, false);
  } finally {
    (TIMING as any).agentReadyTimeoutMs = originalReadyTimeout;
    (TIMING as any).agentReadyPollMs = originalReadyPoll;
  }
});
