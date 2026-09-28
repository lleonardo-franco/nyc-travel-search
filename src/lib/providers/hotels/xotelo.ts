import { cache, HOUR, MINUTE } from "@/lib/cache";
import { config } from "@/lib/config";
import { addDays } from "@/lib/dates";
import { convert } from "@/lib/fx";
import { fetchJson, mapLimit, ProviderError } from "@/lib/http";
import type { Hotel, HotelOffer, HotelSearchParams, PriceCalendar } from "@/lib/types";
import { sortOffers, stayMultiplier, translateType, uniqueLabels, withNeighborhood } from "./common";
import type { HotelProvider } from "./types";

/**
 * Xotelo — API pública e gratuita (sem chave) com o catálogo de hotéis do TripAdvisor
 * e as diárias de vários sites (Booking.com, Expedia, Agoda, Trip.com, site do hotel…).
 * Docs: https://xotelo.com
 */

const BASE = "https://data.xotelo.com/api";
const CATALOG_PAGE = 100; // máximo aceito pelo /list
export const XOTELO_PAGE_SIZE = 30;
/** Chave de hotel do TripAdvisor, ex.: g60763-d23448880. */
const XOTELO_KEY = /^g\d+-d\d+$/;

interface Envelope<T> {
  error: { status_code?: number; message?: string } | null;
  result: T | null;
}

export interface XoteloListItem {
  name: string;
  key: string;
  accommodation_type?: string;
  url?: string;
  review_summary?: { rating?: number; count?: number };
  price_ranges?: { maximum?: number; minimum?: number };
  geo?: { latitude?: number; longitude?: number };
  image?: string;
  mentions?: string[];
  merchandising_labels?: string[];
  highlighted_amenities?: string[];
}

interface ListResult {
  total_count: number;
  list: XoteloListItem[];
}

export interface XoteloRatesResult {
  currency?: string;
  rates: { code: string; name: string; rate: number; tax?: number | null }[];
}

interface HeatmapResult {
  heatmap: { average_price_days?: string[]; cheap_price_days?: string[]; high_price_days?: string[] };
}

async function call<T>(path: string, query: Record<string, string>): Promise<T> {
  const url = `${BASE}/${path}?${new URLSearchParams(query)}`;
  const data = await fetchJson<Envelope<T>>(url, { timeoutMs: 20_000 });
  if (data.error || !data.result) throw new ProviderError(data.error?.message ?? "resposta vazia do Xotelo");
  return data.result;
}

/** Imagens do CDN do TripAdvisor aceitam redimensionamento via query string. */
export function resizeTripadvisor(url: string, width: number): string {
  if (!url.includes("tripadvisor.com/media")) return url;
  return `${url.split("?")[0]}?w=${width}&h=-1&s=1`;
}

// O /list do Xotelo não é determinístico: a ordem (e quais hotéis vêm) muda entre chamadas
// e tamanhos de página. Guardamos todo hotel já visto para achar os detalhes depois.
const seen = new Map<string, { item: XoteloListItem; at: number }>();

function remember(items: XoteloListItem[]) {
  const now = Date.now();
  for (const item of items) seen.set(item.key, { item, at: now });
  if (seen.size > 5000) {
    for (const [key, v] of seen) if (now - v.at > 24 * HOUR) seen.delete(key);
  }
}

function listPage(limit: number, offset: number): Promise<ListResult> {
  return cache.memo(`xotelo:list:${config.xoteloLocationKey}:${limit}:${offset}`, 12 * HOUR, async () => {
    const result = await call<ListResult>("list", {
      location_key: config.xoteloLocationKey,
      limit: String(limit),
      offset: String(offset),
      sort: "best_value",
    });
    remember(result.list);
    return result;
  });
}

function catalogPage(index: number): Promise<ListResult> {
  return listPage(CATALOG_PAGE, index * CATALOG_PAGE);
}

async function catalogSlice(offset: number, limit: number): Promise<{ items: XoteloListItem[]; total: number }> {
  const first = Math.floor(offset / CATALOG_PAGE);
  const last = Math.floor((offset + limit - 1) / CATALOG_PAGE);
  const pages = await Promise.all(Array.from({ length: last - first + 1 }, (_, i) => catalogPage(first + i)));
  const all = pages.flatMap((p) => p.list);
  const start = offset - first * CATALOG_PAGE;
  return { items: all.slice(start, start + limit), total: pages[0]?.total_count ?? 0 };
}

async function findInCatalog(key: string): Promise<XoteloListItem | null> {
  const known = seen.get(key);
  if (known) return known.item;
  // Link direto (ex.: compartilhado): varre o catálogo com dois tamanhos de página.
  const first = await catalogPage(0);
  const pages = Math.min(Math.ceil(first.total_count / CATALOG_PAGE), 12);
  for (let i = 1; i < pages && !seen.has(key); i++) await catalogPage(i);
  for (let offset = 0; offset < 150 && !seen.has(key); offset += XOTELO_PAGE_SIZE) await listPage(XOTELO_PAGE_SIZE, offset);
  return seen.get(key)?.item ?? null;
}

export async function toHotel(item: XoteloListItem, params: HotelSearchParams): Promise<Hotel> {
  const lat = item.geo?.latitude;
  const lng = item.geo?.longitude;
  const min = item.price_ranges?.minimum;
  const max = item.price_ranges?.maximum;
  const [estMin, estMax] =
    min && max
      ? await Promise.all([convert(min, "USD", params.currency), convert(max, "USD", params.currency)])
      : [undefined, undefined];

  return withNeighborhood({
    id: `xotelo:${item.key}`,
    source: "xotelo",
    nativeId: item.key,
    name: item.name,
    type: translateType(item.accommodation_type),
    rating: item.review_summary?.rating,
    reviewCount: item.review_summary?.count,
    location: lat != null && lng != null ? { lat, lng } : undefined,
    images: item.image
      ? [{ url: resizeTripadvisor(item.image, 1200), thumbnail: resizeTripadvisor(item.image, 600) }]
      : [],
    amenities: uniqueLabels(item.highlighted_amenities ?? []),
    labels: uniqueLabels([...(item.merchandising_labels ?? []), ...(item.mentions ?? [])]),
    offers: [],
    priceEstimate:
      estMin != null && estMax != null
        ? { min: Math.round(estMin), max: Math.round(estMax), currency: params.currency }
        : undefined,
    pendingOfferIds: [`xotelo:${item.key}`],
    url: item.url,
    sources: ["xotelo"],
  });
}

export function ratesToOffers(result: XoteloRatesResult, params: HotelSearchParams): HotelOffer[] {
  const multiplier = stayMultiplier(params);
  return sortOffers(
    result.rates
      .filter((r) => Number.isFinite(r.rate) && r.rate > 0)
      .map((r) => ({
        source: "xotelo",
        vendor: r.name,
        pricePerNight: r.rate + (r.tax ?? 0),
        totalPrice: Math.round((r.rate + (r.tax ?? 0)) * multiplier),
        currency: params.currency,
      })),
  );
}

async function ratesFor(key: string, params: HotelSearchParams): Promise<HotelOffer[]> {
  const cacheKey = `xotelo:rates:${key}:${params.checkin}:${params.checkout}:${params.adults}:${params.rooms}:${params.childrenAges.join("-")}:${params.currency}`;
  const result = await cache.memo(cacheKey, 30 * MINUTE, () =>
    call<XoteloRatesResult>(
      "rates",
      {
        hotel_key: key,
        chk_in: params.checkin,
        chk_out: params.checkout,
        currency: params.currency,
        adults: String(params.adults),
        rooms: String(params.rooms),
        ...(params.childrenAges.length ? { age_of_children: params.childrenAges.join(",") } : {}),
      },
    ),
  );
  return ratesToOffers(result, params);
}

export const xoteloProvider: HotelProvider = {
  id: "xotelo",
  name: "Xotelo (TripAdvisor)",
  kind: "api",

  disabledReason: () => (config.xoteloEnabled ? null : "desligado em XOTELO_ENABLED"),

  async search(params) {
    const offset = (params.page - 1) * XOTELO_PAGE_SIZE;
    const { items, total } = await catalogSlice(offset, XOTELO_PAGE_SIZE);
    const hotels = await Promise.all(items.map((item) => toHotel(item, params)));
    return { hotels, hasMore: offset + XOTELO_PAGE_SIZE < total };
  },

  async offers(nativeIds, params) {
    const valid = nativeIds.filter((key) => XOTELO_KEY.test(key));
    const entries = await mapLimit(valid, 6, async (key) => {
      try {
        return [key, await ratesFor(key, params)] as const;
      } catch {
        return [key, [] as HotelOffer[]] as const;
      }
    });
    return Object.fromEntries(entries);
  },

  async details(nativeId, params) {
    if (!XOTELO_KEY.test(nativeId)) return null;
    const item = await findInCatalog(nativeId);
    if (!item) return null;
    const hotel = await toHotel(item, params);
    const offers = await ratesFor(nativeId, params).catch(() => []);
    return { ...hotel, offers, pendingOfferIds: [] };
  },

  async calendar(nativeId, params) {
    const chkOut = addDays(params.checkout, 45);
    const result = await cache.memo(`xotelo:heatmap:${nativeId}:${chkOut}`, 6 * HOUR, () =>
      call<HeatmapResult>("heatmap", { hotel_key: nativeId, chk_out: chkOut }),
    );
    return {
      cheap: result.heatmap.cheap_price_days ?? [],
      average: result.heatmap.average_price_days ?? [],
      high: result.heatmap.high_price_days ?? [],
    } satisfies PriceCalendar;
  },
};
