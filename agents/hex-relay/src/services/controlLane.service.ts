import { Mutex } from "../lib/mutex.js";

export interface ControlLaneState {
  busy: boolean;
  pending: number;
  current: string | null;
  lastAction: string | null;
}

export interface ControlLane {
  run<T>(action: string, op: () => Promise<T>): Promise<T>;
  state(): ControlLaneState;
}

export function createControlLane(): ControlLane {
  const lock = new Mutex();
  let pending = 0;
  let current: string | null = null;
  let lastAction: string | null = null;

  return {
    async run<T>(action: string, op: () => Promise<T>): Promise<T> {
      pending += 1;
      let queued = true;
      try {
        const release = await lock.acquire(action);
        try {
          pending -= 1;
          queued = false;
          current = action;
          lastAction = action;
          try {
            return await op();
          } finally {
            current = null;
          }
        } finally {
          release();
        }
      } catch (error) {
        if (queued && pending > 0) pending -= 1;
        throw error;
      }
    },
    state(): ControlLaneState {
      return {
        busy: lock.isLocked(),
        pending,
        current,
        lastAction,
      };
    },
  };
}
