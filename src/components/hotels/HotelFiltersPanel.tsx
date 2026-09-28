"use client";

import { Search } from "lucide-react";
import { CheckboxList, FilterSection, PillGroup, PriceRange } from "@/components/ui/filters";
import { hotelFacets, nightlyPrice, type HotelFilters } from "@/lib/filters/hotels";
import { formatMoney } from "@/lib/format";
import { LANDMARK_IDS, LANDMARKS, type LandmarkId } from "@/lib/geo";
import type { Currency, Hotel } from "@/lib/types";

const POPULAR = ["Café da manhã incluso", "Cancelamento grátis", "Wi-Fi grátis", "Piscina", "Academia", "Aceita pets", "Estacionamento"];

const RATING_OPTIONS = [
  { value: 0, label: "Qualquer" },
  { value: 3.5, label: "Bom 7+" },
  { value: 4, label: "Muito bom 8+" },
  { value: 4.5, label: "Maravilhoso 9+" },
];

const DISTANCES = [0.5, 1, 2, 3, 5];

export function HotelFiltersPanel({
  hotels,
  filters,
  onChange,
  currency,
}: {
  hotels: Hotel[];
  filters: HotelFilters;
  onChange: (next: HotelFilters) => void;
  currency: Currency;
}) {
  const facets = hotelFacets(hotels);
  const set = (patch: Partial<HotelFilters>) => onChange({ ...filters, ...patch });
  const prices = hotels.flatMap((h) => nightlyPrice(h) ?? []);
  const popular = POPULAR.flatMap((label) => facets.labels.find((f) => f.value === label) ?? []);
  const otherLabels = facets.labels.filter((f) => !POPULAR.includes(f.value));

  return (
    <div>
      <FilterSection title="Buscar pelo nome">
        <label className="flex h-10 items-center gap-2 rounded-xl border border-slate-300 px-3 focus-within:border-blue-600">
          <Search className="h-4 w-4 text-slate-400" aria-hidden />
          <input
            value={filters.q}
            onChange={(e) => set({ q: e.target.value })}
            placeholder="ex.: Hilton, Arlo, Pod"
            className="w-full bg-transparent text-sm outline-none"
          />
        </label>
      </FilterSection>

      <FilterSection title="Filtros populares">
        <div className="space-y-1.5">
          <label className="flex cursor-pointer items-center gap-2.5 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={filters.onlyWithPrice}
              onChange={() => set({ onlyWithPrice: !filters.onlyWithPrice })}
              className="h-4 w-4 accent-blue-600"
            />
            Só com preço para as minhas datas
          </label>
          {popular.length ? (
            <CheckboxList facets={popular} selected={filters.labels} onChange={(labels) => set({ labels })} initialVisible={8} />
          ) : null}
        </div>
      </FilterSection>

      {facets.price ? (
        <FilterSection title="Preço por noite">
          <PriceRange
            prices={prices}
            bounds={facets.price}
            min={filters.priceMin}
            max={filters.priceMax}
            onChange={(priceMin, priceMax) => set({ priceMin, priceMax })}
            format={(n) => formatMoney(n, currency)}
          />
        </FilterSection>
      ) : null}

      <FilterSection title="Nota dos hóspedes">
        <PillGroup options={RATING_OPTIONS} value={filters.minRating ?? 0} onChange={(v) => set({ minRating: v || undefined })} />
      </FilterSection>

      {facets.stars.length ? (
        <FilterSection title="Classificação por estrelas">
          <div className="flex flex-wrap gap-2">
            {[5, 4, 3, 2].map((s) => {
              const on = filters.stars.includes(s);
              return (
                <button
                  key={s}
                  type="button"
                  aria-pressed={on}
                  onClick={() => set({ stars: on ? filters.stars.filter((x) => x !== s) : [...filters.stars, s] })}
                  className={`rounded-full border px-3 py-1.5 text-sm ${on ? "border-slate-900 bg-slate-900 text-white" : "border-slate-300 text-slate-700"}`}
                >
                  {s} ★
                </button>
              );
            })}
          </div>
        </FilterSection>
      ) : null}

      <FilterSection title="Distância">
        <div className="space-y-3">
          <select
            aria-label="Ponto de referência"
            value={filters.landmark}
            onChange={(e) => set({ landmark: e.target.value as LandmarkId })}
            className="h-10 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm"
          >
            {LANDMARK_IDS.map((id) => (
              <option key={id} value={id}>
                De {LANDMARKS[id].name}
              </option>
            ))}
          </select>
          <PillGroup
            options={[{ value: 0, label: "Qualquer" }, ...DISTANCES.map((d) => ({ value: d, label: `até ${d.toLocaleString("pt-BR")} km` }))]}
            value={filters.maxDistanceKm ?? 0}
            onChange={(v) => set({ maxDistanceKm: v || undefined })}
          />
        </div>
      </FilterSection>

      <FilterSection title="Bairro">
        <CheckboxList facets={facets.neighborhoods} selected={filters.neighborhoods} onChange={(neighborhoods) => set({ neighborhoods })} />
      </FilterSection>

      {facets.vendors.length ? (
        <FilterSection title="Sites de reserva">
          <CheckboxList facets={facets.vendors} selected={filters.vendors} onChange={(vendors) => set({ vendors })} />
        </FilterSection>
      ) : null}

      {facets.types.length > 1 ? (
        <FilterSection title="Tipo de hospedagem">
          <CheckboxList facets={facets.types} selected={filters.types} onChange={(types) => set({ types })} />
        </FilterSection>
      ) : null}

      {otherLabels.length ? (
        <FilterSection title="Comodidades" defaultOpen={false}>
          <CheckboxList facets={otherLabels} selected={filters.labels} onChange={(labels) => set({ labels })} />
        </FilterSection>
      ) : null}
    </div>
  );
}
