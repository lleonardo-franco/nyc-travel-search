import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { config } from "@/lib/config";
import { nightsBetween } from "@/lib/dates";
import { applyFlightFilters, EMPTY_FLIGHT_FILTERS, maxStops, type FlightSort } from "@/lib/filters/flights";
import { applyHotelFilters, bestOffer, distanceTo, EMPTY_HOTEL_FILTERS, type HotelSort } from "@/lib/filters/hotels";
import { LANDMARK_IDS, LANDMARKS, type LandmarkId } from "@/lib/geo";
import { hotelHref, offerUrl } from "@/lib/links";
import { parseFlightSearch, parseHotelSearch } from "@/lib/params";
import { searchFlights } from "@/lib/providers/flights";
import { hotelCalendar, hotelDetails, hotelOffers, searchHotels } from "@/lib/providers/hotels";
import { CURRENCIES, NYC_AIRPORTS, type FlightItinerary, type Hotel, type HotelSearchParams } from "@/lib/types";

/**
 * Servidor MCP do projeto: expõe a mesma busca agregada do site como ferramentas
 * para agentes de IA (Claude, ChatGPT, Cursor…). Servido em /api/mcp (HTTP) e
 * via `npm run mcp:stdio`.
 */

const CABINS = { economy: "M", premium_economy: "W", business: "C", first: "F" } as const;

const stayShape = {
  checkin: z.string().describe("Check-in em AAAA-MM-DD"),
  checkout: z.string().describe("Check-out em AAAA-MM-DD"),
  adults: z.number().int().min(1).max(16).default(2),
  rooms: z.number().int().min(1).max(8).default(1),
  children_ages: z.array(z.number().int().min(0).max(17)).max(8).default([]).describe("Idade de cada criança"),
  currency: z.enum(CURRENCIES).default("BRL"),
};

type StayArgs = {
  checkin: string;
  checkout: string;
  adults: number;
  rooms: number;
  children_ages: number[];
  currency: string;
};

function stayParams(args: StayArgs): HotelSearchParams {
  const parsed = parseHotelSearch({
    checkin: args.checkin,
    checkout: args.checkout,
    adultos: String(args.adults),
    quartos: String(args.rooms),
    criancas: args.children_ages.join(","),
    moeda: args.currency,
  });
  if (!parsed.ok) throw new Error(parsed.error);
  return parsed.params;
}

function detailsUrl(hotel: Hotel, params: HotelSearchParams): string {
  return `${config.siteUrl}${hotelHref(hotel, params)}`;
}

function result(data: object) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
    structuredContent: data as Record<string, unknown>,
  };
}

/** Busca as ofertas pendentes (ex.: Xotelo) dos hotéis e devolve cópias com as ofertas preenchidas. */
async function withOffers(hotels: Hotel[], params: HotelSearchParams): Promise<Hotel[]> {
  const ids = hotels.flatMap((h) => h.pendingOfferIds ?? []);
  if (!ids.length) return hotels;
  const offers = await hotelOffers(ids, params);
  return hotels.map((h) => ({
    ...h,
    offers: [...h.offers, ...(h.pendingOfferIds ?? []).flatMap((id) => offers[id] ?? [])].sort(
      (a, b) => a.pricePerNight - b.pricePerNight,
    ),
    pendingOfferIds: [],
  }));
}

function compactFlight(it: FlightItinerary) {
  const leg = (l: FlightItinerary["outbound"]) => ({
    route: l.route.join(" → "),
    departure: l.departureTime,
    arrival: l.arrivalTime,
    duration_minutes: l.durationMinutes,
    stops: l.stops,
    flights: l.segments.map((s) => `${s.flightNumber ?? s.carrier} ${s.from}-${s.to} (${s.carrierName})`),
  });
  return {
    price: it.price,
    currency: it.currency,
    airlines: it.airlines,
    outbound: leg(it.outbound),
    inbound: it.inbound ? leg(it.inbound) : undefined,
    total_duration_minutes: it.totalDurationMinutes,
    checked_bags_included: it.baggage?.checkedBag,
    booking_url: it.bookingUrl,
    source: it.vendor,
    note: it.note,
  };
}

export function createMcpServer(): McpServer {
  const server = new McpServer(
    { name: "nyc-travel-search", version: "0.1.0" },
    {
      instructions:
        "Busca hotéis e passagens aéreas para Nova York agregando fontes públicas (Xotelo/TripAdvisor, " +
        "Kiwi.com via MCP, LiteAPI e Google via SerpApi quando configurados). Datas em AAAA-MM-DD. " +
        "Preços de hotel são por quarto/noite; preços de voo são o total para todos os passageiros.",
    },
  );

  server.registerTool(
    "search_hotels",
    {
      title: "Buscar hotéis em Nova York",
      description:
        "Lista hotéis em Nova York com preços para as datas, comparando sites (Booking.com, Expedia, Agoda…). " +
        "Aceita filtros de preço, nota, bairro e distância a pontos turísticos.",
      inputSchema: {
        ...stayShape,
        max_price_per_night: z.number().positive().optional(),
        min_rating: z.number().min(0).max(5).optional().describe("Nota mínima de 0 a 5"),
        neighborhood: z.string().optional().describe("Parte do nome do bairro, ex.: 'Chelsea', 'Midtown', 'Brooklyn'"),
        near: z.enum(LANDMARK_IDS as [LandmarkId, ...LandmarkId[]]).optional().describe("Ponto de referência"),
        max_distance_km: z.number().positive().optional().describe("Distância máxima até `near` (padrão Times Square)"),
        sort: z.enum(["recommended", "price_asc", "rating", "distance"]).default("recommended"),
        limit: z.number().int().min(1).max(15).default(8),
      },
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    async (args) => {
      const params = stayParams(args);
      const search = await searchHotels(params);
      const neighborhood = args.neighborhood?.toLowerCase();
      const pre = applyHotelFilters(
        search.results.filter(
          (h) => !neighborhood || `${h.neighborhood ?? ""} ${h.borough ?? ""}`.toLowerCase().includes(neighborhood),
        ),
        {
          ...EMPTY_HOTEL_FILTERS,
          minRating: args.min_rating,
          landmark: args.near ?? "times-square",
          maxDistanceKm: args.max_distance_km,
          sort: args.sort === "price_asc" ? "recommended" : (args.sort as HotelSort),
        },
      );
      // Preços para as datas custam uma consulta por hotel: busca só os candidatos do topo.
      const candidates = await withOffers(pre.slice(0, Math.min(args.limit + 6, 20)), params);
      const final = applyHotelFilters(candidates, {
        ...EMPTY_HOTEL_FILTERS,
        onlyWithPrice: true,
        priceMax: args.max_price_per_night,
        landmark: args.near ?? "times-square",
        sort: args.sort as HotelSort,
      }).slice(0, args.limit);

      return result({
        query: { ...params, nights: nightsBetween(params.checkin, params.checkout) },
        demo_data: search.demo,
        results: final.map((h) => {
          const best = bestOffer(h)!;
          const km = distanceTo(h, args.near ?? "times-square");
          return {
            id: h.id,
            name: h.name,
            neighborhood: h.neighborhood,
            type: h.type,
            stars: h.stars,
            rating: h.rating,
            reviews: h.reviewCount,
            best_price_per_night: best.pricePerNight,
            total_price: best.totalPrice,
            currency: best.currency,
            best_vendor: best.vendor,
            other_offers: h.offers.slice(1, 4).map((o) => ({ vendor: o.vendor, price_per_night: o.pricePerNight })),
            distance_km: km != null ? Math.round(km * 10) / 10 : undefined,
            distance_to: LANDMARKS[args.near ?? "times-square"].name,
            image: h.images[0]?.url,
            details_url: detailsUrl(h, params),
          };
        }),
        sources: search.sources.map((s) => ({ name: s.name, ok: s.ok, error: s.error })),
      });
    },
  );

  server.registerTool(
    "get_hotel_details",
    {
      title: "Detalhes e ofertas de um hotel",
      description:
        "Mostra fotos, comodidades, todas as ofertas por site para as datas e as noites mais baratas/caras " +
        "das próximas semanas. Use o `id` retornado por search_hotels.",
      inputSchema: { hotel_id: z.string().describe("ex.: xotelo:g60763-d23448880"), ...stayShape },
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    async (args) => {
      const params = stayParams(args);
      const [hotel, calendar] = await Promise.all([
        hotelDetails(args.hotel_id, params),
        hotelCalendar(args.hotel_id, params),
      ]);
      if (!hotel) return { isError: true, content: [{ type: "text" as const, text: "Hotel não encontrado." }] };
      return result({
        id: hotel.id,
        name: hotel.name,
        type: hotel.type,
        stars: hotel.stars,
        rating: hotel.rating,
        reviews: hotel.reviewCount,
        neighborhood: hotel.neighborhood,
        address: hotel.address,
        location: hotel.location,
        amenities: [...hotel.labels, ...hotel.amenities],
        description: hotel.description?.slice(0, 800),
        images: hotel.images.slice(0, 6).map((i) => i.url),
        offers: hotel.offers.map((o) => ({
          vendor: o.vendor,
          price_per_night: o.pricePerNight,
          total_price: o.totalPrice,
          currency: o.currency,
          refundable: o.refundable,
          url: offerUrl(o, hotel, params),
        })),
        price_calendar: calendar
          ? { cheap_nights: calendar.cheap.slice(0, 20), expensive_nights: calendar.high.slice(0, 20) }
          : undefined,
        details_url: detailsUrl(hotel, params),
      });
    },
  );

  server.registerTool(
    "search_flights",
    {
      title: "Buscar voos para Nova York",
      description:
        "Busca passagens para Nova York (JFK, Newark, LaGuardia) combinando o MCP da Kiwi.com e o Google Flights. " +
        "Omita return_date para só ida. Preço é o total para todos os passageiros.",
      inputSchema: {
        origin: z.string().min(2).max(60).describe("Código IATA ou cidade de origem, ex.: GRU, POA, 'Rio de Janeiro'"),
        destination: z.enum(NYC_AIRPORTS).default("NYC"),
        depart_date: z.string().describe("AAAA-MM-DD"),
        return_date: z.string().optional().describe("AAAA-MM-DD (omita para só ida)"),
        adults: z.number().int().min(1).max(9).default(1),
        children: z.number().int().min(0).max(8).default(0),
        infants: z.number().int().min(0).max(4).default(0),
        cabin: z.enum(["economy", "premium_economy", "business", "first"]).default("economy"),
        currency: z.enum(CURRENCIES).default("BRL"),
        flex_days: z.number().int().min(0).max(3).default(0).describe("Flexibilidade de ± dias nas datas"),
        max_stops: z.number().int().min(0).max(2).optional(),
        sort: z.enum(["best", "price", "duration"]).default("best"),
        limit: z.number().int().min(1).max(15).default(8),
      },
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    async (args) => {
      const parsed = parseFlightSearch({
        origem: args.origin,
        destino: args.destination,
        ida: args.depart_date,
        volta: args.return_date ?? "",
        adultos: String(args.adults),
        criancas: String(args.children),
        bebes: String(args.infants),
        classe: CABINS[args.cabin],
        moeda: args.currency,
        flex: String(args.flex_days),
      });
      if (!parsed.ok) return { isError: true, content: [{ type: "text" as const, text: parsed.error }] };
      const search = await searchFlights(parsed.params);
      const stops = args.max_stops == null ? [] : [0, 1, 2].filter((n) => n <= args.max_stops!);
      const flights = applyFlightFilters(search.results, {
        ...EMPTY_FLIGHT_FILTERS,
        stops,
        sort: args.sort as FlightSort,
      }).slice(0, args.limit);
      return result({
        query: parsed.params,
        demo_data: search.demo,
        results: flights.map(compactFlight),
        cheapest: search.results.length ? Math.min(...search.results.map((f) => f.price)) : undefined,
        direct_available: search.results.some((f) => maxStops(f) === 0),
        sources: search.sources.map((s) => ({ name: s.name, ok: s.ok, error: s.error })),
      });
    },
  );

  server.registerPrompt(
    "planejar_viagem_nyc",
    {
      title: "Planejar viagem para Nova York",
      description: "Monta um roteiro com voo + hotel dentro de um orçamento.",
      argsSchema: {
        origem: z.string().describe("Cidade/aeroporto de origem"),
        ida: z.string().describe("AAAA-MM-DD"),
        volta: z.string().describe("AAAA-MM-DD"),
        orcamento: z.string().optional().describe("Orçamento total, ex.: 'R$ 15.000'"),
      },
    },
    ({ origem, ida, volta, orcamento }) => ({
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text:
              `Quero ir de ${origem} para Nova York de ${ida} a ${volta}` +
              (orcamento ? ` com orçamento total de ${orcamento}` : "") +
              ". Use search_flights para achar as 3 melhores opções de voo e search_hotels para 5 hotéis " +
              "bem avaliados perto do metrô. Depois compare o custo total (voo + hotel) e recomende a melhor combinação.",
          },
        },
      ],
    }),
  );

  return server;
}
