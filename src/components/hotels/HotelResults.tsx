"use client";

import { List, Map as MapIcon, SlidersHorizontal, X } from "lucide-react";
import dynamic from "next/dynamic";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { DemoBanner, SourcesNote } from "@/components/ui/SourcesNote";
import {
  activeHotelFilterCount,
  applyHotelFilters,
  EMPTY_HOTEL_FILTERS,
  HOTEL_SORTS,
  hotelFiltersFromQuery,
  hotelFiltersToQuery,
  type HotelFilters,
  type HotelSort,
} from "@/lib/filters/hotels";
import { formatNumber } from "@/lib/format";
import { hotelSearchToQuery } from "@/lib/params";
import type { Hotel, HotelOffer, HotelSearchParams, ProviderStatus, SearchResponse } from "@/lib/types";
import { HotelCard, HotelCardSkeleton } from "./HotelCard";
import { HotelFiltersPanel } from "./HotelFiltersPanel";
import { useFavorites } from "./useFavorites";

const HotelsMap = dynamic(() => import("./HotelsMap"), {
  ssr: false,
  loading: () => <div className="h-full w-full animate-pulse bg-slate-200" />,
});

const OFFER_BATCH = 6;
const OFFER_WORKERS = 3;

interface State {
  status: "loading" | "ready" | "error";
  hotels: Hotel[];
  sources: ProviderStatus[];
  demo: boolean;
  page: number;
  hasMore: boolean;
  loadingMore: boolean;
  error?: string;
}

async function fetchHotels(params: HotelSearchParams, page: number): Promise<SearchResponse<Hotel>> {
  const res = await fetch(`/api/hotels?${hotelSearchToQuery({ ...params, page })}`);
  const body = await res.json();
  if (!res.ok) throw new Error(body.error ?? "Não foi possível buscar os hotéis.");
  return body as SearchResponse<Hotel>;
}

function applyOffers(h: Hotel, batch: string[], offers: Record<string, HotelOffer[]>): Hotel {
  const pending = h.pendingOfferIds ?? [];
  const arrived = pending.filter((id) => batch.includes(id));
  if (!arrived.length) return h;
  return {
    ...h,
    offers: [...h.offers, ...arrived.flatMap((id) => offers[id] ?? [])].sort((a, b) => a.pricePerNight - b.pricePerNight),
    pendingOfferIds: pending.filter((id) => !batch.includes(id)),
  };
}

/**
 * Resultados de hotéis: carrega a lista, depois compara preços em lotes (os cards
 * vão sendo preenchidos), e aplica filtros/ordenação no navegador, guardados na URL.
 * O componente é remontado (key) a cada nova busca.
 */
export function HotelResults({ params }: { params: HotelSearchParams }) {
  const pathname = usePathname();
  const sp = useSearchParams();
  const filters = useMemo(() => hotelFiltersFromQuery(new URLSearchParams(sp.toString())), [sp]);
  const view = sp.get("visao") === "mapa" ? "map" : "list";
  const { isFavorite, toggle } = useFavorites();

  const [state, setState] = useState<State>({
    status: "loading",
    hotels: [],
    sources: [],
    demo: false,
    page: 1,
    hasMore: false,
    loadingMore: false,
  });
  const [drawer, setDrawer] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const alive = useRef(true);
  const requested = useRef(new Set<string>());
  const searchQuery = hotelSearchToQuery({ ...params, page: 1 });

  const updateUrl = (mutate: (q: URLSearchParams) => URLSearchParams) => {
    const q = mutate(new URLSearchParams(window.location.search));
    window.history.replaceState(null, "", `${pathname}?${q}`);
  };
  const setFilters = (next: HotelFilters) => updateUrl((q) => hotelFiltersToQuery(next, q));
  const setView = (v: "list" | "map") =>
    updateUrl((q) => {
      if (v === "map") q.set("visao", "mapa");
      else q.delete("visao");
      return q;
    });

  // Página 1.
  useEffect(() => {
    alive.current = true;
    fetchHotels(params, 1)
      .then((data) => {
        if (!alive.current) return;
        setState((s) => ({
          ...s,
          status: "ready",
          hotels: data.results,
          sources: data.sources,
          demo: data.demo,
          hasMore: data.hasMore,
        }));
      })
      .catch((err: Error) => alive.current && setState((s) => ({ ...s, status: "error", error: err.message })));
    return () => {
      alive.current = false;
    };
    // A busca é identificada por searchQuery; o componente é remontado quando ela muda.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery]);

  // Comparação de preços em lotes para os hotéis que ainda não têm ofertas.
  useEffect(() => {
    const ids = state.hotels.flatMap((h) => h.pendingOfferIds ?? []).filter((id) => !requested.current.has(id));
    if (!ids.length) return;
    ids.forEach((id) => requested.current.add(id));
    const batches: string[][] = [];
    for (let i = 0; i < ids.length; i += OFFER_BATCH) batches.push(ids.slice(i, i + OFFER_BATCH));
    let cursor = 0;
    const worker = async () => {
      while (cursor < batches.length && alive.current) {
        const batch = batches[cursor++];
        let offers: Record<string, HotelOffer[]> = {};
        try {
          const q = new URLSearchParams(searchQuery);
          q.set("ids", batch.join(","));
          const res = await fetch(`/api/hotels/offers?${q}`);
          if (res.ok) offers = (await res.json()).offers ?? {};
        } catch {
          // sem ofertas para este lote: os cards mostram a faixa de preço típica
        }
        if (!alive.current) return;
        setState((s) => ({ ...s, hotels: s.hotels.map((h) => applyOffers(h, batch, offers)) }));
      }
    };
    for (let i = 0; i < OFFER_WORKERS; i++) void worker();
  }, [state.hotels, searchQuery]);

  const loadMore = async () => {
    setState((s) => ({ ...s, loadingMore: true }));
    try {
      const data = await fetchHotels(params, state.page + 1);
      setState((s) => {
        const seen = new Set(s.hotels.map((h) => h.id));
        return {
          ...s,
          hotels: [...s.hotels, ...data.results.filter((h) => !seen.has(h.id))],
          page: s.page + 1,
          hasMore: data.hasMore,
          loadingMore: false,
        };
      });
    } catch {
      setState((s) => ({ ...s, loadingMore: false }));
    }
  };

  const visible = useMemo(() => applyHotelFilters(state.hotels, filters), [state.hotels, filters]);
  const pendingCount = state.hotels.filter((h) => h.pendingOfferIds?.length).length;
  const activeCount = activeHotelFilterCount(filters);

  const selectFromMap = (id: string) => {
    setActiveId(id);
    document.getElementById(`hotel-${id}`)?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  };

  const panel = (
    <HotelFiltersPanel hotels={state.hotels} filters={filters} onChange={setFilters} currency={params.currency} />
  );

  const toolbar = (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h1 className="text-xl font-bold text-slate-900">
          {state.status === "loading"
            ? "Buscando hotéis em Nova York…"
            : `${formatNumber(visible.length)} ${visible.length === 1 ? "hotel" : "hotéis"} em Nova York`}
        </h1>
        <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-slate-500">
          {pendingCount > 0 ? (
            <span className="inline-flex items-center gap-2">
              <span className="h-2 w-2 animate-pulse rounded-full bg-blue-600" />
              Comparando preços de {pendingCount} {pendingCount === 1 ? "hotel" : "hotéis"}…
            </span>
          ) : state.status === "ready" ? (
            <span>Preços por noite, com base nas suas datas</span>
          ) : null}
          <SourcesNote sources={state.sources} />
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setDrawer(true)}
          className={`inline-flex h-10 items-center gap-2 rounded-full border border-slate-300 bg-white px-4 text-sm font-medium ${
            view === "list" ? "lg:hidden" : ""
          }`}
        >
          <SlidersHorizontal className="h-4 w-4" aria-hidden />
          Filtros{activeCount ? ` (${activeCount})` : ""}
        </button>
        <label className="flex h-10 items-center gap-2 rounded-full border border-slate-300 bg-white pl-4 pr-2 text-sm">
          <span className="hidden text-slate-500 sm:inline">Ordenar:</span>
          <select
            value={filters.sort}
            onChange={(e) => setFilters({ ...filters, sort: e.target.value as HotelSort })}
            className="bg-transparent font-medium text-slate-900 outline-none"
          >
            {Object.entries(HOTEL_SORTS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <div className="flex rounded-full border border-slate-300 bg-white p-0.5" role="group" aria-label="Visualização">
          {(["list", "map"] as const).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setView(v)}
              aria-pressed={view === v}
              className={`inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-sm font-medium ${
                view === v ? "bg-slate-900 text-white" : "text-slate-600"
              }`}
            >
              {v === "list" ? <List className="h-4 w-4" aria-hidden /> : <MapIcon className="h-4 w-4" aria-hidden />}
              <span className="max-sm:sr-only">{v === "list" ? "Lista" : "Mapa"}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );

  const list = (compact: boolean) => (
    <div className={compact ? "grid gap-4 sm:grid-cols-2" : "space-y-4"}>
      {state.status === "loading"
        ? Array.from({ length: 4 }, (_, i) => <HotelCardSkeleton key={i} />)
        : visible.map((h) => (
            <HotelCard
              key={h.id}
              hotel={h}
              params={params}
              landmark={filters.landmark}
              vendors={filters.vendors}
              favorite={isFavorite(h.id)}
              onToggleFavorite={() => toggle(h.id)}
              onHover={setActiveId}
              highlighted={activeId === h.id && view === "map"}
              compact={compact}
            />
          ))}
    </div>
  );

  const footer =
    state.status === "error" ? (
      <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-center text-rose-900">
        <p className="font-medium">{state.error}</p>
        <button type="button" onClick={() => window.location.reload()} className="mt-3 rounded-full bg-rose-600 px-4 py-2 text-sm font-semibold text-white">
          Tentar de novo
        </button>
      </div>
    ) : state.status === "ready" && !visible.length ? (
      <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center">
        <p className="font-medium text-slate-900">Nenhum hotel com esses filtros.</p>
        <button type="button" onClick={() => setFilters({ ...EMPTY_HOTEL_FILTERS, sort: filters.sort })} className="mt-3 text-sm font-medium text-blue-700 hover:underline">
          Limpar filtros
        </button>
      </div>
    ) : state.hasMore ? (
      <div className="text-center">
        <button
          type="button"
          onClick={loadMore}
          disabled={state.loadingMore}
          className="rounded-full border border-slate-300 bg-white px-6 py-3 text-sm font-semibold text-slate-900 shadow-sm hover:border-slate-500 disabled:opacity-60"
        >
          {state.loadingMore ? "Carregando…" : "Carregar mais hotéis"}
        </button>
      </div>
    ) : null;

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-6">
      {state.demo ? (
        <div className="mb-4">
          <DemoBanner />
        </div>
      ) : null}

      {view === "list" ? (
        <div className="grid gap-6 lg:grid-cols-[280px_minmax(0,1fr)]">
          <aside className="hidden lg:block">
            <button
              type="button"
              onClick={() => setView("map")}
              className="relative mb-4 block h-28 w-full overflow-hidden rounded-2xl border border-slate-200 bg-[url('/map-preview.svg')] bg-cover bg-center"
            >
              <span className="absolute inset-0 grid place-items-center">
                <span className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-semibold text-slate-900 shadow">
                  <MapIcon className="h-4 w-4" aria-hidden /> Ver no mapa
                </span>
              </span>
            </button>
            <div className="rounded-2xl border border-slate-200 bg-white px-4">
              <div className="flex items-center justify-between border-b border-slate-200 py-3">
                <span className="font-semibold text-slate-900">Filtrar por</span>
                {activeCount ? (
                  <button type="button" onClick={() => setFilters({ ...EMPTY_HOTEL_FILTERS, sort: filters.sort })} className="text-sm text-blue-700 hover:underline">
                    Limpar ({activeCount})
                  </button>
                ) : null}
              </div>
              {panel}
            </div>
          </aside>
          <main className="min-w-0 space-y-4">
            {toolbar}
            {list(false)}
            {footer}
          </main>
        </div>
      ) : (
        <div className="space-y-4">
          {toolbar}
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
            <div className="order-2 min-w-0 space-y-4 lg:order-1">
              {list(true)}
              {footer}
            </div>
            <div className="order-1 h-[55vh] overflow-hidden rounded-2xl border border-slate-200 lg:sticky lg:top-20 lg:order-2 lg:h-[calc(100vh-6.5rem)]">
              <HotelsMap hotels={visible} currency={params.currency} activeId={activeId} onSelect={selectFromMap} vendors={filters.vendors} />
            </div>
          </div>
        </div>
      )}

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
            <div className="flex gap-2 border-t border-slate-200 p-4">
              <button type="button" onClick={() => setFilters({ ...EMPTY_HOTEL_FILTERS, sort: filters.sort })} className="flex-1 rounded-full border border-slate-300 py-2.5 text-sm font-medium">
                Limpar
              </button>
              <button type="button" onClick={() => setDrawer(false)} className="flex-1 rounded-full bg-blue-600 py-2.5 text-sm font-semibold text-white">
                Ver {visible.length} hotéis
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
