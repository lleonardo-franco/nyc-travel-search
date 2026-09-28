"use client";

import { MapPin, Search, Users } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Counter, Popover, SearchSegment } from "@/components/ui/Popover";
import { addDays } from "@/lib/dates";
import { guestsSummary } from "@/lib/format";
import { hotelSearchToQuery } from "@/lib/params";
import { CURRENCIES, type Currency, type HotelSearchParams } from "@/lib/types";
import { DateRangePicker } from "./DateRangePicker";

const SEARCH_KEYS = ["checkin", "checkout", "adultos", "quartos", "criancas", "moeda", "pagina"];

export function HotelSearchBar({
  initial,
  variant = "hero",
  target = "/hoteis",
  layout = "row",
}: {
  initial: HotelSearchParams;
  variant?: "hero" | "band";
  /** Página que recebe a busca (a de detalhes do hotel usa a própria URL). */
  target?: string;
  layout?: "row" | "stack";
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();
  const [p, setP] = useState<HotelSearchParams>({ ...initial, page: 1 });
  const set = (patch: Partial<HotelSearchParams>) => setP((prev) => ({ ...prev, ...patch }));

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const checkout = p.checkout > p.checkin ? p.checkout : addDays(p.checkin, 1);
    const query = new URLSearchParams(hotelSearchToQuery({ ...p, checkout, page: 1 }));
    // Na página de resultados, mantém os filtros escolhidos ao trocar datas/hóspedes.
    if (pathname === target) {
      for (const [k, v] of new URLSearchParams(window.location.search)) {
        if (!SEARCH_KEYS.includes(k)) query.set(k, v);
      }
    }
    startTransition(() => router.push(`${target}?${query}`));
  };

  return (
    <form
      onSubmit={submit}
      className={`grid gap-2 ${layout === "row" ? "md:grid-cols-[1fr_1.5fr_1fr_auto]" : ""} ${
        variant === "band" ? "rounded-2xl bg-white p-2 shadow-lg" : ""
      }`}
    >
      {layout === "row" ? <SearchSegment icon={<MapPin className="h-5 w-5" />} label="Destino" value="Nova York, NY, EUA" /> : null}

      <DateRangePicker
        mode="range"
        start={p.checkin}
        end={p.checkout}
        maxSpan={30}
        align={layout === "stack" ? "right" : "left"}
        onChange={(checkin, checkout) => set({ checkin, checkout: checkout ?? "" })}
      />

      <Popover
        align="right"
        panelClassName="w-80"
        trigger={({ toggle, open }) => (
          <SearchSegment
            icon={<Users className="h-5 w-5" />}
            label="Hóspedes"
            value={guestsSummary(p)}
            onClick={toggle}
            active={open}
          />
        )}
      >
        {(close) => (
          <div>
            <Counter label="Quartos" value={p.rooms} min={1} max={8} onChange={(rooms) => set({ rooms, adults: Math.max(p.adults, rooms) })} />
            <Counter label="Adultos" hint="18 anos ou mais" value={p.adults} min={p.rooms} max={16} onChange={(adults) => set({ adults })} />
            <Counter
              label="Crianças"
              hint="0 a 17 anos"
              value={p.childrenAges.length}
              min={0}
              max={8}
              onChange={(n) =>
                set({ childrenAges: n > p.childrenAges.length ? [...p.childrenAges, 8] : p.childrenAges.slice(0, n) })
              }
            />
            {p.childrenAges.length ? (
              <div className="mt-1 grid grid-cols-2 gap-2">
                {p.childrenAges.map((age, i) => (
                  <label key={i} className="text-xs text-slate-600">
                    Idade da criança {i + 1}
                    <select
                      className="mt-1 h-9 w-full rounded-lg border border-slate-300 px-2 text-sm"
                      value={age}
                      onChange={(e) =>
                        set({ childrenAges: p.childrenAges.map((a, j) => (j === i ? Number(e.target.value) : a)) })
                      }
                    >
                      {Array.from({ length: 18 }, (_, a) => (
                        <option key={a} value={a}>
                          {a === 0 ? "Menos de 1" : `${a} ${a === 1 ? "ano" : "anos"}`}
                        </option>
                      ))}
                    </select>
                  </label>
                ))}
              </div>
            ) : null}
            <label className="mt-3 flex items-center justify-between border-t border-slate-100 pt-3 text-sm text-slate-700">
              Mostrar preços em
              <select
                className="h-9 rounded-lg border border-slate-300 px-2 text-sm"
                value={p.currency}
                onChange={(e) => set({ currency: e.target.value as Currency })}
              >
                {CURRENCIES.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </label>
            <button
              type="button"
              onClick={close}
              className="mt-3 w-full rounded-full bg-blue-600 py-2 text-sm font-semibold text-white hover:bg-blue-700"
            >
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
        {pending ? "Buscando…" : layout === "stack" ? "Atualizar preços" : "Buscar"}
      </button>
    </form>
  );
}
