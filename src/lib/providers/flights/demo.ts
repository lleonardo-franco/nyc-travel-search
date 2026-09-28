import { addDays } from "@/lib/dates";
import { pick, seededRandom } from "@/lib/random";
import type { FlightItinerary, FlightLeg, FlightSearchParams } from "@/lib/types";
import type { FlightProvider } from "./types";

/** Voos fictícios para o modo de demonstração (a UI avisa quando aparecem). */

const AIRLINES = [
  { code: "LA", name: "LATAM Airlines", hubs: ["GRU", "LIM"] },
  { code: "AA", name: "American Airlines", hubs: ["MIA", "DFW"] },
  { code: "UA", name: "United Airlines", hubs: ["IAH", "IAD"] },
  { code: "DL", name: "Delta Air Lines", hubs: ["ATL"] },
  { code: "CM", name: "Copa Airlines", hubs: ["PTY"] },
  { code: "AV", name: "Avianca", hubs: ["BOG"] },
];

function time(date: string, minutesFromMidnight: number): string {
  const day = addDays(date, Math.floor(minutesFromMidnight / 1440));
  const m = ((minutesFromMidnight % 1440) + 1440) % 1440;
  return `${day}T${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}:00`;
}

function leg(rand: () => number, from: string, to: string, date: string, airline: (typeof AIRLINES)[number], stops: number): FlightLeg {
  const hubs = stops ? [pick(rand, airline.hubs)] : [];
  const route = [from, ...hubs, to];
  let clock = Math.floor(rand() * 20) * 60 + (rand() > 0.5 ? 30 : 0);
  const start = clock;
  const segments = route.slice(0, -1).map((a, i) => {
    const flight = 240 + Math.floor(rand() * 300);
    const dep = clock;
    clock += flight;
    const seg = {
      from: a,
      to: route[i + 1],
      departureTime: time(date, dep),
      arrivalTime: time(date, clock),
      durationMinutes: flight,
      carrier: airline.code,
      carrierName: airline.name,
      flightNumber: `${airline.code}${100 + Math.floor(rand() * 8900)}`,
      cabinClass: "Economy",
    };
    clock += 90 + Math.floor(rand() * 180);
    return seg;
  });
  const last = segments[segments.length - 1];
  const end = Number(last.arrivalTime.slice(11, 13)) * 60 + Number(last.arrivalTime.slice(14, 16));
  const days = Math.round((Date.parse(last.arrivalTime.slice(0, 10)) - Date.parse(date)) / 86_400_000);
  return {
    from,
    to,
    departureTime: segments[0].departureTime,
    arrivalTime: last.arrivalTime,
    durationMinutes: end + days * 1440 - start,
    stops: route.length - 2,
    route,
    segments,
  };
}

export const demoFlightProvider: FlightProvider = {
  id: "demo",
  name: "Demonstração",
  kind: "demo",
  disabledReason: () => null,

  async search(params: FlightSearchParams) {
    const rand = seededRandom(JSON.stringify(params));
    const origin = params.origin.toUpperCase().slice(0, 3);
    const airports = params.destination === "NYC" ? ["JFK", "EWR", "LGA"] : [params.destination];
    const fx = params.currency === "BRL" ? 5.2 : params.currency === "EUR" ? 0.9 : 1;
    const pax = params.adults + params.children * 0.8 + params.infants * 0.1;
    return Array.from({ length: 18 }, (_, i): FlightItinerary => {
      const airline = pick(rand, AIRLINES);
      const stops = rand() > 0.3 ? 1 : 0;
      const dest = pick(rand, airports);
      const outbound = leg(rand, origin, dest, params.departDate, airline, stops);
      const inbound = params.returnDate ? leg(rand, dest, origin, params.returnDate, airline, stops) : undefined;
      const base = (params.returnDate ? 950 : 560) * (stops ? 1 : 1.35) * (params.cabin === "M" ? 1 : params.cabin === "W" ? 1.7 : 3.8);
      return {
        id: `demo:${i}`,
        source: "demo",
        vendor: "Demonstração",
        price: Math.round(base * (0.85 + rand() * 0.5) * fx * pax),
        currency: params.currency,
        outbound,
        inbound,
        totalDurationMinutes: outbound.durationMinutes + (inbound?.durationMinutes ?? 0),
        airlines: [airline.name],
        airlineCodes: [airline.code],
        baggage: { personalItem: 1, cabinBag: 1, checkedBag: rand() > 0.5 ? params.adults : 0 },
      };
    });
  },
};
