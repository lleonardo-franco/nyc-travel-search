import { errorMessage } from "@/lib/http";
import type { ProviderKind, ProviderStatus } from "@/lib/types";

interface ProviderLike {
  id: string;
  name: string;
  kind: ProviderKind;
  disabledReason(): string | null;
}

/**
 * Consulta todas as fontes ativas em paralelo. Uma fonte com erro não derruba a busca:
 * vira um status com `ok: false` que a UI mostra ao usuário.
 */
export async function runProviders<P extends ProviderLike, R>(
  providers: readonly P[],
  run: (provider: P) => Promise<R>,
  count: (result: R) => number,
): Promise<{ results: R[]; sources: ProviderStatus[] }> {
  const sources: ProviderStatus[] = [];
  const active: P[] = [];
  for (const p of providers) {
    const reason = p.disabledReason();
    if (reason) sources.push({ id: p.id, name: p.name, kind: p.kind, ok: false, count: 0, ms: 0, skipped: true, error: reason });
    else active.push(p);
  }

  const settled = await Promise.all(
    active.map(async (p) => {
      const started = Date.now();
      try {
        const result = await run(p);
        const status: ProviderStatus = { id: p.id, name: p.name, kind: p.kind, ok: true, count: count(result), ms: Date.now() - started };
        return { result, status };
      } catch (err) {
        const status: ProviderStatus = {
          id: p.id, name: p.name, kind: p.kind, ok: false, count: 0, ms: Date.now() - started, error: errorMessage(err),
        };
        return { result: undefined, status };
      }
    }),
  );

  const results: R[] = [];
  for (const s of settled) {
    sources.push(s.status);
    if (s.result !== undefined) results.push(s.result);
  }
  // Ordem estável na UI: fontes ativas primeiro, na ordem de registro.
  sources.sort((a, b) => Number(Boolean(a.skipped)) - Number(Boolean(b.skipped)));
  return { results, sources };
}
