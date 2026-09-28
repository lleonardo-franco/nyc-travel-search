import { describe, expect, it } from "vitest";
import kiwiFixture from "./fixtures/kiwi-search.json";
import xoteloList from "./fixtures/xotelo-list.json";
import xoteloRates from "./fixtures/xotelo-rates.json";
import { dedupeFlights } from "@/lib/providers/flights";
import { kiwiToItineraries, type KiwiSearchResult } from "@/lib/providers/flights/kiwi-mcp";
import { serpToItineraries } from "@/lib/providers/flights/serpapi";
import { liteRatesToOffers } from "@/lib/providers/hotels/liteapi";
import { mergeHotels, sameHotel } from "@/lib/providers/hotels/merge";
import { serpToHotel } from "@/lib/providers/hotels/serpapi";
import { ratesToOffers, resizeTripadvisor, toHotel, type XoteloListItem } from "@/lib/providers/hotels/xotelo";
import type { FlightSearchParams } from "@/lib/types";
import { hotel, offer, stay } from "./helpers";

const flightParams: FlightSearchParams = {
  origin: "GRU",
  destination: "NYC",
  departDate: "2026-11-10",
  returnDate: "2026-11-20",
  adults: 1,
  children: 0,
  infants: 0,
  cabin: "M",
  currency: "BRL",
  flexDays: 0,
};

describe("Kiwi.com (MCP)", () => {
  it("converte o structuredContent da ferramenta search-flight", () => {
    const its = kiwiToItineraries(kiwiFixture as KiwiSearchResult, flightParams);
    expect(its).toHaveLength(3);
    const first = its[0];
    expect(first.id).toMatch(/^kiwi:/);
    expect(first.price).toBe(4861);
    expect(first.outbound.route).toEqual(["GRU", "BOG", "JFK"]);
    expect(first.outbound.stops).toBe(1);
    expect(first.outbound.durationMinutes).toBe(815);
    expect(first.inbound?.to).toBe("GRU");
    expect(first.airlines).toEqual(["Avianca"]);
    expect(first.bookingUrl).toMatch(/^https:\/\/kiwi\.com\//);
    expect(first.baggage).toEqual({ personalItem: 1, cabinBag: 1, checkedBag: 0 });
  });

  it("ignora itinerários sem preço ou sem ida", () => {
    expect(kiwiToItineraries({ itineraries: [{ price: null }, { price: 10 }] }, flightParams)).toEqual([]);
  });
});

describe("Google Flights (SerpApi)", () => {
  it("converte best_flights/other_flights e avisa que a volta é escolhida no site", () => {
    const its = serpToItineraries(
      {
        best_flights: [
          {
            flights: [
              {
                departure_airport: { id: "GRU", name: "Guarulhos", time: "2026-11-10 23:55" },
                arrival_airport: { id: "JFK", name: "John F. Kennedy", time: "2026-11-11 07:40" },
                duration: 585,
                airline: "LATAM",
                flight_number: "LA 8180",
              },
            ],
            total_duration: 585,
            price: 5980,
            booking_token: "tok",
          },
        ],
        search_metadata: { google_flights_url: "https://www.google.com/travel/flights?x" },
      },
      flightParams,
    );
    expect(its).toHaveLength(1);
    expect(its[0].outbound.departureTime).toBe("2026-11-10T23:55:00");
    expect(its[0].outbound.segments[0].carrier).toBe("LA");
    expect(its[0].outbound.segments[0].flightNumber).toBe("LA8180");
    expect(its[0].note).toMatch(/volta/);
  });

  it("deduplica o mesmo voo de fontes diferentes mantendo o mais barato", () => {
    const [a] = kiwiToItineraries(kiwiFixture as KiwiSearchResult, flightParams);
    const pricier = { ...a, id: "serpapi:x", source: "serpapi", price: a.price + 100 };
    const res = dedupeFlights([[pricier], [a]]);
    expect(res).toHaveLength(1);
    expect(res[0].id).toBe(a.id);
  });
});

describe("Xotelo", () => {
  const item = (xoteloList as { result: { list: XoteloListItem[] } }).result.list[0];

  it("converte um hotel do catálogo (imagem redimensionada, bairro, estimativa convertida)", async () => {
    const h = await toHotel(item, stay({ currency: "USD" }));
    expect(h.id).toBe(`xotelo:${item.key}`);
    expect(h.pendingOfferIds).toEqual([h.id]);
    expect(h.images[0].thumbnail).toMatch(/\?w=600&h=-1&s=1$/);
    expect(h.neighborhood).toBeTruthy();
    expect(h.priceEstimate?.min).toBe(item.price_ranges?.minimum);
  });

  it("calcula diária e total da estadia a partir das tarifas por site", () => {
    const offers = ratesToOffers(xoteloRates.result as never, stay({ rooms: 2 }));
    expect(offers.length).toBeGreaterThan(0);
    expect(offers.map((o) => o.pricePerNight)).toEqual([...offers.map((o) => o.pricePerNight)].sort((a, b) => a - b));
    expect(offers[0].totalPrice).toBe(Math.round(offers[0].pricePerNight * 5 * 2));
  });

  it("redimensiona só imagens do CDN do TripAdvisor", () => {
    expect(resizeTripadvisor("https://dynamic-media-cdn.tripadvisor.com/media/photo-o/a.jpg", 300)).toMatch(/w=300/);
    expect(resizeTripadvisor("https://example.com/a.jpg", 300)).toBe("https://example.com/a.jpg");
  });
});

describe("LiteAPI e Google Hotels", () => {
  it("usa o valor total da oferta e deriva a diária", () => {
    const res = liteRatesToOffers(
      {
        data: [
          {
            hotelId: "lp1",
            roomTypes: [
              { offerRetailRate: { amount: 5000, currency: "BRL" }, rates: [{ name: "Quarto duplo", cancellationPolicies: { refundableTag: "RFN" } }] },
              { offerRetailRate: [{ amount: 4000, currency: "BRL" }], rates: [{ name: "Standard" }] },
            ],
          },
        ],
      },
      stay(),
    );
    expect(res.lp1.map((o) => o.pricePerNight)).toEqual([800, 1000]);
    expect(res.lp1[1].refundable).toBe(true);
  });

  it("lê preços por site e várias fotos do Google Hotels", () => {
    const h = serpToHotel(
      {
        name: "Arlo SoHo",
        property_token: "tok1",
        gps_coordinates: { latitude: 40.7246, longitude: -74.0086 },
        overall_rating: 4.4,
        reviews: 2100,
        extracted_hotel_class: 4,
        images: [{ original_image: "https://a/1.jpg", thumbnail: "https://a/1t.jpg" }, { thumbnail: "https://a/2t.jpg" }],
        prices: [
          { source: "Expedia", rate_per_night: { extracted_lowest: 1400 }, link: "https://expedia" },
          { source: "Booking.com", rate_per_night: { extracted_lowest: 1350 } },
        ],
        amenities: ["Free Wi-Fi", "Fitness centre"],
      },
      stay(),
    )!;
    expect(h.images).toHaveLength(2);
    expect(h.offers.map((o) => o.vendor)).toEqual(["Booking.com", "Expedia"]);
    expect(h.amenities).toEqual(["Wi-Fi grátis", "Academia"]);
    expect(h.neighborhood).toBe("SoHo");
  });
});

describe("mescla de hotéis entre fontes", () => {
  const a = hotel({ id: "xotelo:1", name: "Arlo SoHo", location: { lat: 40.7246, lng: -74.0086 }, offers: [offer("Agoda.com", 1300)], rating: 4.4 });
  const b = hotel({
    id: "serpapi:9",
    name: "The Arlo SoHo Hotel",
    location: { lat: 40.7248, lng: -74.0084 },
    offers: [offer("Expedia", 1250)],
    images: [{ url: "https://a/1.jpg" }],
    stars: 4,
  });
  const other = hotel({ id: "serpapi:8", name: "Arlo NoMad", location: { lat: 40.7447, lng: -73.9885 } });

  it("reconhece o mesmo hotel com nomes um pouco diferentes", () => {
    expect(sameHotel(a, b)).toBe(true);
    expect(sameHotel(a, other)).toBe(false);
  });

  it("junta ofertas, fotos e dados das duas fontes num card só", () => {
    const merged = mergeHotels([[b, other], [a]]);
    expect(merged).toHaveLength(2);
    const m = merged.find((h) => h.id === "serpapi:9")!;
    expect(m.offers.map((o) => o.vendor)).toEqual(["Expedia", "Agoda.com"]);
    expect(m.sources).toEqual(["serpapi", "xotelo"]);
    expect(m.rating).toBe(4.4);
    expect(m.stars).toBe(4);
  });
});
