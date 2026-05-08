import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import pino from "pino";
import { closeDb, createDb } from "../src/infrastructure/db/client.js";
import { createRepositories } from "../src/infrastructure/db/repositories/index.js";
import type { Logger } from "../src/lib/logger.js";

const log = pino({ enabled: false }) as Logger;

test("inbound claimDue atomically moves queued rows to delivering", async () => {
  const dir = await mkdtemp(join(tmpdir(), "hex-relay-claim-"));
  const db = createDb({
    dbPath: join(dir, "relay.db"),
    log,
    primaryOperator: 1,
    sessionsDir: () => null,
  });
  try {
    const repos = createRepositories(db);
    repos.messages.insertInbound("one", 1, 101, 1);
    repos.messages.insertInbound("two", 1, 102, 1);

    const first = repos.messages.claimDue(10);
    const second = repos.messages.claimDue(10);

    assert.equal(first.length, 2);
    assert.deepEqual(
      first.map((row) => row.status),
      ["delivering", "delivering"]
    );
    assert.equal(second.length, 0);
  } finally {
    closeDb(db);
  }
});

test("lastActivityForUserAgent uses inbound/outbound/session activity", async () => {
  const dir = await mkdtemp(join(tmpdir(), "hex-relay-activity-"));
  const db = createDb({
    dbPath: join(dir, "relay.db"),
    log,
    primaryOperator: 1,
    sessionsDir: () => null,
  });
  try {
    const repos = createRepositories(db);
    const id = repos.messages.insertInbound("old requeued prompt", 1, 101, 42);
    db.prepare("UPDATE messages SET ts=?, delivered_at=?, status='delivered' WHERE id=?").run(
      100,
      1000,
      id
    );
    repos.outbox.enqueue({
      text: "status",
      chatId: 42,
      repliedToId: null,
      sessionId: "sid",
      auditMsgId: null,
      eventType: "status_skill",
      agent: "claude",
    });
    db.prepare("UPDATE outbox SET ts=? WHERE chat_id=?").run(1200, 42);
    db.prepare(
      "INSERT INTO sessions " +
        "(session_id, started_at, source, created_by_user_id, agent) VALUES (?,?,?,?,?)"
    ).run("sid", 1, "test", 42, "claude");
    db.prepare("INSERT INTO session_events (session_id, ts, kind, details) VALUES (?,?,?,?)").run(
      "sid",
      1400,
      "subagent_stop",
      "{}"
    );

    assert.equal(repos.messages.lastActivityForUserAgent(42, "claude"), 1400);
  } finally {
    closeDb(db);
  }
});

test("hasActiveWorkForUserAgent tracks open tool work until a closing event", async () => {
  const dir = await mkdtemp(join(tmpdir(), "hex-relay-active-work-"));
  const db = createDb({
    dbPath: join(dir, "relay.db"),
    log,
    primaryOperator: 1,
    sessionsDir: () => null,
  });
  try {
    const repos = createRepositories(db);
    db.prepare(
      "INSERT INTO sessions " +
        "(session_id, started_at, source, created_by_user_id, agent) VALUES (?,?,?,?,?)"
    ).run("sid", 1, "test", 42, "claude");
    db.prepare("INSERT INTO session_events (session_id, ts, kind, details) VALUES (?,?,?,?)").run(
      "sid",
      100,
      "pre_tool_use",
      "{}"
    );
    assert.equal(repos.messages.hasActiveWorkForUserAgent(42, "claude"), true);

    db.prepare("INSERT INTO session_events (session_id, ts, kind, details) VALUES (?,?,?,?)").run(
      "sid",
      200,
      "post_tool_use",
      "{}"
    );
    assert.equal(repos.messages.hasActiveWorkForUserAgent(42, "claude"), false);
  } finally {
    closeDb(db);
  }
});

test("outbox claimDue atomically moves queued rows to sending", async () => {
  const dir = await mkdtemp(join(tmpdir(), "hex-relay-claim-"));
  const db = createDb({
    dbPath: join(dir, "relay.db"),
    log,
    primaryOperator: 1,
    sessionsDir: () => null,
  });
  try {
    const repos = createRepositories(db);
    repos.outbox.enqueue({
      text: "reply",
      chatId: 1,
      repliedToId: null,
      sessionId: null,
      auditMsgId: null,
      eventType: "reply",
      agent: "claude",
    });

    const first = repos.outbox.claimDue(10);
    const second = repos.outbox.claimDue(10);

    assert.equal(first.length, 1);
    assert.equal(first[0]!.status, "sending");
    assert.equal(second.length, 0);
  } finally {
    closeDb(db);
  }
});
