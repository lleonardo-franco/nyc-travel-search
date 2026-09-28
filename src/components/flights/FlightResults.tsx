"use client";

import { SlidersHorizontal, X } from "lucide-react";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { DemoBanner, SourcesNote } from "@/components/ui/SourcesNote";
import { formatDuration } from "@/lib/dates";
import {
  activeFlightFilterCount,
  applyFlightFilters,
  EMPTY_FLIGHT_FILTERS,
  FLIGHT_SORTS,
  flightFiltersFromQuery,
  flightFiltersToQuery,
  maxStops,
  sortHighlights,
  type FlightFilters,
  type FlightSort,
} from "@/lib/filters/flights";
import { formatMoney } from "@/lib/format";
import { flightSearchToQuery } from "@/lib/params";
import type { FlightItinerary, FlightSearchParams, SearchResponse } from "@/lib/types";
import { FlightCard, FlightCardSkeleton } from "./FlightCard";
import { FlightFiltersPanel } from "./FlightFiltersPanel";

const PAGE = 15;
const TABS: FlightSort[] = ["best", "price", "duration"];

type State =
  | { status: "loading" }
  | { status: "error"; error: string }
  | { status: "ready"; data: SearchResponse<FlightItinerary> };

/** Resultados de voos: abas Melhor/Mais barato/Mais rápido, filtros na URL e cards expansíveis. */
export function FlightResults({ params }: { params: FlightSearchParams }) {
  const pathname = usePathname();
  const sp = useSearchParams();
  const filters = useMemo(() => flightFiltersFromQuery(new URLSearchParams(sp.toString())), [sp]);
  const [state, setState] = useState<State>({ status: "loading" });
  const [drawer, setDrawer] = useState(false);
  const [shown, setShown] = useState(PAGE);
  const query = flightSearchToQuery(params);

  useEffect(() => {
    let alive = true;
    fetch(`/api/flights?${query}`)
      .then(async (res) => {
        const body = await res.json();
        if (!res.ok) throw new Error(body.error ?? "Não foi possível buscar os voos.");
        return body as SearchResponse<FlightItinerary>;
      })
      .then((data) => alive && setState({ status: "ready", data }))
      .catch((err: Error) => alive && setState({ status: "error", error: err.message }));
    return () => {
      alive = false;
    };
  }, [query]);

  const setFilters = (next: FlightFilters) => {
    const q = flightFiltersToQuery(next, new URLSearchParams(window.location.search));
    window.history.replaceState(null, "", `${pathname}?${q}`);
  };

  const all = useMemo(() => (state.status === "ready" ? state.data.results : []), [state]);
  const visible = useMemo(() => applyFlightFilters(all, filters), [all, filters]);
  const highlights = useMemo(() => sortHighlights(applyFlightFilters(all, { ...filters, sort: "best" })), [all, filters]);
  const passengers = params.adults + params.children + params.infants;
  const activeCount = activeFlightFilterCount(filters);

  const badgesFor = (f: FlightItinerary) =>
    [
      highlights.price?.id === f.id ? "Mais barato" : null,
      highlights.duration?.id === f.id ? "Mais rápido" : null,
      maxStops(f) === 0 ? "Voo direto" : null,
      f.baggage?.checkedBag ? "Mala despachada inclusa" : null,
    ].filter((b): b is string => Boolean(b));

  const panel = (
    <FlightFiltersPanel flights={all} filters={filters} onChange={setFilters} currency={params.currency} roundTrip={Boolean(params.returnDate)} />
  );

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-6">
      {state.status === "ready" && state.data.demo ? (
        <div className="mb-4">
          <DemoBanner />
        </div>
      ) : null}
      <div className="grid gap-6 lg:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="hidden lg:block">
          <div className="rounded-2xl border border-slate-200 bg-white px-4">
            <div className="flex items-center justify-between border-b border-slate-200 py-3">
              <span className="font-semibold text-slate-900">Filtrar por</span>
              {activeCount ? (
                <button type="button" onClick={() => setFilters({ ...EMPTY_FLIGHT_FILTERS, sort: filters.sort })} className="text-sm text-blue-700 hover:underline">
                  Limpar ({activeCount})
                </button>
              ) : null}
            </div>
            {state.status === "ready" ? panel : <div className="h-96 animate-pulse" />}
          </div>
        </aside>

        <main className="min-w-0 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-xl font-bold text-slate-900">
                {state.status === "loading"
                  ? "Buscando voos para Nova York…"
                  : state.status === "ready"
                    ? `${visible.length} ${visible.length === 1 ? "voo" : "voos"} para Nova York`
                    : "Voos para Nova York"}
              </h1>
              <div className="mt-1 flex flex-wrap items-center gap-x-4 text-sm text-slate-500">
                <span>Preço total para {passengers} {passengers === 1 ? "passageiro" : "passageiros"}, com taxas</span>
                {state.status === "ready" ? <SourcesNote sources={state.data.sources} /> : null}
              </div>
            </div>
            <button
              type="button"
              onClick={() => setDrawer(true)}
              className="inline-flex h-10 items-center gap-2 rounded-full border border-slate-300 bg-white px-4 text-sm font-medium lg:hidden"
            >
              <SlidersHorizontal className="h-4 w-4" aria-hidden /> Filtros{activeCount ? ` (${activeCount})` : ""}
            </button>
          </div>

          <div className="grid grid-cols-3 overflow-hidden rounded-2xl border border-slate-200 bg-white" role="tablist" aria-label="Ordenar voos">
            {TABS.map((tab) => {
              const top = highlights[tab];
              const active = filters.sort === tab;
              return (
                <button
                  key={tab}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setFilters({ ...filters, sort: tab })}
                  className={`border-b-4 px-3 py-3 text-left transition ${active ? "border-blue-600 bg-blue-50/60" : "border-transparent hover:bg-slate-50"}`}
                >
                  <span className={`block text-sm font-semibold ${active ? "text-blue-700" : "text-slate-900"}`}>{FLIGHT_SORTS[tab]}</span>
                  <span className="block truncate text-xs text-slate-500">
                    {top ? `${formatMoney(top.price, top.currency)} · ${formatDuration(top.totalDurationMinutes / (top.inbound ? 2 : 1))}${top.inbound ? " média" : ""}` : "—"}
                  </span>
                </button>
              );
            })}
          </div>

          {state.status === "loading" ? (
            <div className="space-y-4">
              <p className="flex items-center gap-2 text-sm text-slate-500">
                <span className="h-2 w-2 animate-pulse rounded-full bg-violet-600" /> Consultando o servidor MCP da Kiwi.com e outras fontes…
              </p>
              {Array.from({ length: 4 }, (_, i) => (
                <FlightCardSkeleton key={i} />
              ))}
            </div>
          ) : state.status === "error" ? (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-center text-rose-900">{state.error}</div>
          ) : visible.length ? (
            <>
              <div className="space-y-4">
                {visible.slice(0, shown).map((f) => (
                  <FlightCard key={f.id} flight={f} passengers={passengers} badges={badgesFor(f)} />
                ))}
              </div>
              {visible.length > shown ? (
                <div className="text-center">
                  <button type="button" onClick={() => setShown(shown + PAGE)} className="rounded-full border border-slate-300 bg-white px-6 py-3 text-sm font-semibold shadow-sm hover:border-slate-500">
                    Mostrar mais voos ({visible.length - shown})
                  </button>
                </div>
              ) : null}
            </>
          ) : (
            <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center">
              <p className="font-medium text-slate-900">{all.length ? "Nenhum voo com esses filtros." : "Nenhum voo encontrado para essa busca."}</p>
              {all.length ? (
                <button type="button" onClick={() => setFilters({ ...EMPTY_FLIGHT_FILTERS, sort: filters.sort })} className="mt-3 text-sm font-medium text-blue-700 hover:underline">
                  Limpar filtros
                </button>
              ) : (
                <p className="mt-2 text-sm text-slate-500">Tente outras datas, marque ± dias de flexibilidade ou outro aeroporto de origem.</p>
              )}
            </div>
          )}
        </main>
      </div>

      {drawer ? (
        <div className="fixed inset-0 z-50 flex">
          <button type="button" aria-label="Fechar filtros" className="flex-1 bg-slate-900/40" onClick={() => setDrawer(false)} />
          <div className="flex h-full w-full max-w-sm flex-col bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
              <span className="font-semibold">Filtros</span>
              <button type="button" onClick={() => setDrawer(false)} aria-label="Fechar">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-4">{panel}</div>
            <div className="border-t border-slate-200 p-4">
              <button type="button" onClick={() => setDrawer(false)} className="w-full rounded-full bg-blue-600 py-2.5 text-sm font-semibold text-white">
                Ver {visible.length} voos
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
