interface Entry<T> {
  value: Promise<T>;
  expiresAt: number;
}

/**
 * Cache em memória com TTL que também deduplica chamadas simultâneas:
 * duas buscas iguais ao mesmo tempo disparam uma só requisição à fonte.
 * Falhas não ficam em cache.
 */
export class TtlCache {
  private entries = new Map<string, Entry<unknown>>();

  constructor(private readonly maxEntries = 500) {}

  async memo<T>(key: string, ttlMs: number, load: () => Promise<T>): Promise<T> {
    const now = Date.now();
    const hit = this.entries.get(key) as Entry<T> | undefined;
    if (hit && hit.expiresAt > now) return hit.value;

    const value = load();
    this.entries.set(key, { value, expiresAt: now + ttlMs });
    this.evict();
    try {
      return await value;
    } catch (err) {
      if (this.entries.get(key)?.value === value) this.entries.delete(key);
      throw err;
    }
  }

  clear() {
    this.entries.clear();
  }

  private evict() {
    if (this.entries.size <= this.maxEntries) return;
    const now = Date.now();
    for (const [key, entry] of this.entries) {
      if (entry.expiresAt <= now) this.entries.delete(key);
    }
    // Map preserva a ordem de inserção: remove as entradas mais antigas.
    while (this.entries.size > this.maxEntries) {
      const oldest = this.entries.keys().next().value;
      if (oldest === undefined) break;
      this.entries.delete(oldest);
    }
  }
}

export const cache = new TtlCache();

export const MINUTE = 60_000;
export const HOUR = 60 * MINUTE;
