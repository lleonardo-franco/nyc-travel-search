"use client";

import dynamic from "next/dynamic";
import type { Currency, Hotel } from "@/lib/types";

const HotelsMap = dynamic(() => import("./HotelsMap"), {
  ssr: false,
  loading: () => <div className="h-full w-full animate-pulse bg-slate-200" />,
});

/** Mapa de um hotel só (Leaflet é carregado apenas no navegador). */
export function HotelLocationMap({ hotel, currency }: { hotel: Hotel; currency: Currency }) {
  return <HotelsMap hotels={[hotel]} currency={currency} single />;
}
