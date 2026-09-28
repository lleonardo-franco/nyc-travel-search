import { parseHotelSearch } from "@/lib/params";
import { hotelOffers } from "@/lib/providers/hotels";
import { rateLimit } from "@/lib/rate-limit";

const MAX_IDS = 12;

/** GET /api/hotels/offers?ids=xotelo:g60763-d123,liteapi:lp456&checkin=…&checkout=… */
export async function GET(request: Request) {
  // Cada página de resultados dispara vários lotes; o limite aqui é mais folgado.
  const limited = rateLimit(request, "offers", 240);
  if (limited) return limited;

  const url = new URL(request.url);
  const parsed = parseHotelSearch(url.searchParams);
  if (!parsed.ok) return Response.json({ error: parsed.error }, { status: 400 });

  const ids = [...new Set((url.searchParams.get("ids") ?? "").split(",").filter(Boolean))];
  if (!ids.length || ids.length > MAX_IDS) {
    return Response.json({ error: `informe de 1 a ${MAX_IDS} ids` }, { status: 400 });
  }

  const offers = await hotelOffers(ids, parsed.params);
  return Response.json(
    { offers, currency: parsed.params.currency },
    { headers: { "cache-control": "public, max-age=0, s-maxage=600" } },
  );
}
