export interface LatLng {
  lat: number;
  lng: number;
}

export function distanceKm(a: LatLng, b: LatLng): number {
  const R = 6371;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export const LANDMARKS = {
  "times-square": { name: "Times Square", lat: 40.758, lng: -73.9855 },
  "central-park": { name: "Central Park", lat: 40.7736, lng: -73.9712 },
  "empire-state": { name: "Empire State Building", lat: 40.7484, lng: -73.9857 },
  "grand-central": { name: "Grand Central", lat: 40.7527, lng: -73.9772 },
  "rockefeller": { name: "Rockefeller Center", lat: 40.7587, lng: -73.9787 },
  "brooklyn-bridge": { name: "Ponte do Brooklyn", lat: 40.7061, lng: -73.9969 },
  "liberty-ferry": { name: "Balsa p/ Estátua da Liberdade", lat: 40.7033, lng: -74.017 },
  "jfk": { name: "Aeroporto JFK", lat: 40.6413, lng: -73.7781 },
} as const satisfies Record<string, LatLng & { name: string }>;

export type LandmarkId = keyof typeof LANDMARKS;
export const LANDMARK_IDS = Object.keys(LANDMARKS) as LandmarkId[];

interface Neighborhood extends LatLng {
  name: string;
  borough: string;
}

// Centroides aproximados. O bairro de um hotel é o centroide mais próximo —
// precisão suficiente para filtrar, e sem depender de uma API de geocodificação.
const NEIGHBORHOODS: Neighborhood[] = [
  { name: "Financial District", borough: "Manhattan", lat: 40.7075, lng: -74.0113 },
  { name: "Tribeca", borough: "Manhattan", lat: 40.7163, lng: -74.0086 },
  { name: "SoHo", borough: "Manhattan", lat: 40.7233, lng: -74.003 },
  { name: "Chinatown / Little Italy", borough: "Manhattan", lat: 40.7178, lng: -73.9973 },
  { name: "Lower East Side", borough: "Manhattan", lat: 40.715, lng: -73.9843 },
  { name: "Greenwich Village", borough: "Manhattan", lat: 40.7336, lng: -74.0027 },
  { name: "East Village", borough: "Manhattan", lat: 40.7265, lng: -73.9815 },
  { name: "Chelsea", borough: "Manhattan", lat: 40.7465, lng: -74.0014 },
  { name: "Flatiron / Gramercy", borough: "Manhattan", lat: 40.739, lng: -73.986 },
  { name: "Koreatown / NoMad", borough: "Manhattan", lat: 40.7477, lng: -73.9869 },
  { name: "Murray Hill", borough: "Manhattan", lat: 40.7479, lng: -73.9757 },
  { name: "Hudson Yards / Garment District", borough: "Manhattan", lat: 40.7545, lng: -73.996 },
  { name: "Times Square / Theater District", borough: "Manhattan", lat: 40.758, lng: -73.9855 },
  { name: "Midtown East", borough: "Manhattan", lat: 40.754, lng: -73.973 },
  { name: "Hell's Kitchen", borough: "Manhattan", lat: 40.7638, lng: -73.9918 },
  { name: "Central Park South", borough: "Manhattan", lat: 40.766, lng: -73.979 },
  { name: "Upper West Side", borough: "Manhattan", lat: 40.787, lng: -73.9754 },
  { name: "Upper East Side", borough: "Manhattan", lat: 40.7736, lng: -73.9566 },
  { name: "Harlem", borough: "Manhattan", lat: 40.8116, lng: -73.9465 },
  { name: "Washington Heights", borough: "Manhattan", lat: 40.8417, lng: -73.9394 },
  { name: "Downtown Brooklyn", borough: "Brooklyn", lat: 40.693, lng: -73.987 },
  { name: "Williamsburg", borough: "Brooklyn", lat: 40.7081, lng: -73.9571 },
  { name: "Park Slope / Gowanus", borough: "Brooklyn", lat: 40.671, lng: -73.9814 },
  { name: "Bushwick", borough: "Brooklyn", lat: 40.6944, lng: -73.9213 },
  { name: "Coney Island", borough: "Brooklyn", lat: 40.5755, lng: -73.9707 },
  { name: "Long Island City", borough: "Queens", lat: 40.7447, lng: -73.9485 },
  { name: "Astoria", borough: "Queens", lat: 40.7644, lng: -73.9235 },
  { name: "Flushing", borough: "Queens", lat: 40.7675, lng: -73.833 },
  { name: "LaGuardia / East Elmhurst", borough: "Queens", lat: 40.764, lng: -73.87 },
  { name: "Jamaica / JFK", borough: "Queens", lat: 40.67, lng: -73.79 },
  { name: "Bronx", borough: "Bronx", lat: 40.8448, lng: -73.8648 },
  { name: "Staten Island", borough: "Staten Island", lat: 40.5795, lng: -74.1502 },
  { name: "Jersey City / Hoboken", borough: "New Jersey", lat: 40.7282, lng: -74.0431 },
  { name: "Newark", borough: "New Jersey", lat: 40.7357, lng: -74.1724 },
];

export function neighborhoodOf(point: LatLng): { neighborhood: string; borough: string } | undefined {
  let best: Neighborhood | undefined;
  let bestKm = Infinity;
  for (const n of NEIGHBORHOODS) {
    const km = distanceKm(point, n);
    if (km < bestKm) {
      best = n;
      bestKm = km;
    }
  }
  if (!best || bestKm > 6) return undefined;
  return { neighborhood: best.name, borough: best.borough };
}

export function formatKm(km: number): string {
  if (km < 1) return `${Math.round(km * 1000)} m`;
  return `${km.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} km`;
}

/** Link do OpenStreetMap embutível com marcador no hotel. */
export function osmEmbedUrl({ lat, lng }: LatLng, delta = 0.006): string {
  const bbox = [lng - delta, lat - delta * 0.75, lng + delta, lat + delta * 0.75].map((n) => n.toFixed(5)).join(",");
  return `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${lat},${lng}`;
}

export function osmLink({ lat, lng }: LatLng): string {
  return `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=17/${lat}/${lng}`;
}
