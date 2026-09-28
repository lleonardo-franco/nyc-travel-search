import { nightsBetween } from "@/lib/dates";
import { neighborhoodOf } from "@/lib/geo";
import type { Hotel, HotelOffer, HotelSearchParams } from "@/lib/types";

export function stayMultiplier(params: HotelSearchParams): number {
  return nightsBetween(params.checkin, params.checkout) * params.rooms;
}

export function sortOffers(offers: HotelOffer[]): HotelOffer[] {
  return [...offers].sort((a, b) => a.pricePerNight - b.pricePerNight);
}

/** Preenche bairro/região a partir das coordenadas. */
export function withNeighborhood(hotel: Hotel): Hotel {
  if (!hotel.location || hotel.neighborhood) return hotel;
  const n = neighborhoodOf(hotel.location);
  return n ? { ...hotel, neighborhood: n.neighborhood, borough: n.borough } : hotel;
}

// Rótulos vindos das fontes (em inglês) traduzidos para exibição e filtro.
const LABEL_TRANSLATIONS: Record<string, string> = {
  "breakfast included": "Café da manhã incluso",
  "free breakfast": "Café da manhã incluso",
  "free cancellation": "Cancelamento grátis",
  "free wi-fi": "Wi-Fi grátis",
  "free wifi": "Wi-Fi grátis",
  "wi-fi": "Wi-Fi",
  "wifi": "Wi-Fi",
  "pool": "Piscina",
  "indoor pool": "Piscina coberta",
  "outdoor pool": "Piscina",
  "fitness centre": "Academia",
  "fitness center": "Academia",
  "fitness centre/gym": "Academia",
  "gym": "Academia",
  "spa": "Spa",
  "restaurant": "Restaurante",
  "bar": "Bar",
  "pet-friendly": "Aceita pets",
  "pets allowed": "Aceita pets",
  "pet friendly": "Aceita pets",
  "air conditioning": "Ar-condicionado",
  "air-conditioned": "Ar-condicionado",
  "parking": "Estacionamento",
  "free parking": "Estacionamento grátis",
  "airport shuttle": "Transfer do aeroporto",
  "kitchen": "Cozinha",
  "kitchen in some rooms": "Cozinha",
  "accessible": "Acessível",
  "wheelchair accessible": "Acessível",
  "room service": "Serviço de quarto",
  "business centre": "Business center",
  "business center": "Business center",
  "non-smoking rooms": "Quartos para não fumantes",
  "24-hour front desk": "Recepção 24h",
  "laundry service": "Lavanderia",
  "full-service laundry": "Lavanderia",
  "family rooms": "Quartos família",
  "child-friendly": "Bom para crianças",
  "hot tub": "Banheira de hidromassagem",
};

export function translateLabel(label: string): string {
  return LABEL_TRANSLATIONS[label.trim().toLowerCase()] ?? label.trim();
}

export function uniqueLabels(labels: string[]): string[] {
  return [...new Set(labels.map(translateLabel).filter(Boolean))];
}

const TYPE_TRANSLATIONS: Record<string, string> = {
  hotel: "Hotel",
  hotels: "Hotel",
  "bed and breakfast": "Pousada / B&B",
  "b&b": "Pousada / B&B",
  inn: "Pousada / B&B",
  hostel: "Hostel",
  "specialty lodging": "Hospedagem especial",
  motel: "Motel",
  apartment: "Apartamento",
  "vacation rental": "Casa de temporada",
  "aparthotel": "Apart-hotel",
  resort: "Resort",
};

export function translateType(type: string | undefined): string | undefined {
  if (!type) return undefined;
  return TYPE_TRANSLATIONS[type.trim().toLowerCase()] ?? type.trim();
}
