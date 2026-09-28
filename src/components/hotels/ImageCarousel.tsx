"use client";

import { ChevronLeft, ChevronRight, Hotel as HotelIcon } from "lucide-react";
import { useState, type ReactNode } from "react";
import type { HotelImage } from "@/lib/types";

/** Carrossel do card (setas no hover, bolinhas), com fallback quando a imagem falha. */
export function ImageCarousel({
  images,
  alt,
  className = "",
  overlay,
}: {
  images: HotelImage[];
  alt: string;
  className?: string;
  overlay?: ReactNode;
}) {
  const [index, setIndex] = useState(0);
  const [failed, setFailed] = useState<Set<string>>(new Set());
  const usable = images.filter((img) => !failed.has(img.url));
  const current = usable[Math.min(index, usable.length - 1)];
  const go = (delta: number) => setIndex((i) => (i + delta + usable.length) % usable.length);

  return (
    <div className={`group relative overflow-hidden bg-slate-200 ${className}`}>
      {current ? (
        // eslint-disable-next-line @next/next/no-img-element -- fotos vêm de CDNs variados das fontes
        <img
          key={current.url}
          src={current.thumbnail ?? current.url}
          alt={current.caption ?? alt}
          loading="lazy"
          referrerPolicy="no-referrer"
          className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]"
          onError={() => setFailed((prev) => new Set(prev).add(current.url))}
        />
      ) : (
        <div className="grid h-full w-full place-items-center text-slate-400">
          <HotelIcon className="h-10 w-10" aria-hidden />
        </div>
      )}

      {usable.length > 1 ? (
        <>
          <button
            type="button"
            aria-label="Foto anterior"
            onClick={(e) => {
              e.preventDefault();
              go(-1);
            }}
            className="absolute left-2 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-full bg-white/90 text-slate-800 opacity-0 shadow transition group-hover:opacity-100"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button
            type="button"
            aria-label="Próxima foto"
            onClick={(e) => {
              e.preventDefault();
              go(1);
            }}
            className="absolute right-2 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-full bg-white/90 text-slate-800 opacity-0 shadow transition group-hover:opacity-100"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
          <div className="absolute bottom-2 left-1/2 flex -translate-x-1/2 gap-1">
            {usable.slice(0, 6).map((img, i) => (
              <span
                key={img.url}
                className={`h-1.5 w-1.5 rounded-full ${i === Math.min(index, usable.length - 1) ? "bg-white" : "bg-white/50"}`}
              />
            ))}
          </div>
        </>
      ) : null}
      {overlay}
    </div>
  );
}
