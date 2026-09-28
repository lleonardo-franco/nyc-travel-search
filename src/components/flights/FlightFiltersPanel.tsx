"use client";

import { Moon, Sun, Sunrise, Sunset } from "lucide-react";
import { CheckboxList, FilterSection } from "@/components/ui/filters";
import { flightFacets, maxStops, TIME_WINDOWS, type FlightFilters, type TimeWindow } from "@/lib/filters/flights";
import { AIRPORT_LABELS, formatMoney } from "@/lib/format";
import type { Currency, FlightItinerary } from "@/lib/types";

const STOP_LABELS: Record<string, string> = { "0": "Direto", "1": "1 parada", "2": "2 ou mais paradas" };
const SOURCE_LABELS: Record<string, string> = { kiwi: "Kiwi.com (MCP)", serpapi: "Google Flights", demo: "Demonstração" };
const WINDOW_ICONS = { madrugada: Moon, manha: Sunrise, tarde: Sun, noite: Sunset } as const;

function minPrice(flights: FlightItinerary[], pred: (f: FlightItinerary) => boolean): number | undefined {
  const prices = flights.filter(pred).map((f) => f.price);
  return prices.length ? Math.min(...prices) : undefined;
}

function WindowPicker({ value, onChange }: { value: TimeWindow[]; onChange: (v: TimeWindow[]) => void }) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {(Object.keys(TIME_WINDOWS) as TimeWindow[]).map((w) => {
        const Icon = WINDOW_ICONS[w];
        const on = value.includes(w);
        const [name, range] = TIME_WINDOWS[w].label.split(" ");
        return (
          <button
            key={w}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(on ? value.filter((x) => x !== w) : [...value, w])}
            className={`flex flex-col items-center gap-0.5 rounded-xl border px-2 py-2 text-xs transition ${
              on ? "border-slate-900 bg-slate-900 text-white" : "border-slate-300 text-slate-700 hover:border-slate-500"
            }`}
          >
            <Icon className="h-4 w-4" aria-hidden />
            <span className="font-medium">{name}</span>
            <span className={on ? "text-white/70" : "text-slate-500"}>{range}</span>
          </button>
        );
      })}
    </div>
  );
}

export function FlightFiltersPanel({
  flights,
  filters,
  onChange,
  currency,
  roundTrip,
}: {
  flights: FlightItinerary[];
  filters: FlightFilters;
  onChange: (next: FlightFilters) => void;
  currency: Currency;
  roundTrip: boolean;
}) {
  const facets = flightFacets(flights);
  const set = (patch: Partial<FlightFilters>) => onChange({ ...filters, ...patch });
  const money = (n?: number) => (n != null ? formatMoney(n, currency) : "");

  return (
    <div>
      <FilterSection title="Paradas">
        <CheckboxList
          facets={facets.stops}
          selected={filters.stops.map(String)}
          onChange={(v) => set({ stops: v.map(Number) })}
          render={(v) => STOP_LABELS[v]}
          aside={(f) => money(minPrice(flights, (x) => Math.min(maxStops(x), 2) === Number(f.value)))}
        />
      </FilterSection>

      {facets.price ? (
        <FilterSection title="Preço máximo">
          <input
            type="range"
            min={facets.price.min}
            max={facets.price.max}
            step={Math.max(1, Math.round((facets.price.max - facets.price.min) / 100))}
            value={filters.priceMax ?? facets.price.max}
            onChange={(e) => {
              const v = Number(e.target.value);
              set({ priceMax: v >= facets.price!.max ? undefined : v });
            }}
            className="w-full accent-blue-600"
            aria-label="Preço máximo"
          />
          <p className="mt-1 text-sm text-slate-600">Até {money(filters.priceMax ?? facets.price.max)}</p>
        </FilterSection>
      ) : null}

      <FilterSection title="Horário de partida (ida)">
        <WindowPicker value={filters.departWindows} onChange={(departWindows) => set({ departWindows })} />
      </FilterSection>

      {roundTrip ? (
        <FilterSection title="Horário de partida (volta)">
          <WindowPicker value={filters.returnWindows} onChange={(returnWindows) => set({ returnWindows })} />
        </FilterSection>
      ) : null}

      <FilterSection title="Companhias aéreas">
        <CheckboxList
          facets={facets.airlines}
          selected={filters.airlines}
          onChange={(airlines) => set({ airlines })}
          aside={(f) => money(minPrice(flights, (x) => x.airlines.includes(f.value)))}
        />
      </FilterSection>

      {facets.maxDurationHours ? (
        <FilterSection title="Duração máxima por trecho">
          <input
            type="range"
            min={Math.max(1, Math.floor(Math.min(...flights.map((f) => f.outbound.durationMinutes)) / 60))}
            max={facets.maxDurationHours}
            value={filters.maxDurationHours ?? facets.maxDurationHours}
            onChange={(e) => {
              const v = Number(e.target.value);
              set({ maxDurationHours: v >= facets.maxDurationHours! ? undefined : v });
            }}
            className="w-full accent-blue-600"
            aria-label="Duração máxima"
          />
          <p className="mt-1 text-sm text-slate-600">Até {filters.maxDurationHours ?? facets.maxDurationHours} h</p>
        </FilterSection>
      ) : null}

      <FilterSection title="Aeroporto de chegada em NY">
        <CheckboxList
          facets={facets.arrivalAirports}
          selected={filters.arrivalAirports}
          onChange={(arrivalAirports) => set({ arrivalAirports })}
          render={(v) => AIRPORT_LABELS[v as keyof typeof AIRPORT_LABELS] ?? v}
        />
      </FilterSection>

      <FilterSection title="Bagagem">
        <label className="flex cursor-pointer items-center gap-2.5 text-sm text-slate-700">
          <input type="checkbox" checked={filters.checkedBag} onChange={() => set({ checkedBag: !filters.checkedBag })} className="h-4 w-4 accent-blue-600" />
          Bagagem despachada incluída
        </label>
      </FilterSection>

      {facets.sources.length > 1 ? (
        <FilterSection title="Fontes">
          <CheckboxList facets={facets.sources} selected={filters.sources} onChange={(sources) => set({ sources })} render={(v) => SOURCE_LABELS[v] ?? v} />
        </FilterSection>
      ) : null}
    </div>
  );
}
