/**
 * Promise-chain mutex. Each acquire() returns a release function; subsequent
 * acquire() calls await release before resolving. Used for the global control
 * lane (one tmux mutation at a time) and per-session locks.
 */
export class Mutex {
  private chain: Promise<void> = Promise.resolve();
  private locked = false;
  private currentLabel: string | null = null;

  isLocked(): boolean {
    return this.locked;
  }

  current(): string | null {
    return this.currentLabel;
  }

  async acquire(label = ""): Promise<() => void> {
    let release!: () => void;
    const next = new Promise<void>((resolve) => {
      release = () => {
        this.locked = false;
        this.currentLabel = null;
        resolve();
      };
    });
    const prev = this.chain;
    this.chain = prev.then(() => next);
    await prev;
    this.locked = true;
    this.currentLabel = label;
    return release;
  }

  async run<T>(label: string, fn: () => Promise<T>): Promise<T> {
    const release = await this.acquire(label);
    try {
      return await fn();
    } finally {
      release();
    }
  }
}

/**
 * Map of named mutexes (e.g. per-session). Lazily creates entries.
 */
export class MutexMap {
  private readonly map = new Map<string, Mutex>();

  for(key: string): Mutex {
    let m = this.map.get(key);
    if (!m) {
      m = new Mutex();
      this.map.set(key, m);
    }
    return m;
  }
}
