import { config } from "@/lib/config";
import type { FlightItinerary, FlightSearchParams, SearchResponse } from "@/lib/types";
import { runProviders } from "../run";
import { demoFlightProvider } from "./demo";
import { kiwiMcpProvider } from "./kiwi-mcp";
import { serpApiFlightsProvider } from "./serpapi";
import type { FlightProvider } from "./types";

const LIVE_PROVIDERS: FlightProvider[] = [kiwiMcpProvider, serpApiFlightsProvider];

/** Mesmo voo vindo de duas fontes: mesmos números de voo e horários. Fica o mais barato. */
function flightKey(it: FlightItinerary): string {
  const legs = [it.outbound, ...(it.inbound ? [it.inbound] : [])];
  return legs.flatMap((l) => l.segments.map((s) => `${s.flightNumber ?? s.carrier}@${s.departureTime}`)).join("|");
}

export function dedupeFlights(lists: FlightItinerary[][]): FlightItinerary[] {
  const best = new Map<string, FlightItinerary>();
  for (const it of lists.flat()) {
    const key = flightKey(it);
    const current = best.get(key);
    if (!current || it.price < current.price) best.set(key, it);
  }
  return [...best.values()].sort((a, b) => a.price - b.price);
}

export async function searchFlights(params: FlightSearchParams): Promise<SearchResponse<FlightItinerary>> {
  const providers = config.demoMode === "only" ? [demoFlightProvider] : LIVE_PROVIDERS;
  let { results, sources } = await runProviders(providers, (p) => p.search(params), (r) => r.length);
  let demo = config.demoMode === "only";

  if (!demo && config.demoMode === "fallback" && sources.every((s) => !s.ok)) {
    const fallback = await runProviders([demoFlightProvider], (p) => p.search(params), (r) => r.length);
    results = fallback.results;
    sources = [...sources, ...fallback.sources];
    demo = true;
  }

  return {
    results: dedupeFlights(results),
    sources,
    currency: params.currency,
    demo,
    page: 1,
    hasMore: false,
    generatedAt: new Date().toISOString(),
  };
}

export function flightProviderSummary() {
  return LIVE_PROVIDERS.map((p) => ({ id: p.id, name: p.name, kind: p.kind, disabledReason: p.disabledReason() }));
}
