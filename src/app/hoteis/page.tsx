import type { Metadata } from "next";
import { Suspense } from "react";
import { HotelResults } from "@/components/hotels/HotelResults";
import { HotelSearchBar } from "@/components/search/HotelSearchBar";
import { parseHotelSearch, hotelSearchToQuery } from "@/lib/params";

export const metadata: Metadata = {
  title: "Hotéis em Nova York",
  description: "Compare diárias de hotéis em Nova York em vários sites, com filtros de preço, nota, bairro e distância.",
};

export default async function HotelsPage({ searchParams }: PageProps<"/hoteis">) {
  const parsed = parseHotelSearch(await searchParams);
  const params = parsed.params;
  return (
    <>
      <section className="bg-ink-900 pb-6 pt-5">
        <div className="mx-auto max-w-7xl px-4">
          <HotelSearchBar initial={params} variant="band" />
          {!parsed.ok ? (
            <p className="mt-3 rounded-xl bg-amber-100 px-4 py-2 text-sm text-amber-900">
              {parsed.error[0].toUpperCase() + parsed.error.slice(1)} — mostramos a busca com datas sugeridas.
            </p>
          ) : null}
        </div>
      </section>
      <Suspense>
        <HotelResults key={hotelSearchToQuery(params)} params={params} />
      </Suspense>
    </>
  );
}
