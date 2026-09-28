export const CURRENCIES = ["BRL", "USD", "EUR"] as const;
export type Currency = (typeof CURRENCIES)[number];

export type ProviderKind = "api" | "mcp" | "demo";

/** Estado de cada fonte consultada numa busca — exibido na UI e nas respostas do MCP. */
export interface ProviderStatus {
  id: string;
  name: string;
  kind: ProviderKind;
  ok: boolean;
  count: number;
  ms: number;
  error?: string;
  /** true quando a fonte foi ignorada porque não há chave configurada. */
  skipped?: boolean;
}

export interface SearchResponse<T> {
  results: T[];
  sources: ProviderStatus[];
  currency: Currency;
  /** true quando os resultados vêm do provedor de demonstração. */
  demo: boolean;
  page: number;
  hasMore: boolean;
  generatedAt: string;
}

// ---------------------------------------------------------------------------
// Hotéis
// ---------------------------------------------------------------------------

export interface HotelSearchParams {
  checkin: string; // YYYY-MM-DD
  checkout: string; // YYYY-MM-DD
  adults: number;
  rooms: number;
  childrenAges: number[];
  currency: Currency;
  page: number;
}

export interface HotelImage {
  url: string;
  thumbnail?: string;
  caption?: string;
}

export interface HotelOffer {
  /** Provedor que trouxe a oferta (xotelo, liteapi, serpapi, demo). */
  source: string;
  /** Site/agência que vende a diária (Booking.com, Expedia, site do hotel…). */
  vendor: string;
  /** Preço por quarto por noite. */
  pricePerNight: number;
  /** Preço da estadia inteira (todas as noites e quartos). */
  totalPrice: number;
  currency: Currency;
  url?: string;
  refundable?: boolean;
  boardType?: string;
}

export interface Hotel {
  /** `${source}:${nativeId}` */
  id: string;
  source: string;
  nativeId: string;
  name: string;
  type?: string;
  stars?: number;
  /** Nota normalizada de 0 a 5. */
  rating?: number;
  reviewCount?: number;
  address?: string;
  location?: { lat: number; lng: number };
  neighborhood?: string;
  borough?: string;
  images: HotelImage[];
  amenities: string[];
  labels: string[];
  offers: HotelOffer[];
  /** Faixa típica de diária quando ainda não há ofertas para as datas. */
  priceEstimate?: { min: number; max: number; currency: Currency };
  /**
   * IDs (`fonte:id`) cujas ofertas para as datas ainda serão buscadas em /api/hotels/offers.
   * Um hotel mesclado de várias fontes pode ter mais de um.
   */
  pendingOfferIds?: string[];
  url?: string;
  description?: string;
  sources: string[];
}

export interface PriceCalendar {
  cheap: string[];
  average: string[];
  high: string[];
}

export interface NearbyPhoto {
  url: string;
  thumbnail: string;
  title: string;
  author?: string;
  license?: string;
  pageUrl: string;
}

// ---------------------------------------------------------------------------
// Voos
// ---------------------------------------------------------------------------

export const CABIN_CLASSES = ["M", "W", "C", "F"] as const;
export type CabinClass = (typeof CABIN_CLASSES)[number];

export const NYC_AIRPORTS = ["NYC", "JFK", "EWR", "LGA"] as const;
export type NycAirport = (typeof NYC_AIRPORTS)[number];

export interface FlightSearchParams {
  origin: string;
  destination: NycAirport;
  departDate: string; // YYYY-MM-DD
  returnDate?: string; // YYYY-MM-DD
  adults: number;
  children: number;
  infants: number;
  cabin: CabinClass;
  currency: Currency;
  flexDays: number;
}

export interface FlightSegment {
  from: string;
  to: string;
  fromName?: string;
  toName?: string;
  fromCity?: string;
  toCity?: string;
  departureTime: string; // ISO local, sem fuso
  arrivalTime: string;
  durationMinutes?: number;
  carrier: string;
  carrierName: string;
  flightNumber?: string;
  cabinClass?: string;
}

export interface FlightLeg {
  from: string;
  to: string;
  departureTime: string;
  arrivalTime: string;
  durationMinutes: number;
  stops: number;
  route: string[];
  segments: FlightSegment[];
}

export interface FlightItinerary {
  id: string;
  source: string;
  vendor: string;
  /** Preço total para todos os passageiros. */
  price: number;
  currency: Currency;
  outbound: FlightLeg;
  inbound?: FlightLeg;
  totalDurationMinutes: number;
  airlines: string[];
  airlineCodes: string[];
  bookingUrl?: string;
  baggage?: { personalItem: number; cabinBag: number; checkedBag: number };
  emissionsKg?: number;
  /** Observação exibida no card (ex.: detalhes da volta só no site parceiro). */
  note?: string;
}
