import { ArrowLeft, ExternalLink, MapPin } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { AmenityList } from "@/components/hotels/Amenities";
import { HotelGallery } from "@/components/hotels/HotelGallery";
import { HotelLocationMap } from "@/components/hotels/HotelLocationMap";
import { PriceCalendar } from "@/components/hotels/PriceCalendar";
import { HotelSearchBar } from "@/components/search/HotelSearchBar";
import { RatingBadge, Stars } from "@/components/ui/RatingBadge";
import { NearbyPhotos } from "@/components/wikimedia/NearbyPhotos";
import { formatShortDate, nightsBetween } from "@/lib/dates";
import { formatMoney, guestsSummary } from "@/lib/format";
import { distanceKm, formatKm, LANDMARK_IDS, LANDMARKS, osmLink } from "@/lib/geo";
import { offerUrl } from "@/lib/links";
import { hotelSearchToQuery, parseHotelSearch } from "@/lib/params";
import { hotelCalendar, hotelDetails } from "@/lib/providers/hotels";
import type { Hotel, HotelSearchParams } from "@/lib/types";
import { serverHotelBuildingPhoto, serverNearbyPhotos } from "@/lib/wikimedia-server";

type Props = PageProps<"/hoteis/[source]/[id]">;

async function load(props: Props) {
  const { source, id } = await props.params;
  const stay = parseHotelSearch(await props.searchParams).params;
  const hotelId = `${source}:${decodeURIComponent(id)}`;
  return { hotelId, stay, hotel: await hotelDetails(hotelId, stay) };
}

export async function generateMetadata(props: Props): Promise<Metadata> {
  const { hotel } = await load(props);
  if (!hotel) return { title: "Hotel não encontrado" };
  return {
    title: `${hotel.name} — preços e fotos`,
    description: `Compare as diárias do ${hotel.name}${hotel.neighborhood ? ` em ${hotel.neighborhood}` : ""}, Nova York, em vários sites.`,
    openGraph: hotel.images[0] ? { images: [hotel.images[0].url] } : undefined,
  };
}

const SECTIONS = [
  { id: "visao-geral", label: "Visão geral" },
  { id: "precos", label: "Preços" },
  { id: "calendario", label: "Calendário" },
  { id: "localizacao", label: "Localização" },
  { id: "arredores", label: "Arredores" },
];

async function Gallery({ hotel }: { hotel: Hotel }) {
  const [nearby, building] = hotel.location
    ? await Promise.all([serverNearbyPhotos(hotel.location), serverHotelBuildingPhoto(hotel.location, hotel.name)])
    : [[], null];
  return (
    <HotelGallery
      name={hotel.name}
      images={hotel.images}
      location={hotel.location}
      initialNearby={nearby ?? undefined}
      initialBuilding={building}
    />
  );
}

async function Calendar({ hotelId, stay }: { hotelId: string; stay: HotelSearchParams }) {
  const calendar = await hotelCalendar(hotelId, stay);
  if (!calendar || !(calendar.cheap.length + calendar.average.length + calendar.high.length)) {
    return <p className="text-sm text-slate-500">Calendário de preços indisponível para este hotel.</p>;
  }
  return <PriceCalendar calendar={calendar} stay={stay} />;
}

async function Surroundings({ hotel }: { hotel: Hotel }) {
  const nearby = hotel.location ? await serverNearbyPhotos(hotel.location) : [];
  return <NearbyPhotos point={hotel.location!} initial={nearby ?? undefined} />;
}

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-32 rounded-2xl border border-slate-200 bg-white p-5 md:p-6">
      <h2 className="mb-4 text-xl font-bold text-slate-900">{title}</h2>
      {children}
    </section>
  );
}

export default async function HotelPage(props: Props) {
  const { hotelId, stay, hotel } = await load(props);
  if (!hotel) notFound();

  const nights = nightsBetween(stay.checkin, stay.checkout);
  const best = hotel.offers[0];
  const pathname = `/hoteis/${hotel.source}/${encodeURIComponent(hotel.nativeId)}`;
  const distances = hotel.location
    ? LANDMARK_IDS.map((id) => ({ id, km: distanceKm(hotel.location!, LANDMARKS[id]) })).sort((a, b) => a.km - b.km)
    : [];
  const amenities = [...new Set([...hotel.labels, ...hotel.amenities])];

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-5">
      <Link href={`/hoteis?${hotelSearchToQuery(stay)}`} className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-blue-700 hover:underline">
        <ArrowLeft className="h-4 w-4" aria-hidden /> Ver todos os hotéis em Nova York
      </Link>

      <Suspense
        fallback={
          <HotelGallery name={hotel.name} images={hotel.images} initialNearby={[]} initialBuilding={null} />
        }
      >
        <Gallery hotel={hotel} />
      </Suspense>

      <nav className="sticky top-14 z-30 -mx-4 mt-4 border-b border-slate-200 bg-[#f6f7fb]/95 px-4 backdrop-blur">
        <ul className="scroll-thin flex gap-6 overflow-x-auto text-sm font-medium text-slate-600">
          {SECTIONS.map((s) => (
            <li key={s.id}>
              <a href={`#${s.id}`} className="block whitespace-nowrap border-b-2 border-transparent py-3 hover:border-slate-900 hover:text-slate-900">
                {s.label}
              </a>
            </li>
          ))}
        </ul>
      </nav>

      <div className="mt-5 grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="min-w-0 space-y-5">
          <Section id="visao-geral" title="Visão geral">
            <div className="flex items-center gap-2 text-sm text-slate-500">
              {hotel.type ? <span>{hotel.type}</span> : null}
              <Stars count={hotel.stars} />
            </div>
            <h1 className="mt-1 text-3xl font-bold tracking-tight text-slate-900">{hotel.name}</h1>
            <p className="mt-2 flex items-start gap-1.5 text-sm text-slate-600">
              <MapPin className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
              {[hotel.address, hotel.neighborhood, hotel.borough].filter(Boolean).join(" · ") || "Nova York"}
            </p>
            <div className="mt-4">
              <RatingBadge rating={hotel.rating} reviews={hotel.reviewCount} />
            </div>
            {hotel.description ? <p className="mt-5 text-sm leading-relaxed text-slate-700">{hotel.description.slice(0, 900)}</p> : null}
            {amenities.length ? (
              <div className="mt-6">
                <h3 className="mb-3 font-semibold text-slate-900">Destaques e comodidades</h3>
                <AmenityList items={amenities} />
              </div>
            ) : null}
          </Section>

          <Section id="precos" title={`Compare preços · ${formatShortDate(stay.checkin)} – ${formatShortDate(stay.checkout)}`}>
            {hotel.offers.length ? (
              <>
                <ul className="divide-y divide-slate-100">
                  {hotel.offers.map((o, i) => (
                    <li key={`${o.source}-${o.vendor}-${i}`} className="flex flex-wrap items-center gap-4 py-3">
                      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-slate-100 text-sm font-bold text-slate-700">
                        {o.vendor.slice(0, 2).toUpperCase()}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-slate-900">{o.vendor}</p>
                        <p className="text-xs text-slate-500">
                          {[i === 0 ? "Melhor preço" : null, o.refundable ? "Cancelamento grátis" : null, o.boardType].filter(Boolean).join(" · ") ||
                            `via ${o.source === "xotelo" ? "Xotelo" : o.source}`}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className={`text-lg font-bold tabular-nums ${i === 0 ? "text-emerald-700" : "text-slate-900"}`}>
                          {formatMoney(o.pricePerNight, o.currency)}
                        </p>
                        <p className="text-xs text-slate-500">{formatMoney(o.totalPrice, o.currency)} no total</p>
                      </div>
                      <a
                        href={offerUrl(o, hotel, stay) ?? hotel.url}
                        target="_blank"
                        rel="noopener noreferrer nofollow"
                        className={`inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-semibold ${
                          i === 0 ? "bg-emerald-600 text-white hover:bg-emerald-700" : "border border-slate-300 text-slate-900 hover:border-slate-500"
                        }`}
                      >
                        Ver oferta <ExternalLink className="h-4 w-4" aria-hidden />
                      </a>
                    </li>
                  ))}
                </ul>
                <p className="mt-3 text-xs text-slate-500">
                  Preço por quarto por noite · total para {nights} {nights === 1 ? "noite" : "noites"} e {stay.rooms}{" "}
                  {stay.rooms === 1 ? "quarto" : "quartos"}. Impostos e taxas podem variar no site parceiro.
                </p>
              </>
            ) : (
              <p className="text-sm text-slate-600">
                Nenhum site trouxe preço para estas datas.
                {hotel.priceEstimate
                  ? ` As diárias costumam ficar entre ${formatMoney(hotel.priceEstimate.min, hotel.priceEstimate.currency)} e ${formatMoney(hotel.priceEstimate.max, hotel.priceEstimate.currency)}.`
                  : ""}{" "}
                Veja no calendário abaixo os dias com preços mais baixos.
              </p>
            )}
          </Section>

          <Section id="calendario" title="Calendário de preços por noite">
            <Suspense fallback={<div className="h-72 animate-pulse rounded-xl bg-slate-100" />}>
              <Calendar hotelId={hotelId} stay={stay} />
            </Suspense>
          </Section>

          <Section id="localizacao" title="Localização">
            {hotel.location ? (
              <div className="grid gap-5 md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
                <div className="h-72 overflow-hidden rounded-xl border border-slate-200">
                  <HotelLocationMap hotel={hotel} currency={stay.currency} />
                </div>
                <div>
                  <h3 className="mb-2 font-semibold text-slate-900">O que há por perto</h3>
                  <ul className="space-y-2 text-sm">
                    {distances.map((d) => (
                      <li key={d.id} className="flex justify-between gap-3 text-slate-700">
                        <span>{LANDMARKS[d.id].name}</span>
                        <span className="tabular-nums text-slate-500">{formatKm(d.km)}</span>
                      </li>
                    ))}
                  </ul>
                  <a href={osmLink(hotel.location)} target="_blank" rel="noreferrer" className="mt-3 inline-block text-sm font-medium text-blue-700 hover:underline">
                    Abrir no OpenStreetMap
                  </a>
                </div>
              </div>
            ) : (
              <p className="text-sm text-slate-500">Localização não informada pela fonte.</p>
            )}
          </Section>

          {hotel.location ? (
            <Section id="arredores" title="Como é a vizinhança">
              <p className="-mt-2 mb-4 text-sm text-slate-500">Fotos livres tiradas a até 200 m do hotel (Wikimedia Commons).</p>
              <Suspense fallback={<div className="h-40 animate-pulse rounded-xl bg-slate-100" />}>
                <Surroundings hotel={hotel} />
              </Suspense>
            </Section>
          ) : null}
        </div>

        <aside className="lg:sticky lg:top-28 lg:self-start">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            {best ? (
              <>
                <p className="text-sm text-slate-500">Melhor preço em {best.vendor}</p>
                <p className="mt-1 text-3xl font-bold tabular-nums text-slate-900">{formatMoney(best.pricePerNight, best.currency)}</p>
                <p className="text-sm text-slate-500">
                  por noite · {formatMoney(best.totalPrice, best.currency)} no total
                </p>
                <a
                  href={offerUrl(best, hotel, stay) ?? hotel.url}
                  target="_blank"
                  rel="noopener noreferrer nofollow"
                  className="mt-4 flex items-center justify-center gap-2 rounded-xl bg-emerald-600 py-3 font-semibold text-white hover:bg-emerald-700"
                >
                  Ver oferta <ExternalLink className="h-4 w-4" aria-hidden />
                </a>
                {hotel.offers.length > 1 ? (
                  <a href="#precos" className="mt-2 block text-center text-sm font-medium text-blue-700 hover:underline">
                    Comparar {hotel.offers.length} ofertas
                  </a>
                ) : null}
              </>
            ) : (
              <p className="text-sm text-slate-600">Sem preços para estas datas. Tente outras datas:</p>
            )}
            <div className="mt-5 border-t border-slate-100 pt-4">
              <p className="mb-2 text-sm font-semibold text-slate-900">
                {nights} {nights === 1 ? "noite" : "noites"} · {guestsSummary(stay)}
              </p>
              <HotelSearchBar initial={stay} target={pathname} layout="stack" />
            </div>
          </div>
          {hotel.url ? (
            <a href={hotel.url} target="_blank" rel="noreferrer" className="mt-3 block text-center text-sm text-slate-500 hover:text-slate-900">
              Ver avaliações completas na fonte ↗
            </a>
          ) : null}
        </aside>
      </div>
    </div>
  );
}
