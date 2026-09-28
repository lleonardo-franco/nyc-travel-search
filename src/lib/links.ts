import { hotelSearchToQuery } from "./params";
import type { Hotel, HotelOffer, HotelSearchParams } from "./types";

/** Página de detalhes do hotel mantendo datas e hóspedes da busca. */
export function hotelHref(hotel: Pick<Hotel, "source" | "nativeId">, p: HotelSearchParams): string {
  return `/hoteis/${hotel.source}/${encodeURIComponent(hotel.nativeId)}?${hotelSearchToQuery({ ...p, page: 1 })}`;
}

/**
 * Link para ver a oferta no site parceiro. Quando a fonte não traz o link direto,
 * abre a busca do site com o nome do hotel e as datas já preenchidas.
 */
export function offerUrl(offer: HotelOffer, hotel: Hotel, p: HotelSearchParams): string | undefined {
  if (offer.url) return offer.url;
  const name = `${hotel.name.replace(/\s*\(demo\)$/, "")}, New York`;
  const vendor = offer.vendor.toLowerCase();
  const kids = p.childrenAges.length;

  if (vendor.includes("booking")) {
    const q = new URLSearchParams({
      ss: name,
      checkin: p.checkin,
      checkout: p.checkout,
      group_adults: String(p.adults),
      no_rooms: String(p.rooms),
      group_children: String(kids),
    });
    for (const age of p.childrenAges) q.append("age", String(age));
    return `https://www.booking.com/searchresults.html?${q}`;
  }
  if (vendor.includes("expedia") || vendor.includes("hotels.com")) {
    const host = vendor.includes("expedia") ? "www.expedia.com" : "www.hotels.com";
    const q = new URLSearchParams({
      destination: name,
      startDate: p.checkin,
      endDate: p.checkout,
      adults: String(p.adults),
      rooms: String(p.rooms),
    });
    if (kids) q.set("children", p.childrenAges.map((a) => `1_${a}`).join(","));
    return `https://${host}/Hotel-Search?${q}`;
  }
  if (vendor.includes("agoda")) {
    const q = new URLSearchParams({
      textToSearch: name,
      checkIn: p.checkin,
      checkOut: p.checkout,
      adults: String(p.adults),
      rooms: String(p.rooms),
      children: String(kids),
    });
    return `https://www.agoda.com/search?${q}`;
  }
  if (vendor.includes("trip.com")) {
    const q = new URLSearchParams({ keyword: name, checkin: p.checkin, checkout: p.checkout, adult: String(p.adults) });
    return `https://www.trip.com/hotels/list?${q}`;
  }
  // Sem padrão conhecido: página do hotel no TripAdvisor/Google, que lista todos os sites.
  return hotel.url;
}

/** Logos das companhias aéreas no CDN público da Kiwi.com. */
export function airlineLogo(code: string): string {
  return `https://images.kiwi.com/airlines/64x64/${encodeURIComponent(code)}.png`;
}

export const NYC_HERO_IMAGE = "https://images.kiwi.com/photos/1280x720/new-york-city_ny_us.jpg";
