import { parseFlightSearch } from "@/lib/params";
import { searchFlights } from "@/lib/providers/flights";
import { rateLimit } from "@/lib/rate-limit";

/** GET /api/flights?origem=GRU&destino=NYC&ida=2026-11-10&volta=2026-11-20&adultos=1&classe=M&moeda=BRL */
export async function GET(request: Request) {
  const limited = rateLimit(request, "flights");
  if (limited) return limited;

  const parsed = parseFlightSearch(new URL(request.url).searchParams);
  if (!parsed.ok) return Response.json({ error: parsed.error }, { status: 400 });

  const data = await searchFlights(parsed.params);
  return Response.json(data, {
    headers: { "cache-control": "public, max-age=0, s-maxage=300, stale-while-revalidate=600" },
  });
}
