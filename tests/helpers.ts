import { addDays, todayIso } from "@/lib/dates";
import type { FlightItinerary, FlightLeg, Hotel, HotelSearchParams } from "@/lib/types";

export function stay(overrides: Partial<HotelSearchParams> = {}): HotelSearchParams {
  const checkin = addDays(todayIso(), 30);
  return { checkin, checkout: addDays(checkin, 5), adults: 2, rooms: 1, childrenAges: [], currency: "BRL", page: 1, ...overrides };
}

export function hotel(overrides: Partial<Hotel> & { id: string }): Hotel {
  const [source, nativeId] = overrides.id.split(":");
  return {
    source,
    nativeId,
    name: overrides.id,
    images: [],
    amenities: [],
    labels: [],
    offers: [],
    sources: [source],
    ...overrides,
  };
}

export function offer(vendor: string, pricePerNight: number) {
  return { source: "test", vendor, pricePerNight, totalPrice: pricePerNight * 5, currency: "BRL" as const };
}

export function leg(overrides: Partial<FlightLeg> = {}): FlightLeg {
  return {
    from: "GRU",
    to: "JFK",
    departureTime: "2026-11-10T10:00:00",
    arrivalTime: "2026-11-10T20:00:00",
    durationMinutes: 600,
    stops: 0,
    route: ["GRU", "JFK"],
    segments: [
      {
        from: "GRU",
        to: "JFK",
        departureTime: "2026-11-10T10:00:00",
        arrivalTime: "2026-11-10T20:00:00",
        carrier: "LA",
        carrierName: "LATAM Airlines",
        flightNumber: "LA8180",
      },
    ],
    ...overrides,
  };
}

export function flight(overrides: Partial<FlightItinerary> & { id: string }): FlightItinerary {
  const outbound = overrides.outbound ?? leg();
  return {
    source: "kiwi",
    vendor: "Kiwi.com",
    price: 5000,
    currency: "BRL",
    outbound,
    totalDurationMinutes: outbound.durationMinutes,
    airlines: ["LATAM Airlines"],
    airlineCodes: ["LA"],
    ...overrides,
  };
}
