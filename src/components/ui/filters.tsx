"use client";

import { ChevronDown } from "lucide-react";
import { useState, type ReactNode } from "react";
import type { Facet } from "@/lib/filters/common";

export function FilterSection({ title, children, defaultOpen = true }: { title: string; children: ReactNode; defaultOpen?: boolean }) {
  return (
    <details open={defaultOpen} className="group border-b border-slate-200 py-4 last:border-b-0">
      <summary className="flex cursor-pointer items-center justify-between text-sm font-semibold text-slate-900">
        {title}
        <ChevronDown className="h-4 w-4 text-slate-500 transition group-open:rotate-180" aria-hidden />
      </summary>
      <div className="mt-3">{children}</div>
    </details>
  );
}

export function CheckboxList({
  facets,
  selected,
  onChange,
  render = (v) => v,
  aside,
  initialVisible = 6,
}: {
  facets: Facet[];
  selected: string[];
  onChange: (next: string[]) => void;
  render?: (value: string) => ReactNode;
  /** Conteúdo à direita (ex.: menor preço da opção); padrão: contagem. */
  aside?: (facet: Facet) => ReactNode;
  initialVisible?: number;
}) {
  const [expanded, setExpanded] = useState(false);
  const shown = expanded ? facets : facets.slice(0, initialVisible);
  if (!facets.length) return <p className="text-xs text-slate-500">Nenhuma opção nos resultados.</p>;
  return (
    <div className="space-y-1.5">
      {shown.map((f) => {
        const checked = selected.includes(f.value);
        return (
          <label key={f.value} className="flex cursor-pointer items-center gap-2.5 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={checked}
              onChange={() => onChange(checked ? selected.filter((s) => s !== f.value) : [...selected, f.value])}
              className="h-4 w-4 rounded border-slate-300 accent-blue-600"
            />
            <span className="min-w-0 flex-1 truncate">{render(f.value)}</span>
            <span className="text-xs tabular-nums text-slate-500">{aside ? aside(f) : f.count}</span>
          </label>
        );
      })}
      {facets.length > initialVisible ? (
        <button type="button" onClick={() => setExpanded(!expanded)} className="pt-1 text-sm font-medium text-blue-700 hover:underline">
          {expanded ? "Mostrar menos" : `Mostrar todos (${facets.length})`}
        </button>
      ) : null}
    </div>
  );
}

export function PillGroup<T extends string | number>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: ReactNode }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => (
        <button
          key={String(o.value)}
          type="button"
          onClick={() => onChange(o.value)}
          aria-pressed={o.value === value}
          className={`rounded-full border px-3 py-1.5 text-sm transition ${
            o.value === value ? "border-slate-900 bg-slate-900 text-white" : "border-slate-300 text-slate-700 hover:border-slate-500"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/**
 * Faixa de preço com histograma (como Airbnb/Hotels.com): duas alças sobre as barras
 * de distribuição dos preços encontrados.
 */
export function PriceRange({
  prices,
  bounds,
  min,
  max,
  onChange,
  format,
  bins = 24,
}: {
  prices: number[];
  bounds: { min: number; max: number };
  min?: number;
  max?: number;
  onChange: (min: number | undefined, max: number | undefined) => void;
  format: (n: number) => string;
  bins?: number;
}) {
  const span = Math.max(1, bounds.max - bounds.min);
  const step = Math.max(1, Math.round(span / 100));
  const lo = min ?? bounds.min;
  const hi = max ?? bounds.max;
  const counts = Array<number>(bins).fill(0);
  for (const p of prices) counts[Math.min(bins - 1, Math.floor(((p - bounds.min) / span) * bins))]++;
  const peak = Math.max(1, ...counts);

  const commit = (nextLo: number, nextHi: number) =>
    onChange(nextLo <= bounds.min ? undefined : nextLo, nextHi >= bounds.max ? undefined : nextHi);

  const thumb =
    "pointer-events-none absolute inset-x-0 bottom-0 h-6 w-full appearance-none bg-transparent [&::-moz-range-thumb]:pointer-events-auto [&::-moz-range-thumb]:h-5 [&::-moz-range-thumb]:w-5 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border [&::-moz-range-thumb]:border-slate-400 [&::-moz-range-thumb]:bg-white [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border [&::-webkit-slider-thumb]:border-slate-400 [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:shadow";

  return (
    <div>
      <div className="flex h-14 items-end gap-px px-2.5" aria-hidden>
        {counts.map((c, i) => {
          const binLo = bounds.min + (i / bins) * span;
          const inside = binLo + span / bins >= lo && binLo <= hi;
          return (
            <span
              key={i}
              className={`flex-1 rounded-t-sm ${inside ? "bg-blue-500/70" : "bg-slate-200"}`}
              style={{ height: `${c ? Math.max(8, (c / peak) * 100) : 3}%` }}
            />
          );
        })}
      </div>
      <div className="relative h-6">
        <div className="absolute inset-x-2.5 bottom-2.5 h-1 rounded bg-slate-200" />
        <div
          className="absolute bottom-2.5 h-1 rounded bg-blue-600"
          style={{
            left: `calc(10px + ${((lo - bounds.min) / span) * 100}% - ${((lo - bounds.min) / span) * 20}px)`,
            right: `calc(10px + ${((bounds.max - hi) / span) * 100}% - ${((bounds.max - hi) / span) * 20}px)`,
          }}
        />
        <input
          type="range"
          aria-label="Preço mínimo"
          min={bounds.min}
          max={bounds.max}
          step={step}
          value={lo}
          onChange={(e) => commit(Math.min(Number(e.target.value), hi - step), hi)}
          className={thumb}
        />
        <input
          type="range"
          aria-label="Preço máximo"
          min={bounds.min}
          max={bounds.max}
          step={step}
          value={hi}
          onChange={(e) => commit(lo, Math.max(Number(e.target.value), lo + step))}
          className={thumb}
        />
      </div>
      <div className="mt-2 flex justify-between text-sm">
        <span className="rounded-lg border border-slate-300 px-2 py-1 tabular-nums">{format(lo)}</span>
        <span className="rounded-lg border border-slate-300 px-2 py-1 tabular-nums">
          {format(hi)}
          {max == null ? "+" : ""}
        </span>
      </div>
    </div>
  );
}
