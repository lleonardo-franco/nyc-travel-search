"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { addDays, formatMonthTitle, nightsBetween, todayIso } from "@/lib/dates";
import { hotelSearchToQuery } from "@/lib/params";
import type { HotelSearchParams, PriceCalendar as Calendar } from "@/lib/types";

const WEEKDAYS = ["D", "S", "T", "Q", "Q", "S", "S"];

function monthGrid(first: string): (string | null)[] {
  const d = new Date(`${first}T00:00:00Z`);
  const count = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  return [...Array<null>(d.getUTCDay()).fill(null), ...Array.from({ length: count }, (_, i) => addDays(first, i))];
}

function nextMonth(first: string): string {
  const d = new Date(`${first}T00:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + 1);
  return d.toISOString().slice(0, 10);
}

const TONES = {
  cheap: "bg-emerald-100 text-emerald-900 hover:bg-emerald-200",
  average: "bg-amber-50 text-amber-900 hover:bg-amber-100",
  high: "bg-rose-100 text-rose-900 hover:bg-rose-200",
} as const;

/**
 * Calendário de preços por noite (verde = barato, vermelho = caro), como o
 * "flexível nas datas?" dos buscadores. Clicar num dia refaz a busca com o
 * novo check-in mantendo o número de noites.
 */
export function PriceCalendar({ calendar, stay }: { calendar: Calendar; stay: HotelSearchParams }) {
  const pathname = usePathname();
  const nights = nightsBetween(stay.checkin, stay.checkout);
  const tone = new Map<string, keyof typeof TONES>();
  for (const d of calendar.cheap) tone.set(d, "cheap");
  for (const d of calendar.average) tone.set(d, "average");
  for (const d of calendar.high) tone.set(d, "high");
  const today = todayIso();
  const [start, setStart] = useState(`${stay.checkin.slice(0, 7)}-01`);
  const months = [start, nextMonth(start)];
  const cheapInStay = Array.from({ length: nights }, (_, i) => addDays(stay.checkin, i)).filter((d) => tone.get(d) === "cheap").length;

  return (
    <div>
      <p className="mb-4 text-sm text-slate-600">
        {cheapInStay === nights
          ? "Boa escolha: todas as noites da sua estadia estão entre as mais baratas."
          : "Toque em um dia para ver os preços com check-in nessa data (mantendo "}
        {cheapInStay === nights ? "" : `${nights} ${nights === 1 ? "noite" : "noites"}).`}
      </p>
      <div className="grid gap-6 md:grid-cols-2">
        {months.map((first) => (
          <div key={first}>
            <p className="mb-2 text-center text-sm font-semibold">{formatMonthTitle(first)}</p>
            <div className="grid grid-cols-7 gap-1 text-center text-xs text-slate-500">
              {WEEKDAYS.map((w, i) => (
                <span key={i}>{w}</span>
              ))}
            </div>
            <div className="mt-1 grid grid-cols-7 gap-1">
              {monthGrid(first).map((day, i) => {
                if (!day) return <span key={`e${i}`} />;
                const t = tone.get(day);
                const inStay = day >= stay.checkin && day < stay.checkout;
                const past = day < today;
                const cls = `grid h-10 place-items-center rounded-lg text-sm tabular-nums ${
                  t ? TONES[t] : "bg-slate-50 text-slate-400"
                } ${inStay ? "ring-2 ring-blue-600 font-semibold" : ""}`;
                if (past) return <span key={day} className="grid h-10 place-items-center text-sm text-slate-300">{Number(day.slice(8))}</span>;
                return (
                  <Link
                    key={day}
                    href={`${pathname}?${hotelSearchToQuery({ ...stay, checkin: day, checkout: addDays(day, nights), page: 1 })}`}
                    className={cls}
                    title={`Check-in em ${day.split("-").reverse().join("/")}`}
                  >
                    {Number(day.slice(8))}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </div>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-4 text-xs text-slate-600">
          <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded bg-emerald-200" /> Mais barato</span>
          <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded bg-amber-100" /> Médio</span>
          <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded bg-rose-200" /> Mais caro</span>
          <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded ring-2 ring-blue-600" /> Sua estadia</span>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={() => setStart((s) => { const d = new Date(`${s}T00:00:00Z`); d.setUTCMonth(d.getUTCMonth() - 1); return d.toISOString().slice(0, 10); })} disabled={start <= `${today.slice(0, 7)}-01`} className="rounded-full border border-slate-300 px-3 py-1 text-sm disabled:opacity-40">
            ← Mês anterior
          </button>
          <button type="button" onClick={() => setStart(nextMonth(start))} className="rounded-full border border-slate-300 px-3 py-1 text-sm">
            Próximo mês →
          </button>
        </div>
      </div>
    </div>
  );
}
