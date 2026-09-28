import type { Metadata } from "next";
import { Suspense } from "react";
import { FlightResults } from "@/components/flights/FlightResults";
import { FlightSearchBar } from "@/components/search/FlightSearchBar";
import { NYC_HERO_IMAGE } from "@/lib/links";
import { flightSearchToQuery, parseFlightSearch } from "@/lib/params";

export const metadata: Metadata = {
  title: "Passagens aéreas para Nova York",
  description: "Compare voos para Nova York (JFK, Newark e LaGuardia) com filtros de paradas, horários, companhias e bagagem.",
};

export default async function FlightsPage({ searchParams }: PageProps<"/voos">) {
  const parsed = parseFlightSearch(await searchParams);
  const params = parsed.params;
  return (
    <>
      <section className="relative overflow-hidden bg-ink-900 pb-6 pt-5">
        <div className="absolute inset-0 bg-cover bg-center opacity-30" style={{ backgroundImage: `url(${NYC_HERO_IMAGE})` }} aria-hidden />
        <div className="relative mx-auto max-w-7xl px-4">
          <FlightSearchBar initial={params} variant="band" />
          {!parsed.ok ? (
            <p className="mt-3 rounded-xl bg-amber-100 px-4 py-2 text-sm text-amber-900">
              {parsed.error[0].toUpperCase() + parsed.error.slice(1)} — mostramos a busca com datas sugeridas.
            </p>
          ) : null}
        </div>
      </section>
      <Suspense>
        <FlightResults key={flightSearchToQuery(params)} params={params} />
      </Suspense>
    </>
  );
}
