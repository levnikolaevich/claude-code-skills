import { mkdtemp, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { test } from "node:test";
import assert from "node:assert/strict";
import pino from "pino";
import type { Logger } from "../src/lib/logger.js";
import type { InboundMessage } from "../src/domain/message.js";
import type { RunProcessResult } from "../src/infrastructure/process/runProcess.js";
import {
  createLocalVoiceTranscriber,
  normalizeTranscript,
  type ProcessRunner,
} from "../src/infrastructure/process/localVoiceTranscriber.js";
import { transcribeVoiceRow } from "../src/workers/voiceTranscription.worker.js";

const log = pino({ enabled: false }) as Logger;

function ok(stdout = "", stderr = ""): RunProcessResult {
  return { code: 0, signal: null, stdout, stderr };
}

function fail(stderr = "failed"): RunProcessResult {
  return { code: 1, signal: null, stdout: "", stderr };
}

function baseRow(overrides: Partial<InboundMessage> = {}): InboundMessage {
  return {
    id: 1,
    ts: 10,
    direction: "inbound",
    kind: "voice",
    status: "transcribing",
    text: "",
    tgChatId: 100,
    tgMsgId: 200,
    fromUserId: 300,
    sessionId: null,
    mediaPath: "/tmp/voice.oga",
    attempts: 0,
    nextAttemptAt: 0,
    deliveredAt: null,
    error: null,
    ...overrides,
  };
}

test("normalizeTranscript removes timestamps and joins plain text", () => {
  assert.equal(
    normalizeTranscript("[00:00:00.000 --> 00:00:01.000] Привет\n[00:00:01.000] world"),
    "Привет world"
  );
});

test("local voice transcriber runs ffmpeg then whisper.cpp and returns output file transcript", async () => {
  const dir = await mkdtemp(join(tmpdir(), "hex-relay-voice-"));
  const input = join(dir, "10.oga");
  await writeFile(input, "fake");
  const calls: string[] = [];
  const runner: ProcessRunner = async (cmd, args) => {
    calls.push(`${cmd} ${args.join(" ")}`);
    if (cmd === "whisper-cli") {
      const outBase = args[args.indexOf("-of") + 1];
      await writeFile(`${outBase}.txt`, "  сделай status  ");
    }
    return ok();
  };
  const transcriber = createLocalVoiceTranscriber(
    {
      ffmpegBin: "ffmpeg",
      whisperCppBin: "whisper-cli",
      whisperCppModel: "/models/ggml.bin",
      timeoutMs: 1000,
    },
    runner
  );

  const transcript = await transcriber.transcribe(input);

  assert.equal(transcript.text, "сделай status");
  assert.equal(calls.length, 2);
  assert.match(calls[0], /^ffmpeg /);
  assert.match(calls[1], /^whisper-cli /);
});

test("local voice transcriber rejects ffmpeg failures", async () => {
  const dir = await mkdtemp(join(tmpdir(), "hex-relay-voice-"));
  const input = join(dir, "11.oga");
  await writeFile(input, "fake");
  const transcriber = createLocalVoiceTranscriber(
    {
      ffmpegBin: "ffmpeg",
      whisperCppBin: "whisper-cli",
      whisperCppModel: "/models/ggml.bin",
      timeoutMs: 1000,
    },
    async () => fail("bad audio")
  );

  await assert.rejects(() => transcriber.transcribe(input), /ffmpeg failed/);
});

test("voice row success becomes queued plain transcript", async () => {
  const updates: unknown[] = [];
  await transcribeVoiceRow(
    {
      log,
      messagesRepo: {
        update: (_id: number, fields: unknown) => updates.push(fields),
      } as any,
      outbox: { enqueueReply: () => void updates.length } as any,
      transcriber: { transcribe: async () => ({ text: "restart service" }) },
    },
    baseRow()
  );

  assert.deepEqual(updates[0], {
    status: "queued",
    text: "restart service",
    attempts: 1,
    nextAttemptAt: (updates[0] as { nextAttemptAt: number }).nextAttemptAt,
    error: null,
  });
  assert.equal(typeof (updates[0] as { nextAttemptAt: number }).nextAttemptAt, "number");
});

test("voice row failure becomes rejected and replies to Telegram", async () => {
  const updates: unknown[] = [];
  const replies: unknown[] = [];
  await transcribeVoiceRow(
    {
      log,
      messagesRepo: {
        update: (_id: number, fields: unknown) => updates.push(fields),
      } as any,
      outbox: { enqueueReply: (reply: unknown) => replies.push(reply) } as any,
      transcriber: {
        transcribe: async () => {
          throw new Error("empty voice transcript");
        },
      },
    },
    baseRow()
  );

  assert.deepEqual(updates[0], {
    status: "rejected",
    attempts: 1,
    error: "Error: empty voice transcript",
  });
  assert.equal((replies[0] as { chatId: number }).chatId, 100);
  assert.equal((replies[0] as { repliedToId: number }).repliedToId, 200);
});

test("voice row rejects when local transcriber is disabled", async () => {
  const updates: unknown[] = [];
  await transcribeVoiceRow(
    {
      log,
      messagesRepo: {
        update: (_id: number, fields: unknown) => updates.push(fields),
      } as any,
      outbox: { enqueueReply: () => void updates.length } as any,
      transcriber: null,
    },
    baseRow()
  );

  assert.equal((updates[0] as { status: string }).status, "rejected");
  assert.equal((updates[0] as { error: string }).error, "voice transcription is disabled");
});
