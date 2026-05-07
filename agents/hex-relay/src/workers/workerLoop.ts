import { setTimeout as delay } from "node:timers/promises";
import type { Logger } from "../lib/logger.js";
import { recordWorkerTickFailure } from "../observability/metrics.js";

export interface DrainableWorker {
  start(): Promise<void>;
  stop(): Promise<void>;
}

export interface WorkerLoopOptions {
  log: Logger;
  name: string;
  intervalMs: number | (() => number);
  runImmediately?: boolean;
  runOnce(): Promise<void> | void;
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError";
}

function intervalValue(intervalMs: number | (() => number)): number {
  return typeof intervalMs === "function" ? intervalMs() : intervalMs;
}

export function createWorkerLoop(opts: WorkerLoopOptions): DrainableWorker {
  let running = false;
  let loopPromise: Promise<void> | null = null;
  let sleepAbort: AbortController | null = null;

  async function sleep(ms: number): Promise<void> {
    sleepAbort = new AbortController();
    try {
      await delay(ms, undefined, { signal: sleepAbort.signal });
    } catch (error) {
      if (!isAbortError(error)) throw error;
    } finally {
      sleepAbort = null;
    }
  }

  return {
    async start() {
      if (running) return;
      running = true;
      loopPromise = (async () => {
        let first = true;
        while (running) {
          if (!first || opts.runImmediately !== false) {
            try {
              await opts.runOnce();
            } catch (error) {
              recordWorkerTickFailure(opts.name);
              opts.log.error({ err: String(error) }, `${opts.name} iteration failed`);
            }
          }
          first = false;
          if (!running) break;
          await sleep(intervalValue(opts.intervalMs));
        }
      })().finally(() => {
        running = false;
        loopPromise = null;
        sleepAbort = null;
      });
      await loopPromise;
    },

    async stop() {
      running = false;
      sleepAbort?.abort();
      if (loopPromise) await loopPromise;
    },
  };
}
