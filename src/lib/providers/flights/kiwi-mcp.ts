import { cache, MINUTE } from "@/lib/cache";
import { config } from "@/lib/config";
import { toDayMonthYear } from "@/lib/dates";
import { callMcpTool } from "@/lib/mcp/client";
import type { FlightItinerary, FlightLeg, FlightSearchParams } from "@/lib/types";
import type { FlightProvider } from "./types";

/**
 * Kiwi.com via servidor MCP oficial e público (https://mcp.kiwi.com) — sem chave.
 * A ferramenta `search-flight` devolve só ~15 itinerários (os mais baratos, e o
 * parâmetro `sort` não muda isso), quase sempre da mesma companhia. Para ter a
 * variedade de um buscador de verdade fazemos três consultas:
 *   1. mais baratos + 2. só voos diretos (em paralelo);
 *   3. excluindo as companhias já vistas — traz outras opções.
 */

interface KiwiSegment {
  from: string;
  to: string;
  fromCity?: string;
  toCity?: string;
  fromName?: string;
  toName?: string;
  departureTime: string;
  arrivalTime: string;
  durationSeconds?: number;
  carrier: string;
  carrierName?: string;
  flightNumber?: string;
  cabinClass?: string;
}

interface KiwiLeg {
  from: string;
  to: string;
  departureTime: string;
  arrivalTime: string;
  durationSeconds: number;
  stops: number;
  route: string[];
  segments: KiwiSegment[];
}

interface KiwiItinerary {
  id?: string | null;
  price?: number | null;
  totalDurationSeconds?: number;
  bookingUrl?: string;
  baggage?: { personalItem: number; cabinBag: number; checkedBag: number };
  outbound?: KiwiLeg;
  inbound?: KiwiLeg | null;
}

export interface KiwiSearchResult {
  currency?: string | null;
  resultsCount?: number;
  itineraries?: KiwiItinerary[];
  error?: string | null;
}

function toLeg(leg: KiwiLeg): FlightLeg {
  return {
    from: leg.from,
    to: leg.to,
    departureTime: leg.departureTime,
    arrivalTime: leg.arrivalTime,
    durationMinutes: Math.round(leg.durationSeconds / 60),
    stops: leg.stops,
    route: leg.route,
    segments: leg.segments.map((s) => ({
      from: s.from,
      to: s.to,
      fromName: s.fromName,
      toName: s.toName,
      fromCity: s.fromCity,
      toCity: s.toCity,
      departureTime: s.departureTime,
      arrivalTime: s.arrivalTime,
      durationMinutes: s.durationSeconds != null ? Math.round(s.durationSeconds / 60) : undefined,
      carrier: s.carrier,
      carrierName: s.carrierName || s.carrier,
      flightNumber: s.flightNumber,
      cabinClass: s.cabinClass,
    })),
  };
}

export function kiwiToItineraries(result: KiwiSearchResult, params: FlightSearchParams): FlightItinerary[] {
  const out: FlightItinerary[] = [];
  for (const it of result.itineraries ?? []) {
    if (!it.outbound || it.price == null) continue;
    const outbound = toLeg(it.outbound);
    const inbound = it.inbound ? toLeg(it.inbound) : undefined;
    const segments = [...outbound.segments, ...(inbound?.segments ?? [])];
    const airlines = [...new Set(segments.map((s) => s.carrierName))];
    const airlineCodes = [...new Set(segments.map((s) => s.carrier))];
    out.push({
      id: `kiwi:${it.id ?? `${outbound.departureTime}-${outbound.route.join("")}-${it.price}`}`,
      source: "kiwi",
      vendor: "Kiwi.com",
      price: it.price,
      currency: params.currency,
      outbound,
      inbound,
      totalDurationMinutes: Math.round(
        (it.totalDurationSeconds ?? outbound.durationMinutes * 60 + (inbound?.durationMinutes ?? 0) * 60) / 60,
      ),
      airlines,
      airlineCodes,
      bookingUrl: it.bookingUrl,
      baggage: it.baggage,
    });
  }
  return out;
}

function toolArgs(params: FlightSearchParams): Record<string, unknown> {
  return {
    flyFrom: params.origin,
    flyTo: params.destination,
    departureDate: toDayMonthYear(params.departDate),
    departureDateFlexDays: params.flexDays,
    ...(params.returnDate
      ? { returnDate: toDayMonthYear(params.returnDate), returnDateFlexDays: params.flexDays }
      : {}),
    adults: params.adults,
    children: params.children,
    infants: params.infants,
    cabinClass: params.cabin,
    currency: params.currency,
    locale: "pt",
  };
}

export const kiwiMcpProvider: FlightProvider = {
  id: "kiwi",
  name: "Kiwi.com (MCP)",
  kind: "mcp",

  disabledReason: () => (config.kiwiEnabled ? null : "desligado em KIWI_MCP_ENABLED"),

  async search(params) {
    const key = `kiwi:${JSON.stringify(params)}`;
    return cache.memo(key, 15 * MINUTE, async () => {
      const call = (extra: Record<string, unknown>) =>
        callMcpTool<KiwiSearchResult>(config.kiwiMcpUrl, "search-flight", { ...toolArgs(params), ...extra });

      const first = await Promise.allSettled([call({}), call({ max_sector_stopovers: 0 })]);
      const results = first.flatMap((s) => (s.status === "fulfilled" ? [s.value] : []));
      if (!results.length) {
        const failed = first[0];
        throw failed.status === "rejected" ? failed.reason : new Error("sem resposta do MCP");
      }

      const seen = new Set(results.flatMap((r) => (r.itineraries ?? []).flatMap((it) => it.outbound?.segments.map((s) => s.carrier) ?? [])));
      if (seen.size) {
        // Códigos IATA têm 2 caracteres: 60 códigos cabem no limite de 200 da ferramenta.
        const others = await call({ exclude_airlines: [...seen].slice(0, 60).join(",") }).catch(() => null);
        if (others) results.push(others);
      }

      const apiError = results.find((r) => r.error)?.error;
      const byId = new Map<string, FlightItinerary>();
      for (const result of results) {
        for (const it of kiwiToItineraries(result, params)) if (!byId.has(it.id)) byId.set(it.id, it);
      }
      if (!byId.size && apiError) throw new Error(apiError);
      return [...byId.values()];
    });
  },
};
