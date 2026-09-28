"use client";

import { BedDouble, Plane } from "lucide-react";
import { useState } from "react";
import { FlightSearchBar } from "@/components/search/FlightSearchBar";
import { HotelSearchBar } from "@/components/search/HotelSearchBar";
import type { FlightSearchParams, HotelSearchParams } from "@/lib/types";

/** Caixa de busca da home com abas, como Expedia/Hotels.com. */
export function SearchTabs({ hotel, flight }: { hotel: HotelSearchParams; flight: FlightSearchParams }) {
  const [tab, setTab] = useState<"hotel" | "flight">("hotel");
  const tabs = [
    { id: "hotel" as const, label: "Hotéis", icon: BedDouble },
    { id: "flight" as const, label: "Voos", icon: Plane },
  ];
  return (
    <div className="rounded-3xl bg-white p-4 shadow-2xl ring-1 ring-black/5 md:p-5">
      <div className="mb-4 flex gap-6 border-b border-slate-200" role="tablist">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            onClick={() => setTab(id)}
            className={`-mb-px flex items-center gap-2 border-b-2 pb-3 text-sm font-semibold transition ${
              tab === id ? "border-blue-600 text-blue-700" : "border-transparent text-slate-500 hover:text-slate-900"
            }`}
          >
            <Icon className="h-4 w-4" aria-hidden />
            {label}
          </button>
        ))}
      </div>
      {tab === "hotel" ? <HotelSearchBar initial={hotel} /> : <FlightSearchBar initial={flight} />}
    </div>
  );
}
