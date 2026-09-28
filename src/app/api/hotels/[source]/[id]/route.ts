import { parseHotelSearch } from "@/lib/params";
import { hotelCalendar, hotelDetails } from "@/lib/providers/hotels";
import { rateLimit } from "@/lib/rate-limit";
import { serverHotelBuildingPhoto, serverNearbyPhotos } from "@/lib/wikimedia-server";

/** GET /api/hotels/xotelo/g60763-d23448880?checkin=…&checkout=… — hotel, ofertas, calendário e fotos. */
export async function GET(request: Request, ctx: RouteContext<"/api/hotels/[source]/[id]">) {
  const limited = rateLimit(request, "hotel-details");
  if (limited) return limited;

  const { source, id } = await ctx.params;
  const parsed = parseHotelSearch(new URL(request.url).searchParams);
  if (!parsed.ok) return Response.json({ error: parsed.error }, { status: 400 });

  const hotelId = `${source}:${decodeURIComponent(id)}`;
  const [hotel, calendar] = await Promise.all([
    hotelDetails(hotelId, parsed.params),
    hotelCalendar(hotelId, parsed.params),
  ]);
  if (!hotel) return Response.json({ error: "hotel não encontrado" }, { status: 404 });

  const [nearbyPhotos, buildingPhoto] = hotel.location
    ? await Promise.all([serverNearbyPhotos(hotel.location), serverHotelBuildingPhoto(hotel.location, hotel.name)])
    : [[], null];
  // nearbyPhotos/buildingPhoto nulos/indefinidos = Wikimedia indisponível no servidor agora.
  return Response.json({ hotel, calendar, nearbyPhotos, buildingPhoto: buildingPhoto ?? null });
}
