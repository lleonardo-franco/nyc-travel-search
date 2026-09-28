"use client";

import { Check, ExternalLink, Heart, MapPin } from "lucide-react";
import Link from "next/link";
import { RatingBadge, Stars } from "@/components/ui/RatingBadge";
import { nightsBetween } from "@/lib/dates";
import { bestOffer, distanceTo } from "@/lib/filters/hotels";
import { formatMoney } from "@/lib/format";
import { formatKm, LANDMARKS, type LandmarkId } from "@/lib/geo";
import { hotelHref, offerUrl } from "@/lib/links";
import type { Hotel, HotelSearchParams } from "@/lib/types";
import { ImageCarousel } from "./ImageCarousel";

const HIGHLIGHT_LABELS = new Set(["Café da manhã incluso", "Cancelamento grátis"]);

export function HotelCard({
  hotel,
  params,
  landmark,
  vendors,
  favorite,
  onToggleFavorite,
  onHover,
  highlighted,
  compact,
}: {
  hotel: Hotel;
  params: HotelSearchParams;
  landmark: LandmarkId;
  vendors: string[];
  favorite: boolean;
  onToggleFavorite: () => void;
  onHover?: (id: string | null) => void;
  highlighted?: boolean;
  compact?: boolean;
}) {
  const nights = nightsBetween(params.checkin, params.checkout);
  const offers = vendors.length ? hotel.offers.filter((o) => vendors.includes(o.vendor)) : hotel.offers;
  const best = bestOffer(hotel, vendors);
  const pending = Boolean(hotel.pendingOfferIds?.length);
  const km = distanceTo(hotel, landmark);
  const href = hotelHref(hotel, params);
  const labels = [...hotel.labels.filter((l) => HIGHLIGHT_LABELS.has(l))];
  const extras = [...hotel.labels.filter((l) => !HIGHLIGHT_LABELS.has(l)), ...hotel.amenities].slice(0, compact ? 2 : 4);

  return (
    <article
      id={`hotel-${hotel.id}`}
      onMouseEnter={() => onHover?.(hotel.id)}
      onMouseLeave={() => onHover?.(null)}
      className={`flex flex-col overflow-hidden rounded-2xl border bg-white shadow-sm transition hover:shadow-md ${
        compact ? "" : "md:flex-row"
      } ${highlighted ? "border-slate-900 ring-1 ring-slate-900" : "border-slate-200"}`}
    >
      <ImageCarousel
        images={hotel.images}
        alt={hotel.name}
        className={compact ? "h-44" : "h-56 shrink-0 md:h-auto md:min-h-60 md:w-72"}
        overlay={
          <button
            type="button"
            onClick={onToggleFavorite}
            aria-pressed={favorite}
            aria-label={favorite ? "Remover dos favoritos" : "Salvar nos favoritos"}
            className="absolute right-3 top-3 grid h-9 w-9 place-items-center rounded-full bg-white/95 shadow transition hover:scale-105"
          >
            <Heart className={`h-5 w-5 ${favorite ? "fill-rose-500 text-rose-500" : "text-slate-700"}`} />
          </button>
        }
      />

      <div className={`flex min-w-0 flex-1 flex-col ${compact ? "" : "md:flex-row"}`}>
        <div className="flex min-w-0 flex-1 flex-col gap-2 p-4">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            {hotel.type ? <span>{hotel.type}</span> : null}
            <Stars count={hotel.stars} />
          </div>
          <h3 className="text-lg font-semibold leading-snug text-slate-900">
            <Link href={href} className="hover:underline">
              {hotel.name}
            </Link>
          </h3>
          <p className="flex items-start gap-1 text-sm text-slate-600">
            <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" aria-hidden />
            <span>
              {hotel.neighborhood ?? "Nova York"}
              {km != null ? (
                <span className="text-slate-500">
                  {" "}
                  · {formatKm(km)} de {LANDMARKS[landmark].name}
                </span>
              ) : null}
            </span>
          </p>

          {labels.length ? (
            <ul className="flex flex-wrap gap-x-3 gap-y-1">
              {labels.map((l) => (
                <li key={l} className="flex items-center gap-1 text-sm font-medium text-emerald-700">
                  <Check className="h-4 w-4" aria-hidden />
                  {l}
                </li>
              ))}
            </ul>
          ) : null}
          {extras.length ? (
            <ul className="flex flex-wrap gap-1.5">
              {extras.map((a) => (
                <li key={a} className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                  {a}
                </li>
              ))}
            </ul>
          ) : null}

          <div className="mt-auto pt-2">
            <RatingBadge rating={hotel.rating} reviews={hotel.reviewCount} />
          </div>
        </div>

        {/* Coluna de preço: melhor oferta + outros sites (comparador) */}
        <div
          className={`flex flex-col gap-2 border-slate-100 p-4 ${
            compact ? "border-t" : "border-t md:w-64 md:shrink-0 md:border-l md:border-t-0"
          }`}
        >
          {best ? (
            <>
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium text-slate-700">{best.vendor}</span>
                {offers.length > 1 ? <span className="rounded bg-emerald-50 px-1.5 py-0.5 font-semibold text-emerald-700">Melhor preço</span> : null}
              </div>
              <div>
                <p className="text-2xl font-bold tabular-nums text-slate-900">{formatMoney(best.pricePerNight, best.currency)}</p>
                <p className="text-xs text-slate-500">
                  por noite{params.rooms > 1 ? " por quarto" : ""} · {formatMoney(best.totalPrice, best.currency)} no total ({nights}{" "}
                  {nights === 1 ? "noite" : "noites"})
                </p>
              </div>
              <a
                href={offerUrl(best, hotel, params) ?? href}
                target="_blank"
                rel="noopener noreferrer nofollow"
                className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-700"
              >
                Ver oferta <ExternalLink className="h-4 w-4" aria-hidden />
              </a>
              {offers.length > 1 ? (
                <ul className="mt-1 space-y-1 border-t border-slate-100 pt-2 text-sm">
                  {offers.slice(1, 3).map((o) => (
                    <li key={`${o.source}-${o.vendor}`}>
                      <a
                        href={offerUrl(o, hotel, params) ?? href}
                        target="_blank"
                        rel="noopener noreferrer nofollow"
                        className="flex justify-between gap-2 text-slate-600 hover:text-slate-900"
                      >
                        <span className="truncate">{o.vendor}</span>
                        <span className="font-medium tabular-nums">{formatMoney(o.pricePerNight, o.currency)}</span>
                      </a>
                    </li>
                  ))}
                </ul>
              ) : null}
              <Link href={href} className="text-sm font-medium text-blue-700 hover:underline">
                {offers.length > 3 ? `Comparar ${offers.length} preços` : "Ver detalhes"}
              </Link>
            </>
          ) : pending ? (
            <div className="space-y-2" aria-live="polite">
              <p className="text-xs font-medium text-slate-500">Comparando preços nos sites…</p>
              <div className="h-7 w-32 animate-pulse rounded bg-slate-200" />
              <div className="h-3 w-40 animate-pulse rounded bg-slate-100" />
              <div className="h-10 w-full animate-pulse rounded-xl bg-slate-100" />
            </div>
          ) : (
            <div className="space-y-2 text-sm">
              <p className="font-medium text-slate-700">Sem preços para estas datas</p>
              {hotel.priceEstimate ? (
                <p className="text-xs text-slate-500">
                  Diárias costumam ficar entre {formatMoney(hotel.priceEstimate.min, hotel.priceEstimate.currency)} e{" "}
                  {formatMoney(hotel.priceEstimate.max, hotel.priceEstimate.currency)}.
                </p>
              ) : null}
              <Link href={href} className="inline-block font-medium text-blue-700 hover:underline">
                Ver hotel e calendário de preços
              </Link>
            </div>
          )}
        </div>
      </div>
    </article>
  );
}

export function HotelCardSkeleton() {
  return (
    <div className="flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white md:flex-row">
      <div className="h-56 animate-pulse bg-slate-200 md:h-60 md:w-72" />
      <div className="flex-1 space-y-3 p-4">
        <div className="h-3 w-20 animate-pulse rounded bg-slate-200" />
        <div className="h-5 w-2/3 animate-pulse rounded bg-slate-200" />
        <div className="h-4 w-1/2 animate-pulse rounded bg-slate-100" />
        <div className="h-9 w-32 animate-pulse rounded bg-slate-100" />
      </div>
      <div className="space-y-3 border-t border-slate-100 p-4 md:w-64 md:border-l md:border-t-0">
        <div className="h-7 w-28 animate-pulse rounded bg-slate-200" />
        <div className="h-10 w-full animate-pulse rounded-xl bg-slate-100" />
      </div>
    </div>
  );
}
