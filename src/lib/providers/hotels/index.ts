import { config } from "@/lib/config";
import type { Hotel, HotelOffer, HotelSearchParams, PriceCalendar, SearchResponse } from "@/lib/types";
import { runProviders } from "../run";
import { sortOffers } from "./common";
import { demoHotelProvider } from "./demo";
import { liteApiProvider } from "./liteapi";
import { mergeHotels } from "./merge";
import { serpApiHotelsProvider } from "./serpapi";
import type { HotelProvider } from "./types";
import { xoteloProvider } from "./xotelo";

/** Ordem importa: a primeira fonte que traz um hotel define o card principal. */
const LIVE_PROVIDERS: HotelProvider[] = [serpApiHotelsProvider, liteApiProvider, xoteloProvider];
const ALL_PROVIDERS: HotelProvider[] = [...LIVE_PROVIDERS, demoHotelProvider];

export function hotelProvider(id: string): HotelProvider | undefined {
  return ALL_PROVIDERS.find((p) => p.id === id);
}

export function splitHotelId(id: string): { source: string; nativeId: string } | null {
  const i = id.indexOf(":");
  if (i <= 0 || i === id.length - 1) return null;
  return { source: id.slice(0, i), nativeId: id.slice(i + 1) };
}

export async function searchHotels(params: HotelSearchParams): Promise<SearchResponse<Hotel>> {
  const providers = config.demoMode === "only" ? [demoHotelProvider] : LIVE_PROVIDERS;
  let { results, sources } = await runProviders(
    providers,
    (p) => p.search(params),
    (r) => r.hotels.length,
  );
  let demo = config.demoMode === "only";

  // Só cai para a demonstração quando nenhuma fonte real respondeu (erro ou sem chave).
  if (!demo && config.demoMode === "fallback" && sources.every((s) => !s.ok)) {
    const fallback = await runProviders([demoHotelProvider], (p) => p.search(params), (r) => r.hotels.length);
    results = fallback.results;
    sources = [...sources, ...fallback.sources];
    demo = true;
  }

  return {
    results: mergeHotels(results.map((r) => r.hotels)),
    sources,
    currency: params.currency,
    demo,
    page: params.page,
    hasMore: results.some((r) => r.hasMore),
    generatedAt: new Date().toISOString(),
  };
}

/** Busca, em lote, as ofertas de hotéis com `pendingOfferIds` (IDs no formato `fonte:id`). */
export async function hotelOffers(
  ids: string[],
  params: HotelSearchParams,
): Promise<Record<string, HotelOffer[]>> {
  const bySource = new Map<string, string[]>();
  for (const id of ids) {
    const parts = splitHotelId(id);
    if (!parts) continue;
    bySource.set(parts.source, [...(bySource.get(parts.source) ?? []), parts.nativeId]);
  }

  const out: Record<string, HotelOffer[]> = {};
  await Promise.all(
    [...bySource].map(async ([source, nativeIds]) => {
      const provider = hotelProvider(source);
      if (!provider?.offers || provider.disabledReason()) return;
      try {
        const offers = await provider.offers(nativeIds, params);
        for (const nativeId of nativeIds) out[`${source}:${nativeId}`] = sortOffers(offers[nativeId] ?? []);
      } catch {
        for (const nativeId of nativeIds) out[`${source}:${nativeId}`] = [];
      }
    }),
  );
  return out;
}

export async function hotelDetails(id: string, params: HotelSearchParams): Promise<Hotel | null> {
  const parts = splitHotelId(id);
  const provider = parts && hotelProvider(parts.source);
  if (!parts || !provider || provider.disabledReason()) return null;
  return provider.details(parts.nativeId, params);
}

export async function hotelCalendar(id: string, params: HotelSearchParams): Promise<PriceCalendar | null> {
  const parts = splitHotelId(id);
  const provider = parts && hotelProvider(parts.source);
  if (!parts || !provider?.calendar || provider.disabledReason()) return null;
  try {
    return await provider.calendar(parts.nativeId, params);
  } catch {
    return null;
  }
}

export function hotelProviderSummary() {
  return LIVE_PROVIDERS.map((p) => ({ id: p.id, name: p.name, kind: p.kind, disabledReason: p.disabledReason() }));
}
