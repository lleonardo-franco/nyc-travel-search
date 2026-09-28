import { cache, MINUTE } from "@/lib/cache";
import { config } from "@/lib/config";
import { fetchJson } from "@/lib/http";
import type { FlightItinerary, FlightLeg, FlightSearchParams } from "@/lib/types";
import type { FlightProvider } from "./types";

/**
 * SerpApi — Google Flights. Em viagens de ida e volta o Google devolve o preço total,
 * mas só os trechos de ida; a volta é escolhida no link do Google Flights.
 * Docs: https://serpapi.com/google-flights-api
 */

interface SerpAirport {
  name?: string;
  id: string;
  time: string; // "2026-11-10 17:25"
}

interface SerpFlightSegment {
  departure_airport: SerpAirport;
  arrival_airport: SerpAirport;
  duration?: number;
  airline?: string;
  flight_number?: string;
  travel_class?: string;
}

export interface SerpFlightOption {
  flights: SerpFlightSegment[];
  layovers?: { id: string }[];
  total_duration: number;
  price?: number;
  carbon_emissions?: { this_flight?: number };
  booking_token?: string;
  departure_token?: string;
}

export interface SerpFlightsResponse {
  best_flights?: SerpFlightOption[];
  other_flights?: SerpFlightOption[];
  search_metadata?: { google_flights_url?: string };
  error?: string;
}

const TRAVEL_CLASS = { M: "1", W: "2", C: "3", F: "4" } as const;
const NYC_ARRIVAL = { NYC: "JFK,EWR,LGA", JFK: "JFK", EWR: "EWR", LGA: "LGA" } as const;

function isoLocal(time: string): string {
  return `${time.replace(" ", "T")}:00`.slice(0, 19);
}

/** "LA 8180" → "LA" */
function carrierCode(flightNumber?: string): string {
  return flightNumber?.split(" ")[0] ?? "";
}

function toLeg(option: SerpFlightOption): FlightLeg {
  const segs = option.flights;
  const first = segs[0];
  const last = segs[segs.length - 1];
  return {
    from: first.departure_airport.id,
    to: last.arrival_airport.id,
    departureTime: isoLocal(first.departure_airport.time),
    arrivalTime: isoLocal(last.arrival_airport.time),
    durationMinutes: option.total_duration,
    stops: segs.length - 1,
    route: [first.departure_airport.id, ...segs.map((s) => s.arrival_airport.id)],
    segments: segs.map((s) => ({
      from: s.departure_airport.id,
      to: s.arrival_airport.id,
      fromName: s.departure_airport.name,
      toName: s.arrival_airport.name,
      departureTime: isoLocal(s.departure_airport.time),
      arrivalTime: isoLocal(s.arrival_airport.time),
      durationMinutes: s.duration,
      carrier: carrierCode(s.flight_number),
      carrierName: s.airline ?? carrierCode(s.flight_number),
      flightNumber: s.flight_number?.replace(" ", ""),
      cabinClass: s.travel_class,
    })),
  };
}

export function serpToItineraries(res: SerpFlightsResponse, params: FlightSearchParams): FlightItinerary[] {
  const options = [...(res.best_flights ?? []), ...(res.other_flights ?? [])];
  const link = res.search_metadata?.google_flights_url;
  return options.flatMap((option, i) => {
    if (!option.price || !option.flights?.length) return [];
    const outbound = toLeg(option);
    return [
      {
        id: `serpapi:${option.booking_token ?? option.departure_token ?? `${outbound.departureTime}-${outbound.route.join("")}-${i}`}`.slice(0, 200),
        source: "serpapi",
        vendor: "Google Flights",
        price: option.price,
        currency: params.currency,
        outbound,
        totalDurationMinutes: outbound.durationMinutes,
        airlines: [...new Set(outbound.segments.map((s) => s.carrierName))],
        airlineCodes: [...new Set(outbound.segments.map((s) => s.carrier).filter(Boolean))],
        bookingUrl: link,
        emissionsKg: option.carbon_emissions?.this_flight
          ? Math.round(option.carbon_emissions.this_flight / 1000)
          : undefined,
        note: params.returnDate ? "Preço de ida e volta; escolha o voo de volta no Google Flights." : undefined,
      } satisfies FlightItinerary,
    ];
  });
}

export const serpApiFlightsProvider: FlightProvider = {
  id: "serpapi",
  name: "Google Flights (SerpApi)",
  kind: "api",

  disabledReason: () => (config.serpApiKey ? null : "defina SERPAPI_KEY para ativar"),

  async search(params) {
    const q = new URLSearchParams({
      engine: "google_flights",
      departure_id: params.origin.toUpperCase(),
      arrival_id: NYC_ARRIVAL[params.destination],
      outbound_date: params.departDate,
      ...(params.returnDate ? { return_date: params.returnDate, type: "1" } : { type: "2" }),
      adults: String(params.adults),
      children: String(params.children),
      infants_on_lap: String(params.infants),
      travel_class: TRAVEL_CLASS[params.cabin],
      currency: params.currency,
      hl: "pt-br",
      gl: "br",
      api_key: config.serpApiKey,
    });
    const res = await cache.memo(`serpapi:flights:${JSON.stringify(params)}`, 15 * MINUTE, () =>
      fetchJson<SerpFlightsResponse>(`https://serpapi.com/search.json?${q}`, { timeoutMs: 30_000 }),
    );
    if (res.error) throw new Error(res.error);
    return serpToItineraries(res, params);
  },
};
