export class ProviderError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = "ProviderError";
  }
}

interface FetchJsonOptions {
  method?: "GET" | "POST";
  headers?: Record<string, string>;
  body?: unknown;
  timeoutMs?: number;
  signal?: AbortSignal;
}

const USER_AGENT = "nyc-travel-search/0.1 (+https://github.com/lleonardo-franco/nyc-travel-search)";

export async function fetchJson<T>(url: string, opts: FetchJsonOptions = {}): Promise<T> {
  const timeout = AbortSignal.timeout(opts.timeoutMs ?? 15_000);
  const signal = opts.signal ? AbortSignal.any([opts.signal, timeout]) : timeout;
  let res: Response;
  try {
    res = await fetch(url, {
      method: opts.method ?? "GET",
      headers: {
        accept: "application/json",
        "user-agent": USER_AGENT,
        ...(opts.body !== undefined ? { "content-type": "application/json" } : {}),
        ...opts.headers,
      },
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
      signal,
      cache: "no-store",
    });
  } catch (err) {
    if (timeout.aborted) throw new ProviderError("tempo esgotado");
    throw new ProviderError(err instanceof Error ? err.message : "falha de rede");
  }
  if (!res.ok) {
    throw new ProviderError(`HTTP ${res.status}`, res.status);
  }
  return (await res.json()) as T;
}

/** Executa `fn` sobre `items` com no máximo `limit` chamadas simultâneas, preservando a ordem. */
export async function mapLimit<T, R>(
  items: readonly T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i], i);
    }
  });
  await Promise.all(workers);
  return results;
}

export function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err);
}
