"use client";

import { ChevronLeft, ChevronRight, Grid3x3, X } from "lucide-react";
import { useEffect, useState } from "react";
import { Attribution } from "@/components/wikimedia/Attribution";
import { useWikimedia } from "@/components/wikimedia/useWikimedia";
import type { LatLng } from "@/lib/geo";
import type { HotelImage, NearbyPhoto } from "@/lib/types";
import { loadHotelBuildingPhoto, loadNearbyPhotos, type BuildingPhoto } from "@/lib/wikimedia";

interface Slide {
  src: string;
  full: string;
  caption?: string;
  credit?: NearbyPhoto;
  tag?: string;
}

/**
 * Galeria no estilo Hotels.com: 1 foto grande + 4 menores e "Ver todas as fotos".
 * Junta as fotos do hotel (fontes de preço) com fotos livres do Wikimedia:
 * a do prédio (se o hotel tem artigo na Wikipédia) e as tiradas nos arredores.
 */
export function HotelGallery({
  name,
  images,
  location,
  initialNearby,
  initialBuilding,
}: {
  name: string;
  images: HotelImage[];
  location?: LatLng;
  /** undefined = o servidor não conseguiu consultar; o navegador tenta. */
  initialNearby?: NearbyPhoto[];
  initialBuilding?: BuildingPhoto | null;
}) {
  const coords = location ? `${location.lat.toFixed(4)},${location.lng.toFixed(4)}` : "none";
  const nearby = useWikimedia(`nearby:${coords}`, location ? initialNearby : [], (f) => loadNearbyPhotos(f, location!, 8));
  const building = useWikimedia(`building:${coords}:${name}`, location ? initialBuilding : null, (f) =>
    loadHotelBuildingPhoto(f, location!, name),
  );

  const slides: Slide[] = [
    ...images.map((img) => ({ src: img.thumbnail ?? img.url, full: img.url, caption: img.caption ?? name })),
    ...(building.data
      ? [{ src: building.data.photo.thumbnail, full: building.data.photo.thumbnail, caption: building.data.article, credit: building.data.photo, tag: "Wikipédia" }]
      : []),
    ...(nearby.data ?? []).map((p) => ({ src: p.thumbnail, full: p.thumbnail, caption: p.title, credit: p, tag: "Arredores" })),
  ];
  const loadingExtra = nearby.status === "loading" || building.status === "loading";

  const [open, setOpen] = useState<number | null>(null);
  useEffect(() => {
    if (open == null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(null);
      if (e.key === "ArrowRight") setOpen((i) => (i == null ? i : (i + 1) % slides.length));
      if (e.key === "ArrowLeft") setOpen((i) => (i == null ? i : (i - 1 + slides.length) % slides.length));
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, slides.length]);

  const tile = (i: number, className: string) => {
    const s = slides[i];
    if (!s) {
      return <div key={`empty-${i}`} className={`${className} ${loadingExtra ? "animate-pulse bg-slate-200" : "bg-slate-100"}`} />;
    }
    return (
      <button key={s.src} type="button" onClick={() => setOpen(i)} className={`group relative overflow-hidden bg-slate-200 ${className}`}>
        {/* eslint-disable-next-line @next/next/no-img-element -- CDNs variados */}
        <img src={s.src} alt={s.caption ?? name} referrerPolicy="no-referrer" className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]" />
        {s.tag ? (
          <span className="absolute left-2 top-2 rounded-full bg-black/60 px-2 py-0.5 text-[11px] font-medium text-white">{s.tag}</span>
        ) : null}
      </button>
    );
  };

  const current = open != null ? slides[open] : undefined;

  // Layout se adapta à quantidade de fotos (enquanto carrega, reserva o mosaico 1+4).
  const count = loadingExtra ? Math.max(slides.length, 5) : slides.length;
  const layout =
    count >= 5
      ? { grid: "grid-cols-4 grid-rows-2", tiles: ["col-span-4 row-span-2 md:col-span-2", ...Array(4).fill("hidden md:block")] }
      : count >= 3
        ? { grid: "grid-cols-3 grid-rows-2", tiles: ["col-span-3 row-span-2 md:col-span-2", "hidden md:block", "hidden md:block"] }
        : count === 2
          ? { grid: "grid-cols-2", tiles: ["col-span-2 md:col-span-1", "hidden md:block"] }
          : { grid: "grid-cols-1", tiles: [""] };

  return (
    <>
      <div className={`relative grid h-72 gap-2 overflow-hidden rounded-2xl md:h-[26rem] ${layout.grid}`}>
        {layout.tiles.map((className, i) => tile(i, className))}
        {slides.length > 1 ? (
          <button
            type="button"
            onClick={() => setOpen(0)}
            className="absolute bottom-3 right-3 inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-semibold text-slate-900 shadow-lg"
          >
            <Grid3x3 className="h-4 w-4" aria-hidden /> Ver todas as {slides.length} fotos
          </button>
        ) : null}
      </div>

      {current ? (
        <div className="fixed inset-0 z-[60] flex flex-col bg-black/95 text-white" role="dialog" aria-label="Galeria de fotos">
          <div className="flex items-center justify-between px-4 py-3 text-sm">
            <span>
              {open! + 1} / {slides.length}
            </span>
            <button type="button" onClick={() => setOpen(null)} aria-label="Fechar galeria" className="grid h-10 w-10 place-items-center rounded-full hover:bg-white/10">
              <X className="h-6 w-6" />
            </button>
          </div>
          <div className="relative flex min-h-0 flex-1 items-center justify-center px-14">
            {/* eslint-disable-next-line @next/next/no-img-element -- CDNs variados */}
            <img src={current.full} alt={current.caption ?? name} referrerPolicy="no-referrer" className="max-h-full max-w-full object-contain" />
            <button type="button" aria-label="Anterior" onClick={() => setOpen((open! - 1 + slides.length) % slides.length)} className="absolute left-2 grid h-11 w-11 place-items-center rounded-full bg-white/10 hover:bg-white/20">
              <ChevronLeft className="h-6 w-6" />
            </button>
            <button type="button" aria-label="Próxima" onClick={() => setOpen((open! + 1) % slides.length)} className="absolute right-2 grid h-11 w-11 place-items-center rounded-full bg-white/10 hover:bg-white/20">
              <ChevronRight className="h-6 w-6" />
            </button>
          </div>
          <div className="px-4 py-3 text-center text-sm text-white/80">
            <p className="truncate">{current.caption}</p>
            {current.credit ? <Attribution photo={current.credit} className="text-xs text-white/60" /> : null}
          </div>
          <div className="scroll-thin flex gap-2 overflow-x-auto px-4 pb-4">
            {slides.map((s, i) => (
              <button key={s.src} type="button" onClick={() => setOpen(i)} className={`h-14 w-20 shrink-0 overflow-hidden rounded-md ${i === open ? "ring-2 ring-white" : "opacity-60"}`}>
                {/* eslint-disable-next-line @next/next/no-img-element -- CDNs variados */}
                <img src={s.src} alt="" referrerPolicy="no-referrer" className="h-full w-full object-cover" />
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </>
  );
}
