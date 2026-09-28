import { hourOf } from "@/lib/dates";
import type { FlightItinerary } from "@/lib/types";
import { countBy, listParam, numParam, type Facet } from "./common";

export const FLIGHT_SORTS = {
  best: "Melhor opção",
  price: "Mais barato",
  duration: "Mais rápido",
  departure: "Partida mais cedo",
} as const;
export type FlightSort = keyof typeof FLIGHT_SORTS;

export const TIME_WINDOWS = {
  madrugada: { label: "Madrugada (0h–6h)", from: 0, to: 6 },
  manha: { label: "Manhã (6h–12h)", from: 6, to: 12 },
  tarde: { label: "Tarde (12h–18h)", from: 12, to: 18 },
  noite: { label: "Noite (18h–24h)", from: 18, to: 24 },
} as const;
export type TimeWindow = keyof typeof TIME_WINDOWS;

export interface FlightFilters {
  /** 0 = direto, 1 = 1 parada, 2 = 2 ou mais. */
  stops: number[];
  airlines: string[];
  priceMax?: number;
  maxDurationHours?: number;
  departWindows: TimeWindow[];
  returnWindows: TimeWindow[];
  arrivalAirports: string[];
  checkedBag: boolean;
  sources: string[];
  sort: FlightSort;
}

export const EMPTY_FLIGHT_FILTERS: FlightFilters = {
  stops: [],
  airlines: [],
  departWindows: [],
  returnWindows: [],
  arrivalAirports: [],
  checkedBag: false,
  sources: [],
  sort: "best",
};

export function maxStops(it: FlightItinerary): number {
  return Math.max(it.outbound.stops, it.inbound?.stops ?? 0);
}

function inWindows(isoLocal: string, windows: TimeWindow[]): boolean {
  if (!windows.length) return true;
  const h = hourOf(isoLocal);
  return windows.some((w) => h >= TIME_WINDOWS[w].from && h < TIME_WINDOWS[w].to);
}

/**
 * "Melhor opção": equilíbrio entre preço e duração (normalizados pelo mínimo da busca),
 * com penalidade por conexões — parecido com o "Best" dos buscadores de voos.
 */
function bestScore(it: FlightItinerary, minPrice: number, minDuration: number): number {
  return it.price / minPrice + (0.7 * it.totalDurationMinutes) / minDuration + 0.15 * maxStops(it);
}

export function applyFlightFilters(flights: FlightItinerary[], f: FlightFilters): FlightItinerary[] {
  const filtered = flights.filter((it) => {
    if (f.stops.length && !f.stops.includes(Math.min(maxStops(it), 2))) return false;
    if (f.airlines.length && !it.airlines.some((a) => f.airlines.includes(a))) return false;
    if (f.priceMax != null && it.price > f.priceMax) return false;
    if (f.maxDurationHours != null) {
      const longest = Math.max(it.outbound.durationMinutes, it.inbound?.durationMinutes ?? 0);
      if (longest > f.maxDurationHours * 60) return false;
    }
    if (!inWindows(it.outbound.departureTime, f.departWindows)) return false;
    if (it.inbound && !inWindows(it.inbound.departureTime, f.returnWindows)) return false;
    if (f.arrivalAirports.length && !f.arrivalAirports.includes(it.outbound.to)) return false;
    if (f.checkedBag && !(it.baggage && it.baggage.checkedBag > 0)) return false;
    if (f.sources.length && !f.sources.includes(it.source)) return false;
    return true;
  });

  const minPrice = Math.min(...filtered.map((i) => i.price), Infinity) || 1;
  const minDuration = Math.min(...filtered.map((i) => i.totalDurationMinutes), Infinity) || 1;
  const sorters: Record<FlightSort, (a: FlightItinerary, b: FlightItinerary) => number> = {
    best: (a, b) => bestScore(a, minPrice, minDuration) - bestScore(b, minPrice, minDuration),
    price: (a, b) => a.price - b.price || a.totalDurationMinutes - b.totalDurationMinutes,
    duration: (a, b) => a.totalDurationMinutes - b.totalDurationMinutes || a.price - b.price,
    departure: (a, b) => a.outbound.departureTime.localeCompare(b.outbound.departureTime) || a.price - b.price,
  };
  return filtered.sort(sorters[f.sort]);
}

/** Resumo mostrado nas abas de ordenação (ex.: "Mais barato · R$ 4.861"). */
export function sortHighlights(flights: FlightItinerary[]): Record<FlightSort, FlightItinerary | undefined> {
  const pick = (sort: FlightSort) => applyFlightFilters(flights, { ...EMPTY_FLIGHT_FILTERS, sort })[0];
  return { best: pick("best"), price: pick("price"), duration: pick("duration"), departure: pick("departure") };
}

export interface FlightFacets {
  price: { min: number; max: number } | null;
  maxDurationHours: number | null;
  airlines: Facet[];
  arrivalAirports: Facet[];
  stops: Facet[];
  sources: Facet[];
}


export function flightFacets(flights: FlightItinerary[]): FlightFacets {
  const prices = flights.map((f) => f.price);
  const durations = flights.map((f) => Math.max(f.outbound.durationMinutes, f.inbound?.durationMinutes ?? 0));
  return {
    price: prices.length ? { min: Math.floor(Math.min(...prices)), max: Math.ceil(Math.max(...prices)) } : null,
    maxDurationHours: durations.length ? Math.ceil(Math.max(...durations) / 60) : null,
    airlines: countBy(flights.flatMap((f) => f.airlines)),
    arrivalAirports: countBy(flights.map((f) => f.outbound.to)),
    stops: countBy(flights.map((f) => String(Math.min(maxStops(f), 2)))).sort((a, b) => Number(a.value) - Number(b.value)),
    sources: countBy(flights.map((f) => f.source)),
  };
}

// ---------------------------------------------------------------------------
// Filtros <-> URL
// ---------------------------------------------------------------------------

const list = listParam;
const num = numParam;
const windows = (v: string | null) => list(v).filter((w): w is TimeWindow => w in TIME_WINDOWS);

export function flightFiltersFromQuery(sp: URLSearchParams): FlightFilters {
  const sort = sp.get("ordem") as FlightSort | null;
  return {
    stops: list(sp.get("paradas")).map(Number).filter((n) => [0, 1, 2].includes(n)),
    airlines: list(sp.get("cias")),
    priceMax: num(sp.get("pmax")),
    maxDurationHours: num(sp.get("duracao")),
    departWindows: windows(sp.get("hida")),
    returnWindows: windows(sp.get("hvolta")),
    arrivalAirports: list(sp.get("chegada")),
    checkedBag: sp.get("mala") === "1",
    sources: list(sp.get("fontes")),
    sort: sort && sort in FLIGHT_SORTS ? sort : "best",
  };
}

export function flightFiltersToQuery(f: FlightFilters, sp: URLSearchParams): URLSearchParams {
  const out = new URLSearchParams(sp);
  const set = (k: string, v: string | number | undefined) => {
    if (v === undefined || v === "") out.delete(k);
    else out.set(k, String(v));
  };
  set("paradas", f.stops.join("|"));
  set("cias", f.airlines.join("|"));
  set("pmax", f.priceMax);
  set("duracao", f.maxDurationHours);
  set("hida", f.departWindows.join("|"));
  set("hvolta", f.returnWindows.join("|"));
  set("chegada", f.arrivalAirports.join("|"));
  set("mala", f.checkedBag ? 1 : undefined);
  set("fontes", f.sources.join("|"));
  set("ordem", f.sort === "best" ? undefined : f.sort);
  return out;
}

export function activeFlightFilterCount(f: FlightFilters): number {
  return [
    f.stops.length > 0,
    f.airlines.length > 0,
    f.priceMax != null,
    f.maxDurationHours != null,
    f.departWindows.length > 0,
    f.returnWindows.length > 0,
    f.arrivalAirports.length > 0,
    f.checkedBag,
    f.sources.length > 0,
  ].filter(Boolean).length;
}
