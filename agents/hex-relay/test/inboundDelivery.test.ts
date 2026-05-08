import { test } from "node:test";
import assert from "node:assert/strict";
import pino from "pino";
import { TIMING } from "../src/config/paths.js";
import type { InboundMessage } from "../src/domain/message.js";
import { createInboundService } from "../src/services/inbound.service.js";
import type { Logger } from "../src/lib/logger.js";

const log = pino({ enabled: false }) as Logger;

function ok<T>(value: T) {
  return { ok: true as const, value };
}

function makeRow(): InboundMessage {
  const ts = Math.floor(Date.now() / 1000);
  return {
    id: 1,
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
    agent: "claude",
  };
}

test("deliver waits for user-prompt-submit ack before marking inbound delivered", async () => {
  const row = makeRow();
  const updates: unknown[] = [];
  let sent = false;
  const service = createInboundService({
    log,
    messagesRepo: {
      update: (...args: unknown[]) => updates.push(args),
      findById: () => (sent ? { ...row, sessionId: "sid" } : row),
      claimDue: () => [],
      selectDue: () => [],
      findByTg: () => null,
      getChatId: () => null,
      counts: () => ({ inboundQueued: 0, inboundFailed: 0, inboundRejected: 0 }),
      insertInbound: () => 1,
      lastActivityForUserAgent: () => null,
      hasActiveInboundForUserAgent: () => false,
      hasActiveWorkForUserAgent: () => false,
    },
    outboxService: {
      enqueueReply: () => ok(1),
      enqueueAck: () => ok(1),
      enqueueStatus: () => ok(1),
    },
    agentSessions: {
      submitPrompt: async () => {
        sent = true;
        return ok({ ...row, sessionId: "sid" });
      },
    },
    verbosity: { allows: () => false },
    reactToInbound: () => Promise.resolve(),
  } as any);

  const result = await service.deliver(row);

  assert.equal(result.ok, true);
  assert.equal(result.ok ? result.value.status : "", "delivered");
  assert.equal((updates.at(-1) as any[])[0], 1);
  const fields = (updates.at(-1) as any[])[1] as Record<string, unknown>;
  assert.equal(fields.status, "delivered");
  assert.equal(fields.error, null);
  assert.equal(typeof fields.deliveredAt, "number");
});

test("deliver requeues when tmux send is not acknowledged by user-prompt-submit hook", async () => {
  const originalTimeout = TIMING.inboundSubmitAckTimeoutMs;
  const originalPoll = TIMING.inboundSubmitAckPollMs;
  (TIMING as any).inboundSubmitAckTimeoutMs = 5;
  (TIMING as any).inboundSubmitAckPollMs = 1;
  const row = makeRow();
  const updates: unknown[] = [];
  const service = createInboundService({
    log,
    messagesRepo: {
      update: (...args: unknown[]) => updates.push(args),
      findById: () => row,
      claimDue: () => [],
      selectDue: () => [],
      findByTg: () => null,
      getChatId: () => null,
      counts: () => ({ inboundQueued: 0, inboundFailed: 0, inboundRejected: 0 }),
      insertInbound: () => 1,
      lastActivityForUserAgent: () => null,
      hasActiveInboundForUserAgent: () => false,
      hasActiveWorkForUserAgent: () => false,
    },
    outboxService: {
      enqueueReply: () => ok(1),
      enqueueAck: () => ok(1),
      enqueueStatus: () => ok(1),
    },
    agentSessions: {
      submitPrompt: async () => ({
        ok: false,
        error: {
          code: "agent_prompt_ack_timeout",
          kind: "transient",
          retryable: true,
          message: `prompt submit hook was not observed within ${TIMING.inboundSubmitAckTimeoutMs}ms`,
        },
      }),
    },
    verbosity: { allows: () => false },
    reactToInbound: () => Promise.resolve(),
  } as any);

  try {
    const result = await service.deliver(row);

    assert.equal(result.ok, true);
    assert.equal(result.ok ? result.value.status : "", "retry_scheduled");
    assert.equal((updates.at(-1) as any[])[0], 1);
    assert.equal(((updates.at(-1) as any[])[1] as Record<string, unknown>).status, "queued");
    assert.match(
      String(((updates.at(-1) as any[])[1] as Record<string, unknown>).error),
      /prompt submit hook was not observed/
    );
  } finally {
    (TIMING as any).inboundSubmitAckTimeoutMs = originalTimeout;
    (TIMING as any).inboundSubmitAckPollMs = originalPoll;
  }
});
