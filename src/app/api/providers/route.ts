import { config } from "@/lib/config";
import { flightProviderSummary } from "@/lib/providers/flights";
import { hotelProviderSummary } from "@/lib/providers/hotels";

/** Quais fontes estão ativas (sem expor chaves). */
export function GET() {
  return Response.json({
    hotels: hotelProviderSummary(),
    flights: flightProviderSummary(),
    demoMode: config.demoMode,
  });
}
