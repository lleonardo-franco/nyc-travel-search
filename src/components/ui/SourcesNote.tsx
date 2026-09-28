import { CircleAlert, CircleCheck, CircleDashed, Info } from "lucide-react";
import type { ProviderStatus } from "@/lib/types";

/** Fontes consultadas na busca (estilo "preços de X sites"), com o motivo de cada uma estar fora. */
export function SourcesNote({ sources }: { sources: ProviderStatus[] }) {
  if (!sources.length) return null;
  const ok = sources.filter((s) => s.ok);
  return (
    <details className="group relative text-sm">
      <summary className="inline-flex cursor-pointer items-center gap-1.5 text-slate-600 hover:text-slate-900">
        <Info className="h-4 w-4" aria-hidden />
        {ok.length} de {sources.length} {sources.length === 1 ? "fonte respondeu" : "fontes responderam"}
      </summary>
      <ul className="absolute left-0 z-30 mt-2 w-80 space-y-2 rounded-2xl border border-slate-200 bg-white p-4 shadow-xl">
        {sources.map((s) => (
          <li key={s.id} className="flex items-start gap-2">
            {s.ok ? (
              <CircleCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" aria-hidden />
            ) : s.skipped ? (
              <CircleDashed className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" aria-hidden />
            ) : (
              <CircleAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" aria-hidden />
            )}
            <span className="min-w-0">
              <span className="font-medium text-slate-900">{s.name}</span>
              {s.kind === "mcp" ? <span className="ml-1 rounded bg-violet-100 px-1 text-[10px] font-semibold text-violet-700">MCP</span> : null}
              <span className="block text-xs text-slate-500">
                {s.ok ? `${s.count} resultados em ${(s.ms / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} s` : s.error}
              </span>
            </span>
          </li>
        ))}
      </ul>
    </details>
  );
}

export function DemoBanner() {
  return (
    <div className="rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
      <strong>Dados de demonstração.</strong> Nenhuma fonte real respondeu agora, então mostramos resultados fictícios para você
      conhecer o site. Tente de novo em instantes.
    </div>
  );
}
