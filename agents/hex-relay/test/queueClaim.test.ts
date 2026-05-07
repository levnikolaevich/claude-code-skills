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
