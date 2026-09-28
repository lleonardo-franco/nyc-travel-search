import { cache, MINUTE } from "@/lib/cache";
import { config } from "@/lib/config";
import { fetchJson } from "@/lib/http";
import type { Hotel, HotelOffer, HotelSearchParams } from "@/lib/types";
import { sortOffers, stayMultiplier, translateType, uniqueLabels, withNeighborhood } from "./common";
import type { HotelProvider } from "./types";

/**
 * SerpApi — Google Hotels. Agrega preços de dezenas de sites (Booking, Expedia, Hotels.com,
 * site oficial…) e traz várias fotos por hotel. Plano gratuito com cota mensal.
 * Docs: https://serpapi.com/google-hotels-api
 */

const BASE = "https://serpapi.com/search.json";

interface Price {
  extracted_lowest?: number;
  extracted_before_taxes_fees?: number;
}

interface SerpPriceSource {
  source?: string;
  link?: string;
  rate_per_night?: Price;
  total_rate?: Price;
  free_cancellation?: boolean;
}

export interface SerpProperty {
  type?: string;
  name: string;
  description?: string;
  link?: string;
  property_token?: string;
  gps_coordinates?: { latitude?: number; longitude?: number };
  address?: string;
  rate_per_night?: Price;
  total_rate?: Price;
  prices?: SerpPriceSource[];
  featured_prices?: SerpPriceSource[];
  extracted_hotel_class?: number;
  images?: { thumbnail?: string; original_image?: string }[];
  overall_rating?: number;
  reviews?: number;
  amenities?: string[];
}

interface SerpHotelsResponse {
  properties?: SerpProperty[];
  serpapi_pagination?: { next_page_token?: string };
  error?: string;
}

function baseQuery(params: HotelSearchParams): Record<string, string> {
  return {
    engine: "google_hotels",
    q: "Hotels in New York, NY",
    check_in_date: params.checkin,
    check_out_date: params.checkout,
    adults: String(params.adults),
    ...(params.childrenAges.length
      ? { children: String(params.childrenAges.length), children_ages: params.childrenAges.join(",") }
      : {}),
    currency: params.currency,
    gl: "br",
    hl: "pt-br",
    api_key: config.serpApiKey,
  };
}

function toOffers(p: SerpProperty, params: HotelSearchParams): HotelOffer[] {
  const multiplier = stayMultiplier(params);
  const sources = [...(p.featured_prices ?? []), ...(p.prices ?? [])];
  const offers: HotelOffer[] = [];
  const seen = new Set<string>();
  for (const s of sources) {
    const perNight = s.rate_per_night?.extracted_lowest;
    if (!s.source || !perNight || seen.has(s.source)) continue;
    seen.add(s.source);
    offers.push({
      source: "serpapi",
      vendor: s.source,
      pricePerNight: perNight,
      totalPrice: Math.round(s.total_rate?.extracted_lowest ?? perNight * multiplier),
      currency: params.currency,
      url: s.link,
      refundable: s.free_cancellation,
    });
  }
  const lowest = p.rate_per_night?.extracted_lowest;
  if (!offers.length && lowest) {
    offers.push({
      source: "serpapi",
      vendor: "Google Hotels",
      pricePerNight: lowest,
      totalPrice: Math.round(p.total_rate?.extracted_lowest ?? lowest * multiplier),
      currency: params.currency,
      url: p.link,
    });
  }
  return sortOffers(offers);
}

export function serpToHotel(p: SerpProperty, params: HotelSearchParams): Hotel | null {
  if (!p.property_token) return null;
  const lat = p.gps_coordinates?.latitude;
  const lng = p.gps_coordinates?.longitude;
  return withNeighborhood({
    id: `serpapi:${p.property_token}`,
    source: "serpapi",
    nativeId: p.property_token,
    name: p.name,
    type: translateType(p.type),
    stars: p.extracted_hotel_class,
    rating: p.overall_rating,
    reviewCount: p.reviews,
    address: p.address,
    location: lat != null && lng != null ? { lat, lng } : undefined,
    images: (p.images ?? [])
      .filter((img) => img.original_image || img.thumbnail)
      .map((img) => ({ url: img.original_image || img.thumbnail!, thumbnail: img.thumbnail || img.original_image })),
    amenities: uniqueLabels(p.amenities ?? []),
    labels: [],
    offers: toOffers(p, params),
    url: p.link,
    description: p.description,
    sources: ["serpapi"],
  });
}

function searchKey(params: HotelSearchParams) {
  return `serpapi:hotels:${params.checkin}:${params.checkout}:${params.adults}:${params.childrenAges.join("-")}:${params.currency}`;
}

/** O Google pagina por token: a página N depende do token da página N-1 (em cache). */
async function fetchPage(params: HotelSearchParams, page: number): Promise<SerpHotelsResponse> {
  return cache.memo(`${searchKey(params)}:${page}`, 30 * MINUTE, async () => {
    let token: string | undefined;
    if (page > 1) {
      token = (await fetchPage(params, page - 1)).serpapi_pagination?.next_page_token;
      if (!token) return { properties: [] };
    }
    const q = new URLSearchParams({ ...baseQuery(params), ...(token ? { next_page_token: token } : {}) });
    const res = await fetchJson<SerpHotelsResponse>(`${BASE}?${q}`, { timeoutMs: 25_000 });
    if (res.error) throw new Error(res.error);
    return res;
  });
}

export const serpApiHotelsProvider: HotelProvider = {
  id: "serpapi",
  name: "Google Hotels (SerpApi)",
  kind: "api",

  disabledReason: () => (config.serpApiKey ? null : "defina SERPAPI_KEY para ativar"),

  async search(params) {
    const res = await fetchPage(params, params.page);
    const hotels = (res.properties ?? []).flatMap((p) => serpToHotel(p, params) ?? []);
    return { hotels, hasMore: Boolean(res.serpapi_pagination?.next_page_token) };
  },

  async details(nativeId, params) {
    const q = new URLSearchParams({ ...baseQuery(params), property_token: nativeId });
    const res = await cache.memo(`${searchKey(params)}:prop:${nativeId}`, 30 * MINUTE, () =>
      fetchJson<SerpProperty & { error?: string }>(`${BASE}?${q}`, { timeoutMs: 25_000 }),
    );
    if (res.error) return null;
    return serpToHotel({ ...res, property_token: nativeId }, params);
  },
};
