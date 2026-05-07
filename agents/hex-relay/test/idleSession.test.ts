import { test } from "node:test";
import assert from "node:assert/strict";
import pino from "pino";
import {
  createIdleSessionService,
  decide,
  type IdleSessionDeps,
} from "../src/services/idleSession.service.js";
import type { GodStatusProbe } from "../src/infrastructure/systemd/godStatus.js";
import type { MessagesRepo } from "../src/infrastructure/db/repositories/messages.repo.js";
import type { PendingReplyRepo } from "../src/infrastructure/db/repositories/pendingReply.repo.js";
import type { Logger } from "../src/lib/logger.js";
import type { AgentKind } from "../src/domain/message.js";

const log = pino({ enabled: false }) as Logger;

test("decide: in-flight reply skips mid-turn", () => {
  assert.equal(
    decide({ now: 1000, lastActivity: 0, inFlight: true, idleThresholdSec: 600 }),
    "skip_mid_turn"
  );
});

test("decide: no last activity is treated as recent (no kill)", () => {
  assert.equal(
    decide({ now: 1000, lastActivity: null, inFlight: false, idleThresholdSec: 600 }),
    "skip_recent"
  );
});

test("decide: under threshold = skip_recent", () => {
  assert.equal(
    decide({ now: 1000, lastActivity: 500, inFlight: false, idleThresholdSec: 600 }),
    "skip_recent"
  );
});

test("decide: at threshold = stop", () => {
  assert.equal(
    decide({ now: 1000, lastActivity: 400, inFlight: false, idleThresholdSec: 600 }),
    "stop"
  );
});

test("decide: well above threshold = stop", () => {
  assert.equal(
    decide({ now: 10_000, lastActivity: 100, inFlight: false, idleThresholdSec: 600 }),
    "stop"
  );
});

interface FakeGodStatus {
  listActiveInstances: () => Promise<{ userId: number; agent: AgentKind }[]>;
  stop: (userId: number, agent: AgentKind) => Promise<void>;
  stopped: { userId: number; agent: AgentKind }[];
}

function buildFakes(opts: {
  instances: { userId: number; agent: AgentKind }[];
  lastActivity: Map<string, number | null>;
  inFlight: Map<string, boolean>;
  activeInbound?: Map<string, boolean>;
  stopShouldThrow?: boolean;
}): {
  godStatus: GodStatusProbe;
  messagesRepo: MessagesRepo;
  pendingRepo: PendingReplyRepo;
  controlLane: IdleSessionDeps["controlLane"];
  fake: FakeGodStatus;
  order: string[];
} {
  const stopped: { userId: number; agent: AgentKind }[] = [];
  const order: string[] = [];
  const fake: FakeGodStatus = {
    listActiveInstances: async () => opts.instances,
    stop: async (userId, agent) => {
      if (opts.stopShouldThrow) throw new Error("boom");
      order.push(`stop:${userId}:${agent}`);
      stopped.push({ userId, agent });
    },
    stopped,
  };

  const godStatus = {
    listActiveInstances: fake.listActiveInstances,
    stop: fake.stop,
    isActive: async () => true,
    isAnyActive: async () => true,
  } as unknown as GodStatusProbe;

  const messagesRepo = {
    lastActivityForUserAgent: (userId: number, agent: AgentKind) => {
      order.push(`lastActivity:${userId}:${agent}`);
      return opts.lastActivity.get(`${userId}:${agent}`) ?? null;
    },
    hasActiveInboundForUserAgent: (userId: number, agent: AgentKind) => {
      order.push(`activeInbound:${userId}:${agent}`);
      return opts.activeInbound?.get(`${userId}:${agent}`) ?? false;
    },
  } as unknown as MessagesRepo;

  const pendingRepo = {
    hasOpenForUserAgent: (userId: number, agent: AgentKind) => {
      order.push(`pending:${userId}:${agent}`);
      return opts.inFlight.get(`${userId}:${agent}`) ?? false;
    },
  } as unknown as PendingReplyRepo;

  const controlLane = {
    run: async <T>(_label: string, fn: () => Promise<T> | T): Promise<T> => {
      order.push("control:start");
      try {
        return await fn();
      } finally {
        order.push("control:end");
      }
    },
  } as IdleSessionDeps["controlLane"];

  return { godStatus, messagesRepo, pendingRepo, controlLane, fake, order };
}

function buildDeps(
  overrides: Partial<IdleSessionDeps> & {
    godStatus: GodStatusProbe;
    messagesRepo: MessagesRepo;
    pendingRepo: PendingReplyRepo;
  }
): IdleSessionDeps {
  return {
    log,
    idleThresholdSec: 600,
    bootGraceSec: 0,
    bootTimestampSec: 0,
    controlLane: {
      run: async <T>(_label: string, fn: () => Promise<T> | T): Promise<T> => fn(),
    },
    nowFn: () => 10_000,
    ...overrides,
  };
}

test("evaluate: skips when boot grace not elapsed", async () => {
  const fakes = buildFakes({ instances: [], lastActivity: new Map(), inFlight: new Map() });
  const service = createIdleSessionService(
    buildDeps({
      ...fakes,
      bootGraceSec: 120,
      bootTimestampSec: 9950, // sinceBoot = 50 < 120
    })
  );
  const result = await service.evaluate();
  assert.equal(result.skippedBootGrace, true);
  assert.equal(result.active, 0);
  assert.equal(result.stopped, 0);
});

test("evaluate: stops idle claude instance", async () => {
  const fakes = buildFakes({
    instances: [{ userId: 1077, agent: "claude" }],
    lastActivity: new Map([["1077:claude", 5000]]), // idle for 5000s
    inFlight: new Map(),
  });
  const service = createIdleSessionService(buildDeps({ ...fakes }));
  const result = await service.evaluate();
  assert.equal(result.active, 1);
  assert.equal(result.stopped, 1);
  assert.deepEqual(fakes.fake.stopped, [{ userId: 1077, agent: "claude" }]);
});

test("evaluate: skips mid-turn instance", async () => {
  const fakes = buildFakes({
    instances: [{ userId: 1077, agent: "claude" }],
    lastActivity: new Map([["1077:claude", 5000]]),
    inFlight: new Map([["1077:claude", true]]),
  });
  const service = createIdleSessionService(buildDeps({ ...fakes }));
  const result = await service.evaluate();
  assert.equal(result.skippedMidTurn, 1);
  assert.equal(result.stopped, 0);
  assert.equal(fakes.fake.stopped.length, 0);
});

test("evaluate: skips mid-turn when active inbound is queued/delivering/transcribing", async () => {
  for (const status of ["queued", "delivering", "transcribing"]) {
    const fakes = buildFakes({
      instances: [{ userId: 1077, agent: "claude" }],
      lastActivity: new Map([["1077:claude", 5000]]),
      inFlight: new Map(),
      activeInbound: new Map([["1077:claude", true]]),
    });
    const service = createIdleSessionService(buildDeps({ ...fakes }));
    const result = await service.evaluate();
    assert.equal(result.skippedMidTurn, 1, status);
    assert.equal(result.stopped, 0, status);
    assert.equal(fakes.fake.stopped.length, 0, status);
  }
});

test("evaluate: skips recently active instance", async () => {
  const fakes = buildFakes({
    instances: [{ userId: 1077, agent: "claude" }],
    lastActivity: new Map([["1077:claude", 9700]]), // idle for 300s, threshold 600s
    inFlight: new Map(),
  });
  const service = createIdleSessionService(buildDeps({ ...fakes }));
  const result = await service.evaluate();
  assert.equal(result.skippedRecent, 1);
  assert.equal(result.stopped, 0);
});

test("evaluate: handles claude + codex independently per user", async () => {
  const fakes = buildFakes({
    instances: [
      { userId: 1077, agent: "claude" },
      { userId: 1077, agent: "codex" },
    ],
    lastActivity: new Map([
      ["1077:claude", 5000], // idle 5000s -> stop
      ["1077:codex", 9800], // idle 200s -> skip
    ]),
    inFlight: new Map(),
  });
  const service = createIdleSessionService(buildDeps({ ...fakes }));
  const result = await service.evaluate();
  assert.equal(result.active, 2);
  assert.equal(result.stopped, 1);
  assert.equal(result.skippedRecent, 1);
  assert.deepEqual(fakes.fake.stopped, [{ userId: 1077, agent: "claude" }]);
});

test("evaluate: counts errors when stop fails", async () => {
  const fakes = buildFakes({
    instances: [{ userId: 1077, agent: "claude" }],
    lastActivity: new Map([["1077:claude", 5000]]),
    inFlight: new Map(),
    stopShouldThrow: true,
  });
  const service = createIdleSessionService(buildDeps({ ...fakes }));
  const result = await service.evaluate();
  assert.equal(result.errors, 1);
  assert.equal(result.stopped, 0);
});

test("evaluate: idle decision and stop run inside controlLane", async () => {
  const fakes = buildFakes({
    instances: [{ userId: 1077, agent: "claude" }],
    lastActivity: new Map([["1077:claude", 5000]]),
    inFlight: new Map(),
  });
  const service = createIdleSessionService(buildDeps({ ...fakes }));
  const result = await service.evaluate();

  assert.equal(result.stopped, 1);
  assert.deepEqual(fakes.order, [
    "control:start",
    "pending:1077:claude",
    "activeInbound:1077:claude",
    "lastActivity:1077:claude",
    "stop:1077:claude",
    "control:end",
  ]);
});
