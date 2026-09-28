import { distanceKm } from "@/lib/geo";
import type { Hotel } from "@/lib/types";
import { sortOffers } from "./common";

const STOPWORDS = new Set([
  "the", "hotel", "hotels", "new", "york", "nyc", "ny", "city", "by", "a", "an", "and", "&", "at", "of", "in", "on",
]);

export function nameTokens(name: string): Set<string> {
  return new Set(
    name
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "")
      .toLowerCase()
      .replace(/[^a-z0-9 ]+/g, " ")
      .split(/\s+/)
      .filter((t) => t && !STOPWORDS.has(t)),
  );
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (!a.size || !b.size) return 0;
  let inter = 0;
  for (const t of a) if (b.has(t)) inter++;
  return inter / (a.size + b.size - inter);
}

/** Dois registros de fontes diferentes representam o mesmo hotel? */
export function sameHotel(a: Hotel, b: Hotel): boolean {
  const sim = jaccard(nameTokens(a.name), nameTokens(b.name));
  if (a.location && b.location) {
    const km = distanceKm(a.location, b.location);
    return (sim === 1 && km < 1) || (sim >= 0.6 && km < 0.3);
  }
  return sim === 1;
}

function mergeInto(base: Hotel, other: Hotel): Hotel {
  const images = [...base.images];
  for (const img of other.images) if (!images.some((i) => i.url === img.url)) images.push(img);
  return {
    ...base,
    type: base.type ?? other.type,
    stars: base.stars ?? other.stars,
    rating: base.rating ?? other.rating,
    reviewCount: base.reviewCount ?? other.reviewCount,
    address: base.address ?? other.address,
    location: base.location ?? other.location,
    neighborhood: base.neighborhood ?? other.neighborhood,
    borough: base.borough ?? other.borough,
    description: base.description ?? other.description,
    url: base.url ?? other.url,
    images,
    amenities: [...new Set([...base.amenities, ...other.amenities])],
    labels: [...new Set([...base.labels, ...other.labels])],
    offers: sortOffers([...base.offers, ...other.offers]),
    priceEstimate: base.priceEstimate ?? other.priceEstimate,
    pendingOfferIds: [...(base.pendingOfferIds ?? []), ...(other.pendingOfferIds ?? [])],
    sources: [...new Set([...base.sources, ...other.sources])],
  };
}

/**
 * Junta as listas das fontes: o mesmo hotel vindo de fontes diferentes vira um só card,
 * com todas as ofertas lado a lado (comparador de preços).
 */
export function mergeHotels(lists: Hotel[][]): Hotel[] {
  const merged: Hotel[] = [];
  for (const list of lists) {
    for (const hotel of list) {
      const idx = merged.findIndex((m) => m.source !== hotel.source && sameHotel(m, hotel));
      if (idx >= 0) merged[idx] = mergeInto(merged[idx], hotel);
      else merged.push(hotel);
    }
  }
  return merged;
}
