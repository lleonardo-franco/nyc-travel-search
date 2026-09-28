import { addDays } from "@/lib/dates";
import { pick, seededRandom } from "@/lib/random";
import type { Hotel, HotelOffer, HotelSearchParams } from "@/lib/types";
import { sortOffers, stayMultiplier, withNeighborhood } from "./common";
import type { HotelProvider } from "./types";

/**
 * Hotéis fictícios, usados quando nenhuma fonte real responde (DEMO_MODE=fallback)
 * ou em desenvolvimento offline (DEMO_MODE=only). A UI mostra um aviso quando aparecem.
 */

const PAGE_SIZE = 24;
const PAGES = 2;

const NAMES = [
  "Hudson Loft", "Empire Row", "Brooklyn Brick House", "Midtown Standard", "Chelsea Gallery Inn",
  "Park Avenue Suites", "Bowery Lights", "Harlem Heritage", "SoHo Cast Iron", "Village Garden",
  "Theater District Tower", "Battery Harbor", "East River View", "Upper West Brownstone",
  "Flatiron Corner", "Queensboro Bridge Hotel", "Williamsburg Warehouse", "Central Park Terrace",
  "Wall Street Exchange", "Koreatown Nights", "Madison Square Rooms", "Astoria Local",
  "Tribeca Canal House", "Lexington Classic", "Grand Central Hall", "Hell's Kitchen Social",
  "Gramercy Keys", "Long Island City Skyline", "Rockefeller Plaza Inn", "Nolita Courtyard",
];

const SPOTS = [
  { lat: 40.758, lng: -73.9855 }, { lat: 40.7465, lng: -74.0014 }, { lat: 40.7233, lng: -74.003 },
  { lat: 40.7075, lng: -74.0113 }, { lat: 40.754, lng: -73.973 }, { lat: 40.787, lng: -73.9754 },
  { lat: 40.7736, lng: -73.9566 }, { lat: 40.7081, lng: -73.9571 }, { lat: 40.7447, lng: -73.9485 },
  { lat: 40.8116, lng: -73.9465 }, { lat: 40.693, lng: -73.987 }, { lat: 40.7638, lng: -73.9918 },
];

const VENDORS = ["Booking.com", "Expedia", "Hotels.com", "Agoda", "Trip.com", "Site do hotel"];
const TYPES = ["Hotel", "Hotel", "Hotel", "Pousada / B&B", "Hostel", "Apart-hotel"];
const AMENITIES = ["Wi-Fi grátis", "Academia", "Ar-condicionado", "Restaurante", "Bar", "Aceita pets", "Piscina", "Recepção 24h"];
const LABELS = ["Café da manhã incluso", "Cancelamento grátis"];

function demoHotel(index: number, params: HotelSearchParams): Hotel {
  const rand = seededRandom(`hotel-${index}`);
  const spot = SPOTS[index % SPOTS.length];
  const stars = 2 + Math.floor(rand() * 4);
  const base = (90 + stars * 55 + rand() * 120) * (params.currency === "BRL" ? 5.2 : params.currency === "EUR" ? 0.9 : 1);
  const images = Array.from({ length: 3 }, (_, i) => ({
    url: `/demo/hotel-${((index + i) % 6) + 1}.svg`,
    caption: `${NAMES[index % NAMES.length]} — foto ${i + 1}`,
  }));
  return withNeighborhood({
    id: `demo:${index}`,
    source: "demo",
    nativeId: String(index),
    name: `${NAMES[index % NAMES.length]} (demo)`,
    type: pick(rand, TYPES),
    stars,
    rating: Math.round((3.2 + rand() * 1.8) * 10) / 10,
    reviewCount: Math.floor(80 + rand() * 4000),
    location: { lat: spot.lat + (rand() - 0.5) * 0.01, lng: spot.lng + (rand() - 0.5) * 0.01 },
    images,
    amenities: AMENITIES.filter(() => rand() > 0.45),
    labels: LABELS.filter(() => rand() > 0.6),
    offers: [],
    priceEstimate: { min: Math.round(base * 0.8), max: Math.round(base * 1.9), currency: params.currency },
    pendingOfferIds: [`demo:${index}`],
    description: "Hotel fictício usado no modo de demonstração.",
    sources: ["demo"],
  });
}

function demoOffers(index: number, params: HotelSearchParams): HotelOffer[] {
  const hotel = demoHotel(index, params);
  const rand = seededRandom(`offers-${index}-${params.checkin}-${params.checkout}`);
  const base = hotel.priceEstimate!.min * (1 + rand() * 0.6);
  const multiplier = stayMultiplier(params);
  const vendors = VENDORS.filter(() => rand() > 0.35);
  return sortOffers(
    (vendors.length ? vendors : [VENDORS[0]]).map((vendor) => {
      const perNight = Math.round(base * (0.92 + rand() * 0.2));
      return {
        source: "demo",
        vendor,
        pricePerNight: perNight,
        totalPrice: perNight * multiplier,
        currency: params.currency,
        refundable: rand() > 0.5,
      };
    }),
  );
}

export const demoHotelProvider: HotelProvider = {
  id: "demo",
  name: "Demonstração",
  kind: "demo",
  disabledReason: () => null,

  async search(params) {
    if (params.page > PAGES) return { hotels: [], hasMore: false };
    const start = (params.page - 1) * PAGE_SIZE;
    const hotels = Array.from({ length: PAGE_SIZE }, (_, i) => demoHotel(start + i, params));
    return { hotels, hasMore: params.page < PAGES };
  },

  async offers(nativeIds, params) {
    return Object.fromEntries(nativeIds.map((id) => [id, demoOffers(Number(id), params)]));
  },

  async details(nativeId, params) {
    const index = Number(nativeId);
    if (!Number.isInteger(index) || index < 0 || index >= PAGE_SIZE * PAGES) return null;
    return { ...demoHotel(index, params), offers: demoOffers(index, params), pendingOfferIds: [] };
  },

  async calendar(nativeId, params) {
    const rand = seededRandom(`cal-${nativeId}`);
    const cal = { cheap: [] as string[], average: [] as string[], high: [] as string[] };
    for (let i = -20; i < 50; i++) {
      const day = addDays(params.checkin, i);
      const r = rand();
      (r < 0.25 ? cal.cheap : r < 0.7 ? cal.average : cal.high).push(day);
    }
    return cal;
  },
};
