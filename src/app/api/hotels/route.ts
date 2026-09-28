import { parseHotelSearch } from "@/lib/params";
import { searchHotels } from "@/lib/providers/hotels";
import { rateLimit } from "@/lib/rate-limit";

/** GET /api/hotels?checkin=2026-11-10&checkout=2026-11-15&adultos=2&quartos=1&moeda=BRL&pagina=1 */
export async function GET(request: Request) {
  const limited = rateLimit(request, "hotels");
  if (limited) return limited;

  const parsed = parseHotelSearch(new URL(request.url).searchParams);
  if (!parsed.ok) return Response.json({ error: parsed.error }, { status: 400 });

  const data = await searchHotels(parsed.params);
  return Response.json(data, {
    headers: { "cache-control": "public, max-age=0, s-maxage=300, stale-while-revalidate=600" },
  });
}
