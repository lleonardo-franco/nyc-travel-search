import { ArrowRight, BadgePercent, Bot, CalendarRange, MapPinned, Plane } from "lucide-react";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { PlaceCards } from "@/components/home/PlaceCards";
import { SearchTabs } from "@/components/home/SearchTabs";
import { RatingBadge } from "@/components/ui/RatingBadge";
import { formatMoney } from "@/lib/format";
import { hotelHref, NYC_HERO_IMAGE } from "@/lib/links";
import { flightDefaults, hotelDefaults } from "@/lib/params";
import { PLACE_TITLES } from "@/lib/places";
import { searchHotels } from "@/lib/providers/hotels";
import { serverPlacePhotos } from "@/lib/wikimedia-server";

async function Places() {
  const photos = await serverPlacePhotos(PLACE_TITLES);
  return <PlaceCards initial={photos ?? undefined} />;
}

async function FeaturedHotels() {
  const stay = hotelDefaults();
  const res = await searchHotels(stay).catch(() => null);
  const hotels = (res?.results ?? [])
    .filter((h) => h.images.length && h.rating)
    .sort((a, b) => (b.rating ?? 0) * Math.log10(10 + (b.reviewCount ?? 0)) - (a.rating ?? 0) * Math.log10(10 + (a.reviewCount ?? 0)))
    .slice(0, 8);
  if (!hotels.length) return null;
  return (
    <div className="scroll-thin -mx-4 flex snap-x gap-4 overflow-x-auto px-4 pb-2">
      {hotels.map((h) => (
        <Link key={h.id} href={hotelHref(h, stay)} className="group w-64 shrink-0 snap-start overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:shadow-md">
          <div className="h-40 overflow-hidden bg-slate-200">
            {/* eslint-disable-next-line @next/next/no-img-element -- CDNs das fontes */}
            <img src={h.images[0].thumbnail ?? h.images[0].url} alt={h.name} loading="lazy" referrerPolicy="no-referrer" className="h-full w-full object-cover transition duration-500 group-hover:scale-105" />
          </div>
          <div className="space-y-2 p-3">
            <p className="line-clamp-2 font-semibold leading-snug text-slate-900">{h.name}</p>
            <p className="text-xs text-slate-500">{h.neighborhood ?? "Nova York"}</p>
            <RatingBadge rating={h.rating} reviews={h.reviewCount} size="sm" />
            {h.priceEstimate ? (
              <p className="text-sm text-slate-600">
                a partir de <span className="font-bold text-slate-900">{formatMoney(h.priceEstimate.min, h.priceEstimate.currency)}</span>/noite
              </p>
            ) : null}
          </div>
        </Link>
      ))}
    </div>
  );
}

const FEATURES = [
  { icon: BadgePercent, title: "Vários sites de uma vez", text: "Booking.com, Expedia, Agoda, Trip.com e o site do hotel lado a lado para você ver o menor preço." },
  { icon: CalendarRange, title: "Calendário de preços", text: "Veja quais noites estão mais baratas e ajuste as datas com um toque." },
  { icon: MapPinned, title: "Mapa e bairros", text: "Filtre por bairro e pela distância até Times Square, Central Park e outros pontos." },
  { icon: Plane, title: "Voos via MCP", text: "As passagens vêm do servidor MCP oficial da Kiwi.com, com links diretos para reservar." },
];

export default async function Home() {
  // Datas padrão são relativas a hoje e os preços mudam: renderiza a cada visita.
  await connection();
  return (
    <>
      <section className="relative isolate overflow-hidden bg-ink-900">
        <div className="absolute inset-0 -z-10 bg-cover bg-center" style={{ backgroundImage: `url(${NYC_HERO_IMAGE})` }} aria-hidden />
        <div className="absolute inset-0 -z-10 bg-gradient-to-b from-ink-900/70 via-ink-900/40 to-ink-900/80" aria-hidden />
        <div className="mx-auto max-w-7xl px-4 pb-24 pt-16 md:pt-24">
          <p className="text-sm font-semibold uppercase tracking-widest text-taxi-400">Nova York</p>
          <h1 className="mt-2 max-w-2xl text-4xl font-black tracking-tight text-white md:text-6xl">Sua viagem para NY começa aqui</h1>
          <p className="mt-4 max-w-xl text-lg text-white/85">Compare hotéis e passagens em vários sites ao mesmo tempo, com filtros de verdade.</p>
          <div className="mt-8">
            <SearchTabs hotel={hotelDefaults()} flight={flightDefaults()} />
          </div>
        </div>
      </section>

      <div className="mx-auto w-full max-w-7xl space-y-16 px-4 py-12">
        <section>
          <div className="mb-5 flex items-end justify-between gap-4">
            <div>
              <h2 className="text-2xl font-bold text-slate-900">Explore Nova York por região</h2>
              <p className="text-slate-600">Escolha onde ficar e veja só os hotéis daquela área.</p>
            </div>
          </div>
          <Suspense fallback={<PlaceCards initial={{}} />}>
            <Places />
          </Suspense>
        </section>

        <section>
          <div className="mb-5 flex items-end justify-between gap-4">
            <div>
              <h2 className="text-2xl font-bold text-slate-900">Hotéis mais bem avaliados</h2>
              <p className="text-slate-600">Notas de milhares de hóspedes e preços de referência.</p>
            </div>
            <Link href="/hoteis?ordem=rating" className="hidden items-center gap-1 text-sm font-semibold text-blue-700 hover:underline sm:flex">
              Ver todos <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
          </div>
          <Suspense fallback={<div className="h-72 animate-pulse rounded-2xl bg-slate-200" />}>
            <FeaturedHotels />
          </Suspense>
        </section>

        <section className="grid gap-4 md:grid-cols-4">
          {FEATURES.map(({ icon: Icon, title, text }) => (
            <div key={title} className="rounded-2xl border border-slate-200 bg-white p-5">
              <Icon className="h-6 w-6 text-blue-600" aria-hidden />
              <h3 className="mt-3 font-semibold text-slate-900">{title}</h3>
              <p className="mt-1 text-sm text-slate-600">{text}</p>
            </div>
          ))}
        </section>

        <section className="overflow-hidden rounded-3xl bg-ink-900 text-white">
          <div className="grid gap-8 p-8 md:grid-cols-2 md:p-10">
            <div>
              <span className="inline-flex items-center gap-2 rounded-full bg-violet-500/20 px-3 py-1 text-xs font-semibold text-violet-200">
                <Bot className="h-4 w-4" aria-hidden /> Model Context Protocol
              </span>
              <h2 className="mt-4 text-3xl font-bold">Pesquise com o seu assistente de IA</h2>
              <p className="mt-3 text-white/75">
                O Rumo a NY também é um servidor MCP: conecte ao Claude, ChatGPT ou Cursor e peça &quot;hotéis perto do Central Park até R$ 1.500 a
                noite em novembro&quot; — ele usa as mesmas fontes e filtros deste site.
              </p>
              <Link href="/mcp" className="mt-6 inline-flex items-center gap-2 rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-slate-900 hover:bg-slate-100">
                Como conectar <ArrowRight className="h-4 w-4" aria-hidden />
              </Link>
            </div>
            <pre className="overflow-x-auto rounded-2xl bg-black/40 p-5 font-mono text-sm leading-relaxed text-emerald-200">
              <code>{`claude mcp add --transport http \\
  rumo-a-ny https://SEU-DOMINIO/api/mcp

> Quais hotéis perto do Central Park
  custam até R$ 1.500 por noite
  de 10 a 15 de novembro?`}</code>
            </pre>
          </div>
        </section>
      </div>
    </>
  );
}
