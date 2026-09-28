"use client";

import Link from "next/link";
import { Attribution } from "@/components/wikimedia/Attribution";
import { useWikimedia } from "@/components/wikimedia/useWikimedia";
import { PLACE_TITLES, PLACES, placeHref } from "@/lib/places";
import type { NearbyPhoto } from "@/lib/types";
import { loadPlacePhotos } from "@/lib/wikimedia";

const GRADIENTS = [
  "from-indigo-500 to-sky-400",
  "from-emerald-600 to-lime-400",
  "from-rose-500 to-orange-400",
  "from-slate-700 to-slate-400",
];

/** Cards "Explore por região" com a foto principal do artigo da Wikipédia de cada lugar. */
export function PlaceCards({ initial }: { initial?: Record<string, NearbyPhoto> }) {
  const { data, status } = useWikimedia("places:home", initial, (f) => loadPlacePhotos(f, PLACE_TITLES));
  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
      {PLACES.map((place, i) => {
        const photo = data?.[place.title];
        return (
          <div key={place.title} className="group">
            <Link href={placeHref(place.filter)} className="relative block aspect-[4/5] overflow-hidden rounded-2xl">
              {photo ? (
                // eslint-disable-next-line @next/next/no-img-element -- imagens do Wikimedia
                <img src={photo.thumbnail} alt={place.name} loading="lazy" className="h-full w-full object-cover transition duration-500 group-hover:scale-105" />
              ) : (
                <div className={`h-full w-full bg-gradient-to-br ${GRADIENTS[i % GRADIENTS.length]} ${status === "loading" ? "animate-pulse" : ""}`} />
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/10 to-transparent" />
              <div className="absolute inset-x-0 bottom-0 p-4 text-white">
                <p className="text-lg font-bold">{place.name}</p>
                <p className="text-sm text-white/85">{place.blurb}</p>
              </div>
            </Link>
            {photo ? <Attribution photo={photo} className="mt-1 text-[11px] text-slate-400" /> : null}
          </div>
        );
      })}
    </div>
  );
}
