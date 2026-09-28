"use client";

import type { LatLng } from "@/lib/geo";
import type { NearbyPhoto } from "@/lib/types";
import { loadNearbyPhotos } from "@/lib/wikimedia";
import { Attribution } from "./Attribution";
import { useWikimedia } from "./useWikimedia";

/** Grade "Como é a vizinhança" com fotos livres do Wikimedia Commons perto do hotel. */
export function NearbyPhotos({ point, initial }: { point: LatLng; initial?: NearbyPhoto[] }) {
  const key = `nearby:${point.lat.toFixed(4)},${point.lng.toFixed(4)}`;
  const { data, status } = useWikimedia(key, initial, (f) => loadNearbyPhotos(f, point, 8));

  if (status === "loading") {
    return (
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="aspect-[4/3] animate-pulse rounded-xl bg-slate-200" />
        ))}
      </div>
    );
  }
  if (status === "error") {
    return <p className="text-sm text-slate-500">As fotos do Wikimedia estão indisponíveis agora. Recarregue a página em instantes.</p>;
  }
  if (!data?.length) {
    return <p className="text-sm text-slate-500">Não encontramos fotos livres tiradas perto deste hotel.</p>;
  }
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
      {data.map((p) => (
        <figure key={p.pageUrl} className="min-w-0">
          <a href={p.pageUrl} target="_blank" rel="noreferrer" className="block aspect-[4/3] overflow-hidden rounded-xl bg-slate-200">
            {/* eslint-disable-next-line @next/next/no-img-element -- imagens do Wikimedia */}
            <img src={p.thumbnail} alt={p.title} loading="lazy" className="h-full w-full object-cover transition hover:scale-105" />
          </a>
          <figcaption className="mt-1 text-xs text-slate-600">
            <span className="block truncate font-medium text-slate-800">{p.title}</span>
            <Attribution photo={p} className="text-slate-500" />
          </figcaption>
        </figure>
      ))}
    </div>
  );
}
