import { describe, expect, it } from "vitest";
import {
  applyFlightFilters,
  EMPTY_FLIGHT_FILTERS,
  flightFacets,
  flightFiltersFromQuery,
  flightFiltersToQuery,
} from "@/lib/filters/flights";
import {
  applyHotelFilters,
  bestOffer,
  EMPTY_HOTEL_FILTERS,
  hotelFacets,
  hotelFiltersFromQuery,
  hotelFiltersToQuery,
  nightlyPrice,
} from "@/lib/filters/hotels";
import { LANDMARKS } from "@/lib/geo";
import { flight, hotel, leg, offer } from "./helpers";

const ts = LANDMARKS["times-square"];

const hotels = [
  hotel({
    id: "x:cheap",
    name: "Budget Inn",
    rating: 3.6,
    reviewCount: 100,
    neighborhood: "Chelsea",
    location: { lat: ts.lat + 0.02, lng: ts.lng },
    offers: [offer("Agoda.com", 600), offer("Booking.com", 650)],
    labels: [],
  }),
  hotel({
    id: "x:mid",
    name: "Hudson Midtown",
    rating: 4.6,
    reviewCount: 3000,
    neighborhood: "Times Square / Theater District",
    location: { lat: ts.lat + 0.001, lng: ts.lng },
    offers: [offer("Booking.com", 1200), offer("Expedia", 1300)],
    labels: ["Café da manhã incluso"],
  }),
  hotel({
    id: "x:lux",
    name: "Park Palace",
    rating: 4.9,
    reviewCount: 800,
    stars: 5,
    neighborhood: "Central Park South",
    location: { lat: ts.lat + 0.008, lng: ts.lng + 0.005 },
    offers: [offer("Expedia", 3000)],
  }),
  hotel({ id: "x:pending", name: "Pending Hotel", pendingOfferIds: ["x:pending"], priceEstimate: { min: 900, max: 1500, currency: "BRL" } }),
];

describe("filtros de hotéis", () => {
  it("usa a oferta mais barata e cai para a estimativa sem ofertas", () => {
    expect(nightlyPrice(hotels[0])).toBe(600);
    expect(nightlyPrice(hotels[3])).toBe(900);
    expect(bestOffer(hotels[0], ["Booking.com"])?.pricePerNight).toBe(650);
    expect(nightlyPrice(hotels[3], ["Booking.com"])).toBeUndefined();
  });

  it("filtra por preço, nota, bairro, comodidade e texto", () => {
    const ids = (f: Partial<typeof EMPTY_HOTEL_FILTERS>) =>
      applyHotelFilters(hotels, { ...EMPTY_HOTEL_FILTERS, ...f }).map((h) => h.id).sort();
    expect(ids({ priceMax: 1000 })).toEqual(["x:cheap", "x:pending"]);
    expect(ids({ minRating: 4.5 })).toEqual(["x:lux", "x:mid"]);
    expect(ids({ neighborhoods: ["Chelsea"] })).toEqual(["x:cheap"]);
    expect(ids({ labels: ["Café da manhã incluso"] })).toEqual(["x:mid"]);
    expect(ids({ q: "palace" })).toEqual(["x:lux"]);
    expect(ids({ stars: [5] })).toEqual(["x:lux"]);
    expect(ids({ onlyWithPrice: true })).toEqual(["x:cheap", "x:lux", "x:mid"]);
  });

  it("filtra por distância ao ponto de referência", () => {
    const within = applyHotelFilters(hotels, { ...EMPTY_HOTEL_FILTERS, landmark: "times-square", maxDistanceKm: 1 });
    expect(within.map((h) => h.id).sort()).toEqual(["x:lux", "x:mid"]);
  });

  it("mantém hotéis ainda carregando preços ao filtrar por site", () => {
    const res = applyHotelFilters(hotels, { ...EMPTY_HOTEL_FILTERS, vendors: ["Expedia"] });
    expect(res.map((h) => h.id).sort()).toEqual(["x:lux", "x:mid", "x:pending"]);
  });

  it("ordena por preço, nota e distância", () => {
    const sorted = (sort: typeof EMPTY_HOTEL_FILTERS.sort) =>
      applyHotelFilters(hotels.slice(0, 3), { ...EMPTY_HOTEL_FILTERS, sort }).map((h) => h.id);
    expect(sorted("price_asc")).toEqual(["x:cheap", "x:mid", "x:lux"]);
    expect(sorted("price_desc")).toEqual(["x:lux", "x:mid", "x:cheap"]);
    expect(sorted("rating")).toEqual(["x:lux", "x:mid", "x:cheap"]);
    expect(sorted("distance")[0]).toBe("x:mid");
    // "Recomendados" pondera nota pelo volume de avaliações.
    expect(sorted("recommended")[0]).toBe("x:mid");
  });

  it("gera opções de filtro com contagens", () => {
    const facets = hotelFacets(hotels);
    expect(facets.price).toEqual({ min: 600, max: 3000 });
    expect(facets.vendors).toContainEqual({ value: "Booking.com", count: 2 });
    expect(facets.stars).toEqual([{ value: "5", count: 1 }]);
  });

  it("guarda e lê os filtros da URL", () => {
    const f = {
      ...EMPTY_HOTEL_FILTERS,
      q: "hudson",
      priceMin: 500,
      priceMax: 1500,
      minRating: 4,
      neighborhoods: ["Times Square / Theater District", "SoHo"],
      vendors: ["Booking.com"],
      landmark: "central-park" as const,
      maxDistanceKm: 2,
      onlyWithPrice: true,
      sort: "price_asc" as const,
    };
    const q = hotelFiltersToQuery(f, new URLSearchParams("checkin=2026-11-10"));
    expect(q.get("checkin")).toBe("2026-11-10");
    expect(hotelFiltersFromQuery(q)).toEqual(f);
    expect(hotelFiltersToQuery(EMPTY_HOTEL_FILTERS, new URLSearchParams()).toString()).toBe("");
  });

  it("ignora valores inválidos na URL", () => {
    const f = hotelFiltersFromQuery(new URLSearchParams("ordem=hackear&ref=lua&pmax=abc"));
    expect(f.sort).toBe("recommended");
    expect(f.landmark).toBe("times-square");
    expect(f.priceMax).toBeUndefined();
  });
});

describe("filtros de voos", () => {
  const direct = flight({ id: "direct", price: 6000, outbound: leg({ durationMinutes: 600 }), totalDurationMinutes: 600 });
  const cheap = flight({
    id: "cheap",
    price: 4800,
    airlines: ["Avianca"],
    airlineCodes: ["AV"],
    outbound: leg({ stops: 1, route: ["GRU", "BOG", "JFK"], durationMinutes: 820, departureTime: "2026-11-10T17:25:00", to: "JFK" }),
    totalDurationMinutes: 820,
    baggage: { personalItem: 1, cabinBag: 1, checkedBag: 0 },
  });
  const night = flight({
    id: "night",
    price: 5200,
    airlines: ["United Airlines"],
    airlineCodes: ["UA"],
    outbound: leg({ stops: 2, route: ["GRU", "IAH", "ORD", "EWR"], durationMinutes: 1300, departureTime: "2026-11-10T23:10:00", to: "EWR" }),
    totalDurationMinutes: 1300,
    baggage: { personalItem: 1, cabinBag: 1, checkedBag: 1 },
  });
  const all = [direct, cheap, night];
  const ids = (f: Partial<typeof EMPTY_FLIGHT_FILTERS>) => applyFlightFilters(all, { ...EMPTY_FLIGHT_FILTERS, ...f }).map((x) => x.id);

  it("filtra por paradas, companhia, horário, aeroporto e bagagem", () => {
    expect(ids({ stops: [0] })).toEqual(["direct"]);
    expect(ids({ stops: [2] })).toEqual(["night"]);
    expect(ids({ airlines: ["Avianca"] })).toEqual(["cheap"]);
    expect(ids({ departWindows: ["noite"], sort: "price" })).toEqual(["night"]);
    expect(ids({ departWindows: ["manha", "tarde"], sort: "price" })).toEqual(["cheap", "direct"]);
    expect(ids({ arrivalAirports: ["EWR"] })).toEqual(["night"]);
    expect(ids({ checkedBag: true })).toEqual(["night"]);
    expect(ids({ priceMax: 5000 })).toEqual(["cheap"]);
    expect(ids({ maxDurationHours: 14, sort: "price" })).toEqual(["cheap", "direct"]);
  });

  it("ordena por preço, duração e 'melhor'", () => {
    expect(ids({ sort: "price" })).toEqual(["cheap", "night", "direct"]);
    expect(ids({ sort: "duration" })).toEqual(["direct", "cheap", "night"]);
    expect(ids({ sort: "best" })[0]).toBe("direct");
  });

  it("gera facetas e guarda os filtros na URL", () => {
    const facets = flightFacets(all);
    expect(facets.stops.map((s) => s.value)).toEqual(["0", "1", "2"]);
    expect(facets.arrivalAirports).toContainEqual({ value: "EWR", count: 1 });
    const f = { ...EMPTY_FLIGHT_FILTERS, stops: [0, 1], airlines: ["LATAM Airlines"], departWindows: ["manha" as const], checkedBag: true, sort: "price" as const };
    expect(flightFiltersFromQuery(flightFiltersToQuery(f, new URLSearchParams()))).toEqual(f);
  });
});
