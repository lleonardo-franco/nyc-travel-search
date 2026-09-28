import type { FlightItinerary, FlightSearchParams, ProviderKind } from "@/lib/types";

export interface FlightProvider {
  id: string;
  name: string;
  kind: ProviderKind;
  disabledReason(): string | null;
  search(params: FlightSearchParams): Promise<FlightItinerary[]>;
}
