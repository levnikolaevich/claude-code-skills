export const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

export interface BackoffOptions {
  base: number;
  maxAttempts: number;
  cap?: number;
  multiplier?: number;
}

export function exponentialBackoffMs(attempt: number, opts: BackoffOptions): number {
  const mult = opts.multiplier ?? 2;
  const delay = opts.base * mult ** Math.min(attempt, 6);
  return opts.cap ? Math.min(delay, opts.cap) : delay;
}

export type RetryResult<T> =
  | { ok: true; value: T; attempts: number }
  | { ok: false; error: unknown; attempts: number };

export async function retry<T>(
  op: () => Promise<T>,
  opts: { attempts: number; delayMs: number; onFail?: (err: unknown, attempt: number) => void }
): Promise<RetryResult<T>> {
  let lastErr: unknown = null;
  for (let i = 0; i < opts.attempts; i += 1) {
    try {
      const value = await op();
      return { ok: true, value, attempts: i + 1 };
    } catch (error) {
      lastErr = error;
      opts.onFail?.(error, i + 1);
      if (i < opts.attempts - 1) await sleep(opts.delayMs);
    }
  }
  return { ok: false, error: lastErr, attempts: opts.attempts };
}
