"use client";

import { Briefcase, ChevronDown, ExternalLink, Luggage, ShoppingBag } from "lucide-react";
import { useState } from "react";
import { dayOffset, formatDuration, formatTime, formatWeekdayDate } from "@/lib/dates";
import { formatMoney } from "@/lib/format";
import { airlineLogo } from "@/lib/links";
import type { FlightItinerary, FlightLeg } from "@/lib/types";

function minutesBetween(a: string, b: string): number {
  return Math.round((Date.parse(`${b}Z`) - Date.parse(`${a}Z`)) / 60_000);
}

function AirlineLogo({ code, name, size = 32 }: { code: string; name: string; size?: number }) {
  const [failed, setFailed] = useState(false);
  if (!code || failed) {
    return (
      <span className="grid shrink-0 place-items-center rounded-lg bg-slate-100 text-[10px] font-bold text-slate-600" style={{ width: size, height: size }}>
        {(code || name).slice(0, 2).toUpperCase()}
      </span>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element -- logos do CDN da Kiwi.com
    <img src={airlineLogo(code)} alt={name} width={size} height={size} className="shrink-0 rounded-lg" onError={() => setFailed(true)} />
  );
}

function LegRow({ leg, label }: { leg: FlightLeg; label: string }) {
  const carriers = [...new Map(leg.segments.map((s) => [s.carrier, s])).values()];
  const plusDays = dayOffset(leg.departureTime, leg.arrivalTime);
  const layovers = leg.route.slice(1, -1);
  return (
    <div className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-4">
      <div className="flex w-10 flex-col items-center gap-1">
        <AirlineLogo code={carriers[0]?.carrier ?? ""} name={carriers[0]?.carrierName ?? ""} />
      </div>
      <div className="min-w-0">
        <div className="mb-1 flex items-center gap-2 text-xs text-slate-500">
          <span className="font-semibold uppercase tracking-wide text-slate-700">{label}</span>
          <span>{formatWeekdayDate(leg.departureTime)}</span>
          <span className="truncate">· {carriers.map((c) => c.carrierName).join(", ")}</span>
        </div>
        <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3">
          <div>
            <p className="text-lg font-semibold tabular-nums text-slate-900">{formatTime(leg.departureTime)}</p>
            <p className="text-xs font-medium text-slate-500">{leg.from}</p>
          </div>
          <div className="text-center">
            <p className="text-xs text-slate-500">{formatDuration(leg.durationMinutes)}</p>
            <div className="relative my-1 h-px bg-slate-300">
              <div className="absolute inset-0 flex items-center justify-evenly">
                {layovers.map((code) => (
                  <span key={code} className="h-2 w-2 rounded-full border-2 border-white bg-rose-500 ring-1 ring-rose-500" />
                ))}
              </div>
            </div>
            <p className={`text-xs ${leg.stops === 0 ? "font-medium text-emerald-700" : "text-rose-600"}`}>
              {leg.stops === 0 ? "Direto" : `${leg.stops} ${leg.stops === 1 ? "parada" : "paradas"} · ${layovers.join(", ")}`}
            </p>
          </div>
          <div className="text-right">
            <p className="text-lg font-semibold tabular-nums text-slate-900">
              {formatTime(leg.arrivalTime)}
              {plusDays > 0 ? <sup className="ml-0.5 text-xs font-medium text-rose-600">+{plusDays}</sup> : null}
            </p>
            <p className="text-xs font-medium text-slate-500">{leg.to}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function LegDetails({ leg, label }: { leg: FlightLeg; label: string }) {
  return (
    <div>
      <p className="mb-2 text-sm font-semibold text-slate-900">
        {label} · {formatWeekdayDate(leg.departureTime)} · {formatDuration(leg.durationMinutes)}
      </p>
      <ol className="space-y-2">
        {leg.segments.map((s, i) => {
          const next = leg.segments[i + 1];
          return (
            <li key={`${s.flightNumber}-${i}`}>
              <div className="flex gap-3 rounded-xl bg-slate-50 p-3 text-sm">
                <AirlineLogo code={s.carrier} name={s.carrierName} size={28} />
                <div className="min-w-0">
                  <p className="font-medium text-slate-900">
                    {formatTime(s.departureTime)} {s.fromName ?? s.from} ({s.from}) → {formatTime(s.arrivalTime)} {s.toName ?? s.to} ({s.to})
                  </p>
                  <p className="text-xs text-slate-500">
                    {s.carrierName} · voo {s.flightNumber ?? s.carrier}
                    {s.durationMinutes ? ` · ${formatDuration(s.durationMinutes)}` : ""}
                    {s.cabinClass ? ` · ${s.cabinClass}` : ""}
                  </p>
                </div>
              </div>
              {next ? (
                <p className="my-1 pl-12 text-xs text-amber-700">
                  Conexão em {s.toCity ?? s.to}: {formatDuration(minutesBetween(s.arrivalTime, next.departureTime))}
                  {next.from !== s.to ? ` · troca de aeroporto (${s.to} → ${next.from})` : ""}
                </p>
              ) : null}
            </li>
          );
        })}
      </ol>
    </div>
  );
}

const SOURCE_LABEL: Record<string, string> = { kiwi: "Kiwi.com", serpapi: "Google Flights", demo: "Demonstração" };

export function FlightCard({
  flight,
  passengers,
  badges,
}: {
  flight: FlightItinerary;
  passengers: number;
  badges: string[];
}) {
  const [open, setOpen] = useState(false);
  const bags = flight.baggage;
  return (
    <article className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:shadow-md">
      <div className="flex flex-col md:flex-row">
        <div className="min-w-0 flex-1 space-y-4 p-4">
          {badges.length ? (
            <div className="flex flex-wrap gap-2">
              {badges.map((b) => (
                <span key={b} className="rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-semibold text-blue-700">
                  {b}
                </span>
              ))}
            </div>
          ) : null}
          <LegRow leg={flight.outbound} label="Ida" />
          {flight.inbound ? <LegRow leg={flight.inbound} label="Volta" /> : null}
          {flight.note ? <p className="text-xs text-slate-500">{flight.note}</p> : null}
        </div>
        <div className="flex flex-col justify-center gap-2 border-t border-slate-100 p-4 md:w-60 md:border-l md:border-t-0">
          <p className="text-2xl font-bold tabular-nums text-slate-900">{formatMoney(flight.price, flight.currency)}</p>
          <p className="text-xs text-slate-500">
            total {flight.inbound ? "ida e volta" : "só ida"} · {passengers} {passengers === 1 ? "passageiro" : "passageiros"}
          </p>
          {bags ? (
            <div className="flex items-center gap-3 text-xs text-slate-600" aria-label="Bagagem incluída">
              <span className="flex items-center gap-1" title="Item pessoal"><ShoppingBag className="h-4 w-4" aria-hidden />{bags.personalItem}</span>
              <span className="flex items-center gap-1" title="Bagagem de mão"><Briefcase className="h-4 w-4" aria-hidden />{bags.cabinBag}</span>
              <span className={`flex items-center gap-1 ${bags.checkedBag ? "text-emerald-700" : "text-slate-400"}`} title="Bagagem despachada">
                <Luggage className="h-4 w-4" aria-hidden />
                {bags.checkedBag}
              </span>
            </div>
          ) : null}
          {flight.bookingUrl ? (
            <a
              href={flight.bookingUrl}
              target="_blank"
              rel="noopener noreferrer nofollow"
              className="mt-1 inline-flex items-center justify-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700"
            >
              Ver oferta <ExternalLink className="h-4 w-4" aria-hidden />
            </a>
          ) : null}
          <p className="text-center text-xs text-slate-500">
            via {SOURCE_LABEL[flight.source] ?? flight.vendor}
            {flight.source === "kiwi" ? <span className="ml-1 rounded bg-violet-100 px-1 text-[10px] font-semibold text-violet-700">MCP</span> : null}
          </p>
        </div>
      </div>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className="flex w-full items-center justify-center gap-1 border-t border-slate-100 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
      >
        Detalhes do voo <ChevronDown className={`h-4 w-4 transition ${open ? "rotate-180" : ""}`} aria-hidden />
      </button>
      {open ? (
        <div className="grid gap-5 border-t border-slate-100 p-4 lg:grid-cols-2">
          <LegDetails leg={flight.outbound} label="Ida" />
          {flight.inbound ? <LegDetails leg={flight.inbound} label="Volta" /> : null}
        </div>
      ) : null}
    </article>
  );
}

export function FlightCardSkeleton() {
  return (
    <div className="flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white md:flex-row">
      <div className="flex-1 space-y-5 p-4">
        {[0, 1].map((i) => (
          <div key={i} className="flex items-center gap-4">
            <div className="h-8 w-8 animate-pulse rounded-lg bg-slate-200" />
            <div className="h-6 flex-1 animate-pulse rounded bg-slate-100" />
          </div>
        ))}
      </div>
      <div className="space-y-2 border-t border-slate-100 p-4 md:w-60 md:border-l md:border-t-0">
        <div className="h-7 w-28 animate-pulse rounded bg-slate-200" />
        <div className="h-10 animate-pulse rounded-xl bg-slate-100" />
      </div>
    </div>
  );
}
