"use client";

import { PlaneLanding, PlaneTakeoff, Search, Users } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Counter, Popover, SearchSegment } from "@/components/ui/Popover";
import { airportLabel, findAirports } from "@/lib/airports";
import { addDays } from "@/lib/dates";
import { AIRPORT_LABELS, CABIN_LABELS } from "@/lib/format";
import { flightSearchToQuery } from "@/lib/params";
import { CABIN_CLASSES, CURRENCIES, NYC_AIRPORTS, type CabinClass, type Currency, type FlightSearchParams, type NycAirport } from "@/lib/types";
import { DateRangePicker } from "./DateRangePicker";

function passengersSummary(p: FlightSearchParams): string {
  const n = p.adults + p.children + p.infants;
  return `${n} ${n === 1 ? "passageiro" : "passageiros"}, ${CABIN_LABELS[p.cabin]}`;
}

function OriginField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [text, setText] = useState(airportLabel(value));
  const [open, setOpen] = useState(false);
  const matches = findAirports(text === airportLabel(value) ? "" : text);
  return (
    <div className="relative">
      <label className="flex h-14 items-center gap-3 rounded-xl border border-slate-300 px-3 focus-within:border-blue-600 focus-within:ring-2 focus-within:ring-blue-600/20">
        <PlaneTakeoff className="h-5 w-5 shrink-0 text-slate-500" />
        <span className="min-w-0 flex-1">
          <span className="block text-xs text-slate-500">Saindo de</span>
          <input
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              onChange(e.target.value);
              setOpen(true);
            }}
            onFocus={(e) => {
              e.target.select();
              setOpen(true);
            }}
            onBlur={() => setTimeout(() => setOpen(false), 150)}
            placeholder="Cidade ou aeroporto"
            className="block w-full bg-transparent text-sm font-medium text-slate-900 outline-none placeholder:text-slate-400"
            autoComplete="off"
            required
          />
        </span>
      </label>
      {open && matches.length ? (
        <ul className="absolute left-0 right-0 top-full z-50 mt-2 max-h-80 overflow-auto rounded-2xl border border-slate-200 bg-white py-2 shadow-2xl">
          {matches.map((a) => (
            <li key={a.code}>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  onChange(a.code);
                  setText(airportLabel(a.code));
                  setOpen(false);
                }}
                className="flex w-full items-center gap-3 px-4 py-2 text-left hover:bg-slate-50"
              >
                <span className="grid h-9 w-12 place-items-center rounded-lg bg-slate-100 text-xs font-bold text-slate-700">{a.code}</span>
                <span>
                  <span className="block text-sm font-medium text-slate-900">{a.city}</span>
                  <span className="block text-xs text-slate-500">
                    {a.name} · {a.country}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

export function FlightSearchBar({ initial, variant = "hero" }: { initial: FlightSearchParams; variant?: "hero" | "band" }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [p, setP] = useState<FlightSearchParams>(initial);
  const set = (patch: Partial<FlightSearchParams>) => setP((prev) => ({ ...prev, ...patch }));
  const roundTrip = p.returnDate !== undefined;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const returnDate = roundTrip ? (p.returnDate && p.returnDate >= p.departDate ? p.returnDate : addDays(p.departDate, 7)) : undefined;
    startTransition(() => router.push(`/voos?${flightSearchToQuery({ ...p, returnDate })}`));
  };

  const tab = (active: boolean) =>
    `rounded-full px-4 py-1.5 text-sm font-medium transition ${active ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100"}`;

  return (
    <form onSubmit={submit} className={variant === "band" ? "rounded-2xl bg-white p-2 shadow-lg" : ""}>
      <div className="mb-2 flex flex-wrap items-center gap-1">
        <button type="button" className={tab(roundTrip)} onClick={() => set({ returnDate: p.returnDate ?? addDays(p.departDate, 7) })}>
          Ida e volta
        </button>
        <button type="button" className={tab(!roundTrip)} onClick={() => set({ returnDate: undefined })}>
          Só ida
        </button>
        <select
          aria-label="Flexibilidade de datas"
          className="ml-auto h-8 rounded-full border border-slate-300 bg-white px-3 text-xs text-slate-700"
          value={p.flexDays}
          onChange={(e) => set({ flexDays: Number(e.target.value) })}
        >
          <option value={0}>Datas exatas</option>
          <option value={1}>± 1 dia</option>
          <option value={2}>± 2 dias</option>
          <option value={3}>± 3 dias</option>
        </select>
      </div>

      <div className="grid gap-2 md:grid-cols-[1.1fr_1fr_1.4fr_1fr_auto]">
        <OriginField value={p.origin} onChange={(origin) => set({ origin })} />

        <label className="flex h-14 items-center gap-3 rounded-xl border border-slate-300 px-3 focus-within:border-blue-600">
          <PlaneLanding className="h-5 w-5 shrink-0 text-slate-500" />
          <span className="min-w-0 flex-1">
            <span className="block text-xs text-slate-500">Indo para Nova York</span>
            <select
              value={p.destination}
              onChange={(e) => set({ destination: e.target.value as NycAirport })}
              className="block w-full truncate bg-transparent text-sm font-medium text-slate-900 outline-none"
            >
              {NYC_AIRPORTS.map((a) => (
                <option key={a} value={a}>
                  {AIRPORT_LABELS[a]}
                </option>
              ))}
            </select>
          </span>
        </label>

        <DateRangePicker
          mode={roundTrip ? "range" : "single"}
          start={p.departDate}
          end={p.returnDate}
          labels={{ start: "Ida", end: "Volta" }}
          onChange={(departDate, returnDate) => set(roundTrip ? { departDate, returnDate: returnDate ?? "" } : { departDate })}
        />

        <Popover
          align="right"
          panelClassName="w-80"
          trigger={({ toggle, open }) => (
            <SearchSegment icon={<Users className="h-5 w-5" />} label="Passageiros e classe" value={passengersSummary(p)} onClick={toggle} active={open} />
          )}
        >
          {(close) => (
            <div>
              <Counter label="Adultos" hint="12 anos ou mais" value={p.adults} min={1} max={9 - p.children} onChange={(adults) => set({ adults, infants: Math.min(p.infants, adults) })} />
              <Counter label="Crianças" hint="2 a 11 anos" value={p.children} min={0} max={9 - p.adults} onChange={(children) => set({ children })} />
              <Counter label="Bebês" hint="Menos de 2 anos, no colo" value={p.infants} min={0} max={Math.min(4, p.adults)} onChange={(infants) => set({ infants })} />
              <div className="mt-2 grid grid-cols-2 gap-2 border-t border-slate-100 pt-3">
                <label className="text-xs text-slate-600">
                  Classe
                  <select className="mt-1 h-9 w-full rounded-lg border border-slate-300 px-2 text-sm" value={p.cabin} onChange={(e) => set({ cabin: e.target.value as CabinClass })}>
                    {CABIN_CLASSES.map((c) => (
                      <option key={c} value={c}>
                        {CABIN_LABELS[c]}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-xs text-slate-600">
                  Moeda
                  <select className="mt-1 h-9 w-full rounded-lg border border-slate-300 px-2 text-sm" value={p.currency} onChange={(e) => set({ currency: e.target.value as Currency })}>
                    {CURRENCIES.map((c) => (
                      <option key={c}>{c}</option>
                    ))}
                  </select>
                </label>
              </div>
              <button type="button" onClick={close} className="mt-3 w-full rounded-full bg-blue-600 py-2 text-sm font-semibold text-white hover:bg-blue-700">
                Concluir
              </button>
            </div>
          )}
        </Popover>

        <button
          type="submit"
          disabled={pending}
          className="inline-flex h-14 items-center justify-center gap-2 rounded-xl bg-blue-600 px-7 text-base font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:opacity-70"
        >
          <Search className="h-5 w-5" aria-hidden />
          {pending ? "Buscando…" : "Buscar"}
        </button>
      </div>
    </form>
  );
}
