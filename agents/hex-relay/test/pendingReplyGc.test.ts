import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import pino from "pino";
import { createDb, closeDb, type Db } from "../src/infrastructure/db/client.js";
import {
  createRepositories,
  type Repositories,
} from "../src/infrastructure/db/repositories/index.js";
import { createPendingReplyGcWorker } from "../src/workers/pendingReplyGc.worker.js";
import type { Logger } from "../src/lib/logger.js";

const log = pino({ enabled: false }) as Logger;

interface DbCtx {
  db: Db;
  repos: Repositories;
}

async function withDb<T>(fn: (ctx: DbCtx) => Promise<T>): Promise<T> {
  const dir = await mkdtemp(join(tmpdir(), "hex-relay-pgc-"));
  const db = createDb({
    dbPath: join(dir, "relay.db"),
    log,
    primaryOperator: 1,
    sessionsDir: () => null,
  });
  const repos = createRepositories(db);
  try {
    return await fn({ db, repos });
  } finally {
    closeDb(db);
    await rm(dir, { recursive: true, force: true });
  }
}

function backdatePending(db: Db, sessionId: string, inboundId: number, createdAt: number): void {
  db.prepare("UPDATE pending_reply SET created_at=? WHERE session_id=? AND inbound_msg_id=?").run(
    createdAt,
    sessionId,
    inboundId
  );
}

test("findStaleOlderThan filters by created_at boundary", async () => {
  await withDb(async ({ db, repos }) => {
    const nowSec = Math.floor(Date.now() / 1000);
    repos.pendingReply.set("sid-stale", 101, "old prompt");
    repos.pendingReply.set("sid-live", 102, "new prompt");
    backdatePending(db, "sid-stale", 101, nowSec - 90_000);
    backdatePending(db, "sid-live", 102, nowSec - 60);

    const stale = repos.pendingReply.findStaleOlderThan(86_400);
    assert.equal(stale.length, 1);
    assert.equal(stale[0].inboundMsgId, 101);
    assert.equal(stale[0].sessionId, "sid-stale");
  });
});

test("deleteOne removes only the targeted row", async () => {
  await withDb(async ({ repos }) => {
    repos.pendingReply.set("sid-burst", 201, "p1");
    repos.pendingReply.set("sid-burst", 202, "p2");
    repos.pendingReply.set("sid-burst", 203, "p3");
    assert.equal(repos.pendingReply.getAllForSession("sid-burst").length, 3);

    repos.pendingReply.deleteOne("sid-burst", 202);
    const remaining = repos.pendingReply
      .getAllForSession("sid-burst")
      .map((r) => r.inboundMsgId)
      .sort();
    assert.deepEqual(remaining, [201, 203]);
  });
});

test("countActive ignores rows already outside health TTL window", async () => {
  await withDb(async ({ db, repos }) => {
    const nowSec = Math.floor(Date.now() / 1000);
    repos.pendingReply.set("sid-old", 301, "old");
    repos.pendingReply.set("sid-fresh", 302, "fresh");
    backdatePending(db, "sid-old", 301, nowSec - 90_000);

    const active = repos.pendingReply.countActive(3600);
    assert.equal(active, 1, "only fresh row counts as active in 1h health window");

    repos.pendingReply.deleteOne("sid-old", 301);
    assert.equal(repos.pendingReply.countActive(3600), 1);
  });
});

test("worker retires stale row with error ack and clears it", async () => {
  await withDb(async ({ db, repos }) => {
    const nowSec = Math.floor(Date.now() / 1000);
    const inboundId = repos.messages.insertInbound("user prompt", 555, 9000, 7, "claude");
    repos.pendingReply.set("sid-A", inboundId, "p");
    backdatePending(db, "sid-A", inboundId, nowSec - 90_000);

    const enqueued: { text: string; chatId: number; repliedToId: number | null; agent?: string }[] =
      [];
    const worker = createPendingReplyGcWorker({
      log,
      pendingRepo: repos.pendingReply,
      messagesRepo: repos.messages,
      outbox: {
        enqueueAck: (args: {
          text: string;
          chatId: number;
          repliedToId?: number | null;
          agent?: string;
        }) => {
          enqueued.push({
            text: args.text,
            chatId: args.chatId,
            repliedToId: args.repliedToId ?? null,
            agent: args.agent,
          });
          return 42;
        },
      } as unknown as Parameters<typeof createPendingReplyGcWorker>[0]["outbox"],
      primaryOperator: 1,
      retentionSec: 86_400,
      tickIntervalMs: 1000,
    });

    const result = worker.evaluate();
    assert.equal(result.retired, 1);
    assert.equal(result.skippedNoInbound, 0);
    assert.equal(result.errors, 0);
    assert.equal(enqueued.length, 1);
    assert.equal(enqueued[0].chatId, 555);
    assert.equal(enqueued[0].repliedToId, 9000);
    assert.equal(enqueued[0].agent, "claude");
    assert.match(enqueued[0].text, /Ответ потерян/);
    assert.equal(repos.pendingReply.get("sid-A"), null);
  });
});

test("worker leaves live (within-retention) row alone", async () => {
  await withDb(async ({ repos }) => {
    const inboundId = repos.messages.insertInbound("fresh prompt", 555, 9001, 7, "claude");
    repos.pendingReply.set("sid-fresh", inboundId, "p");

    const enqueued: unknown[] = [];
    const worker = createPendingReplyGcWorker({
      log,
      pendingRepo: repos.pendingReply,
      messagesRepo: repos.messages,
      outbox: {
        enqueueAck: (args: unknown) => {
          enqueued.push(args);
          return 99;
        },
      } as unknown as Parameters<typeof createPendingReplyGcWorker>[0]["outbox"],
      primaryOperator: 1,
      retentionSec: 86_400,
      tickIntervalMs: 1000,
    });

    const result = worker.evaluate();
    assert.equal(result.retired, 0);
    assert.equal(enqueued.length, 0);
    assert.equal(repos.pendingReply.get("sid-fresh")?.inboundMsgId, inboundId);
  });
});

test("worker silently purges stale row when inbound is missing", async () => {
  await withDb(async ({ db, repos }) => {
    const nowSec = Math.floor(Date.now() / 1000);
    repos.pendingReply.set("sid-orphan", 999, "p");
    backdatePending(db, "sid-orphan", 999, nowSec - 90_000);

    const enqueued: unknown[] = [];
    const worker = createPendingReplyGcWorker({
      log,
      pendingRepo: repos.pendingReply,
      messagesRepo: repos.messages,
      outbox: {
        enqueueAck: (args: unknown) => {
          enqueued.push(args);
          return 1;
        },
      } as unknown as Parameters<typeof createPendingReplyGcWorker>[0]["outbox"],
      primaryOperator: 1,
      retentionSec: 86_400,
      tickIntervalMs: 1000,
    });

    const result = worker.evaluate();
    assert.equal(result.retired, 0);
    assert.equal(result.skippedNoInbound, 1);
    assert.equal(enqueued.length, 0);
    assert.equal(repos.pendingReply.get("sid-orphan"), null);
  });
});

test("worker retires only stale rows in a burst session, leaves fresh ones", async () => {
  await withDb(async ({ db, repos }) => {
    const nowSec = Math.floor(Date.now() / 1000);
    const idStale1 = repos.messages.insertInbound("p1", 1234, 5001, 7, "claude");
    const idStale2 = repos.messages.insertInbound("p2", 1234, 5002, 7, "claude");
    const idFresh = repos.messages.insertInbound("p3", 1234, 5003, 7, "claude");
    repos.pendingReply.set("sid-burst", idStale1, "p1");
    repos.pendingReply.set("sid-burst", idStale2, "p2");
    repos.pendingReply.set("sid-burst", idFresh, "p3");
    backdatePending(db, "sid-burst", idStale1, nowSec - 90_000);
    backdatePending(db, "sid-burst", idStale2, nowSec - 90_000);

    const enqueued: { repliedToId: number | null }[] = [];
    const worker = createPendingReplyGcWorker({
      log,
      pendingRepo: repos.pendingReply,
      messagesRepo: repos.messages,
      outbox: {
        enqueueAck: (args: { repliedToId?: number | null }) => {
          enqueued.push({ repliedToId: args.repliedToId ?? null });
          return 1;
        },
      } as unknown as Parameters<typeof createPendingReplyGcWorker>[0]["outbox"],
      primaryOperator: 1,
      retentionSec: 86_400,
      tickIntervalMs: 1000,
    });

    const result = worker.evaluate();
    assert.equal(result.retired, 2);
    assert.equal(enqueued.length, 2);
    assert.deepEqual(
      enqueued.map((e) => e.repliedToId).sort((a, b) => (a ?? 0) - (b ?? 0)),
      [5001, 5002]
    );
    const survivors = repos.pendingReply.getAllForSession("sid-burst").map((r) => r.inboundMsgId);
    assert.deepEqual(survivors, [idFresh], "only fresh row survives the burst-GC pass");
  });
});
