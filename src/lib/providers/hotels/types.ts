import type { Hotel, HotelOffer, HotelSearchParams, PriceCalendar, ProviderKind } from "@/lib/types";

export interface HotelProvider {
  id: string;
  name: string;
  kind: ProviderKind;
  /** Motivo de estar desligado (ex.: falta de chave) ou null se pode ser usado. */
  disabledReason(): string | null;
  /** Lista hotéis para uma página da busca. Hotéis com `pendingOfferIds` recebem as ofertas depois, via `offers`. */
  search(params: HotelSearchParams): Promise<{ hotels: Hotel[]; hasMore: boolean }>;
  /** Busca ofertas (por ID nativo) dos hotéis com `pendingOfferIds`. */
  offers?(nativeIds: string[], params: HotelSearchParams): Promise<Record<string, HotelOffer[]>>;
  /** Dados completos de um hotel (galeria, descrição, comodidades). */
  details(nativeId: string, params: HotelSearchParams): Promise<Hotel | null>;
  /** Calendário de preços (dias baratos/caros para o check-in). */
  calendar?(nativeId: string, params: HotelSearchParams): Promise<PriceCalendar | null>;
}
