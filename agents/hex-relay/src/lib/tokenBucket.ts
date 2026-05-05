/**
 * Per-key sliding-window token bucket. Used by status outbox enqueue to cap
 * L2/L3 noise to N events per W seconds per chat.
 */
export class TokenBucket {
  private readonly windows = new Map<number, number[]>();

  constructor(
    private readonly max: number,
    private readonly windowMs: number
  ) {}

  /**
   * Returns true and records a hit if the key has capacity, false otherwise.
   */
  tryAdd(key: number, now = Date.now()): boolean {
    const cutoff = now - this.windowMs;
    let bucket = this.windows.get(key);
    if (!bucket) {
      bucket = [];
      this.windows.set(key, bucket);
    }
    while (bucket.length > 0 && bucket[0] < cutoff) {
      bucket.shift();
    }
    if (bucket.length >= this.max) return false;
    bucket.push(now);
    return true;
  }
}
