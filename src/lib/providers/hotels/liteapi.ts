import { cache, HOUR, MINUTE } from "@/lib/cache";
import { config } from "@/lib/config";
import { fetchJson } from "@/lib/http";
import type { Hotel, HotelOffer, HotelSearchParams } from "@/lib/types";
import { sortOffers, stayMultiplier, uniqueLabels, withNeighborhood } from "./common";
import type { HotelProvider } from "./types";

/**
 * LiteAPI (Nuitee) — API de hotéis com chave de sandbox gratuita.
 * Traz galeria de fotos, estrelas, comodidades e tarifas reservadas de vários fornecedores.
 * Docs: https://docs.liteapi.travel
 */

const BASE = "https://api.liteapi.travel/v3.0";
const PAGE_SIZE = 30;

interface Amount {
  amount: number;
  currency: string;
}

export interface LiteHotel {
  id: string;
  name: string;
  hotelDescription?: string;
  latitude?: number;
  longitude?: number;
  location?: { latitude?: number; longitude?: number };
  address?: string;
  main_photo?: string;
  thumbnail?: string;
  stars?: number;
  starRating?: number;
  rating?: number;
  reviewCount?: number;
  hotelImages?: { url: string; urlHd?: string; caption?: string; defaultImage?: boolean }[];
  hotelFacilities?: string[];
}

export interface LiteRatesResponse {
  data?: {
    hotelId: string;
    roomTypes?: {
      offerRetailRate?: Amount | Amount[];
      rates?: {
        name?: string;
        boardName?: string;
        boardType?: string;
        retailRate?: { total?: Amount[] };
        cancellationPolicies?: { refundableTag?: string };
      }[];
    }[];
  }[];
}

function headers() {
  return { "X-API-Key": config.liteApiKey };
}

/** LiteAPI usa nota de 0 a 10. */
function normalizeRating(rating?: number): number | undefined {
  if (rating == null || rating <= 0) return undefined;
  return Math.round((rating > 5 ? rating / 2 : rating) * 10) / 10;
}

export function liteToHotel(h: LiteHotel): Hotel {
  const lat = h.latitude ?? h.location?.latitude;
  const lng = h.longitude ?? h.location?.longitude;
  const gallery = (h.hotelImages ?? [])
    .sort((a, b) => Number(b.defaultImage ?? false) - Number(a.defaultImage ?? false))
    .map((img) => ({ url: img.urlHd || img.url, thumbnail: img.url, caption: img.caption || undefined }));
  const images = gallery.length
    ? gallery
    : h.main_photo
      ? [{ url: h.main_photo, thumbnail: h.thumbnail || h.main_photo }]
      : [];

  return withNeighborhood({
    id: `liteapi:${h.id}`,
    source: "liteapi",
    nativeId: h.id,
    name: h.name,
    type: "Hotel",
    stars: h.stars ?? h.starRating ?? undefined,
    rating: normalizeRating(h.rating),
    reviewCount: h.reviewCount || undefined,
    address: h.address,
    location: lat != null && lng != null ? { lat, lng } : undefined,
    images,
    amenities: uniqueLabels(h.hotelFacilities ?? []),
    labels: [],
    offers: [],
    pendingOfferIds: [`liteapi:${h.id}`],
    description: h.hotelDescription?.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim(),
    sources: ["liteapi"],
  });
}

function occupancies(params: HotelSearchParams) {
  return Array.from({ length: params.rooms }, (_, i) => ({
    adults: Math.floor(params.adults / params.rooms) + (i < params.adults % params.rooms ? 1 : 0),
    children: i === 0 ? params.childrenAges : [],
  }));
}

export function liteRatesToOffers(res: LiteRatesResponse, params: HotelSearchParams): Record<string, HotelOffer[]> {
  const out: Record<string, HotelOffer[]> = {};
  const multiplier = stayMultiplier(params);
  for (const hotel of res.data ?? []) {
    const offers: HotelOffer[] = [];
    for (const room of hotel.roomTypes ?? []) {
      const retail = Array.isArray(room.offerRetailRate) ? room.offerRetailRate[0] : room.offerRetailRate;
      const rate = room.rates?.[0];
      const total = retail?.amount ?? rate?.retailRate?.total?.[0]?.amount;
      if (!total) continue;
      offers.push({
        source: "liteapi",
        vendor: rate?.name ? `LiteAPI · ${rate.name}` : "LiteAPI",
        pricePerNight: Math.round(total / multiplier),
        totalPrice: Math.round(total),
        currency: params.currency,
        refundable: rate?.cancellationPolicies?.refundableTag === "RFN",
        boardType: rate?.boardName || undefined,
      });
    }
    // Mantém as 3 opções de quarto mais baratas para não poluir o comparador.
    out[hotel.hotelId] = sortOffers(offers).slice(0, 3);
  }
  return out;
}

export const liteApiProvider: HotelProvider = {
  id: "liteapi",
  name: "LiteAPI",
  kind: "api",

  disabledReason: () => (config.liteApiKey ? null : "defina LITEAPI_KEY para ativar"),

  async search(params) {
    const offset = (params.page - 1) * PAGE_SIZE;
    const res = await cache.memo(`liteapi:list:${offset}`, 12 * HOUR, () =>
      fetchJson<{ data?: LiteHotel[]; total?: number }>(
        `${BASE}/data/hotels?${new URLSearchParams({
          countryCode: "US",
          cityName: "New York",
          limit: String(PAGE_SIZE),
          offset: String(offset),
        })}`,
        { headers: headers() },
      ),
    );
    const hotels = (res.data ?? []).map(liteToHotel);
    return { hotels, hasMore: hotels.length === PAGE_SIZE };
  },

  async offers(nativeIds, params) {
    const key = `liteapi:rates:${nativeIds.join(",")}:${params.checkin}:${params.checkout}:${params.adults}:${params.rooms}:${params.childrenAges.join("-")}:${params.currency}`;
    const res = await cache.memo(key, 20 * MINUTE, () =>
      fetchJson<LiteRatesResponse>(`${BASE}/hotels/rates`, {
        method: "POST",
        headers: headers(),
        timeoutMs: 20_000,
        body: {
          hotelIds: nativeIds,
          checkin: params.checkin,
          checkout: params.checkout,
          currency: params.currency,
          guestNationality: "BR",
          occupancies: occupancies(params),
          timeout: 10,
        },
      }),
    );
    return liteRatesToOffers(res, params);
  },

  async details(nativeId, params) {
    const res = await cache.memo(`liteapi:hotel:${nativeId}`, 12 * HOUR, () =>
      fetchJson<{ data?: LiteHotel }>(`${BASE}/data/hotel?hotelId=${encodeURIComponent(nativeId)}`, {
        headers: headers(),
      }),
    );
    if (!res.data) return null;
    const hotel = liteToHotel(res.data);
    const offers = await this.offers!([nativeId], params).catch(() => ({}) as Record<string, HotelOffer[]>);
    return { ...hotel, offers: offers[nativeId] ?? [], pendingOfferIds: [] };
  },
};
