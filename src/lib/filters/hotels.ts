import { distanceKm, LANDMARK_IDS, LANDMARKS, type LandmarkId } from "@/lib/geo";
import type { Hotel, HotelOffer } from "@/lib/types";
import { countBy, listParam, numParam, type Facet } from "./common";

export type { Facet } from "./common";

export const HOTEL_SORTS = {
  recommended: "Recomendados",
  price_asc: "Menor preço",
  price_desc: "Maior preço",
  rating: "Melhor avaliação",
  reviews: "Mais avaliados",
  distance: "Mais perto",
} as const;
export type HotelSort = keyof typeof HOTEL_SORTS;

export interface HotelFilters {
  q: string;
  priceMin?: number;
  priceMax?: number;
  minRating?: number;
  stars: number[];
  neighborhoods: string[];
  types: string[];
  vendors: string[];
  labels: string[];
  landmark: LandmarkId;
  maxDistanceKm?: number;
  onlyWithPrice: boolean;
  sort: HotelSort;
}

export const EMPTY_HOTEL_FILTERS: HotelFilters = {
  q: "",
  stars: [],
  neighborhoods: [],
  types: [],
  vendors: [],
  labels: [],
  landmark: "times-square",
  onlyWithPrice: false,
  sort: "recommended",
};

/** Oferta mais barata, respeitando o filtro de sites quando houver. */
export function bestOffer(hotel: Hotel, vendors: string[] = []): HotelOffer | undefined {
  const offers = vendors.length ? hotel.offers.filter((o) => vendors.includes(o.vendor)) : hotel.offers;
  return offers[0];
}

/** Preço por noite usado para filtrar/ordenar: melhor oferta ou, na falta dela, a estimativa. */
export function nightlyPrice(hotel: Hotel, vendors: string[] = []): number | undefined {
  return bestOffer(hotel, vendors)?.pricePerNight ?? (vendors.length ? undefined : hotel.priceEstimate?.min);
}

export function distanceTo(hotel: Hotel, landmark: LandmarkId): number | undefined {
  return hotel.location ? distanceKm(hotel.location, LANDMARKS[landmark]) : undefined;
}

function normalize(text: string): string {
  return text.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
}

/**
 * Pontuação "recomendados": nota ponderada pelo volume de avaliações (média bayesiana)
 * com leve bônus para preço abaixo da mediana da busca.
 */
function recommendedScore(hotel: Hotel, medianPrice: number | undefined, vendors: string[]): number {
  const rating = hotel.rating ?? 3.5;
  const count = hotel.reviewCount ?? 0;
  const bayes = (rating * count + 4 * 50) / (count + 50);
  const price = nightlyPrice(hotel, vendors);
  const priceBonus = price && medianPrice ? Math.max(-0.4, Math.min(0.4, (medianPrice - price) / medianPrice)) : 0;
  return bayes + priceBonus;
}

function median(values: number[]): number | undefined {
  if (!values.length) return undefined;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}

export function applyHotelFilters(hotels: Hotel[], f: HotelFilters): Hotel[] {
  const q = normalize(f.q.trim());
  const filtered = hotels.filter((h) => {
    if (q && !normalize(`${h.name} ${h.neighborhood ?? ""} ${h.address ?? ""}`).includes(q)) return false;
    const price = nightlyPrice(h, f.vendors);
    if (f.onlyWithPrice && !bestOffer(h, f.vendors)) return false;
    if (f.vendors.length && !bestOffer(h, f.vendors) && !h.pendingOfferIds?.length) return false;
    if (f.priceMin != null && (price == null || price < f.priceMin)) return false;
    if (f.priceMax != null && (price == null || price > f.priceMax)) return false;
    if (f.minRating != null && (h.rating ?? 0) < f.minRating) return false;
    if (f.stars.length && !f.stars.includes(Math.floor(h.stars ?? 0))) return false;
    if (f.neighborhoods.length && !f.neighborhoods.includes(h.neighborhood ?? "")) return false;
    if (f.types.length && !f.types.includes(h.type ?? "")) return false;
    if (f.labels.length && !f.labels.every((l) => h.labels.includes(l) || h.amenities.includes(l))) return false;
    if (f.maxDistanceKm != null) {
      const km = distanceTo(h, f.landmark);
      if (km == null || km > f.maxDistanceKm) return false;
    }
    return true;
  });

  const med = median(filtered.flatMap((h) => nightlyPrice(h, f.vendors) ?? []));
  const priceOr = (h: Hotel, fallback: number) => nightlyPrice(h, f.vendors) ?? fallback;
  const sorters: Record<HotelSort, (a: Hotel, b: Hotel) => number> = {
    recommended: (a, b) => recommendedScore(b, med, f.vendors) - recommendedScore(a, med, f.vendors),
    price_asc: (a, b) => priceOr(a, Infinity) - priceOr(b, Infinity),
    price_desc: (a, b) => priceOr(b, -Infinity) - priceOr(a, -Infinity),
    rating: (a, b) => (b.rating ?? 0) - (a.rating ?? 0) || (b.reviewCount ?? 0) - (a.reviewCount ?? 0),
    reviews: (a, b) => (b.reviewCount ?? 0) - (a.reviewCount ?? 0),
    distance: (a, b) => (distanceTo(a, f.landmark) ?? Infinity) - (distanceTo(b, f.landmark) ?? Infinity),
  };
  return filtered.sort(sorters[f.sort]);
}


export interface HotelFacets {
  price: { min: number; max: number } | null;
  neighborhoods: Facet[];
  types: Facet[];
  vendors: Facet[];
  labels: Facet[];
  stars: Facet[];
}


/** Opções de filtro geradas a partir dos resultados carregados, com contagens. */
export function hotelFacets(hotels: Hotel[]): HotelFacets {
  const prices = hotels.flatMap((h) => nightlyPrice(h) ?? []);
  return {
    price: prices.length ? { min: Math.floor(Math.min(...prices)), max: Math.ceil(Math.max(...prices)) } : null,
    neighborhoods: countBy(hotels.map((h) => h.neighborhood ?? "")),
    types: countBy(hotels.map((h) => h.type ?? "")),
    vendors: countBy(hotels.flatMap((h) => [...new Set(h.offers.map((o) => o.vendor))])),
    labels: countBy(hotels.flatMap((h) => [...new Set([...h.labels, ...h.amenities])])),
    stars: countBy(hotels.map((h) => (h.stars ? String(Math.floor(h.stars)) : ""))).sort((a, b) => Number(b.value) - Number(a.value)),
  };
}

// ---------------------------------------------------------------------------
// Filtros <-> URL (para links compartilháveis)
// ---------------------------------------------------------------------------

const list = listParam;
const num = numParam;

export function hotelFiltersFromQuery(sp: URLSearchParams): HotelFilters {
  const landmark = sp.get("ref") as LandmarkId | null;
  const sort = sp.get("ordem") as HotelSort | null;
  return {
    q: sp.get("q") ?? "",
    priceMin: num(sp.get("pmin")),
    priceMax: num(sp.get("pmax")),
    minRating: num(sp.get("nota")),
    stars: list(sp.get("estrelas")).map(Number).filter(Number.isFinite),
    neighborhoods: list(sp.get("bairros")),
    types: list(sp.get("tipos")),
    vendors: list(sp.get("sites")),
    labels: list(sp.get("comodidades")),
    landmark: landmark && LANDMARK_IDS.includes(landmark) ? landmark : EMPTY_HOTEL_FILTERS.landmark,
    maxDistanceKm: num(sp.get("dist")),
    onlyWithPrice: sp.get("disponivel") === "1",
    sort: sort && sort in HOTEL_SORTS ? sort : EMPTY_HOTEL_FILTERS.sort,
  };
}

export function hotelFiltersToQuery(f: HotelFilters, sp: URLSearchParams): URLSearchParams {
  const out = new URLSearchParams(sp);
  const set = (k: string, v: string | number | undefined | null) => {
    if (v === undefined || v === null || v === "" ) out.delete(k);
    else out.set(k, String(v));
  };
  set("q", f.q.trim());
  set("pmin", f.priceMin);
  set("pmax", f.priceMax);
  set("nota", f.minRating);
  set("estrelas", f.stars.join("|"));
  set("bairros", f.neighborhoods.join("|"));
  set("tipos", f.types.join("|"));
  set("sites", f.vendors.join("|"));
  set("comodidades", f.labels.join("|"));
  set("ref", f.landmark === EMPTY_HOTEL_FILTERS.landmark ? undefined : f.landmark);
  set("dist", f.maxDistanceKm);
  set("disponivel", f.onlyWithPrice ? 1 : undefined);
  set("ordem", f.sort === EMPTY_HOTEL_FILTERS.sort ? undefined : f.sort);
  return out;
}

export function activeHotelFilterCount(f: HotelFilters): number {
  return [
    f.q.trim() !== "",
    f.priceMin != null || f.priceMax != null,
    f.minRating != null,
    f.stars.length > 0,
    f.neighborhoods.length > 0,
    f.types.length > 0,
    f.vendors.length > 0,
    f.labels.length > 0,
    f.maxDistanceKm != null,
    f.onlyWithPrice,
  ].filter(Boolean).length;
}
