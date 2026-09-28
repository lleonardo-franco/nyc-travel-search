import { cache, HOUR } from "./cache";
import type { LatLng } from "./geo";
import type { NearbyPhoto } from "./types";
import {
  loadHotelBuildingPhoto,
  loadNearbyPhotos,
  loadPlacePhotos,
  wikimediaUserAgent,
  type ApiQueryResponse,
  type BuildingPhoto,
} from "./wikimedia";

/**
 * Acesso do servidor ao Wikimedia seguindo a política de uso:
 * User-Agent identificável, token OAuth opcional, no máximo 2 chamadas simultâneas,
 * e respeito ao Retry-After — durante um bloqueio (429) não insistimos: devolvemos
 * `null` e a página busca direto do navegador do visitante (ver useWikimedia).
 */

const USER_AGENT = wikimediaUserAgent(process.env.WIKIMEDIA_CONTACT || undefined);
const TOKEN = process.env.WIKIMEDIA_ACCESS_TOKEN ?? "";

let blockedUntil = 0;
let active = 0;
const queue: (() => void)[] = [];

async function slot<T>(fn: () => Promise<T>): Promise<T> {
  if (active >= 2) await new Promise<void>((resolve) => queue.push(resolve));
  active++;
  try {
    return await fn();
  } finally {
    active--;
    queue.shift()?.();
  }
}

export class WikimediaUnavailable extends Error {}

export function wikimediaBlockedFor(): number {
  return Math.max(0, blockedUntil - Date.now());
}

async function serverFetch(url: string): Promise<ApiQueryResponse> {
  if (Date.now() < blockedUntil) throw new WikimediaUnavailable("limite de requisições do Wikimedia");
  return slot(async () => {
    for (let attempt = 0; ; attempt++) {
      const res = await fetch(url, {
        headers: {
          "user-agent": USER_AGENT,
          accept: "application/json",
          ...(TOKEN ? { authorization: `Bearer ${TOKEN}` } : {}),
        },
        signal: AbortSignal.timeout(8_000),
        cache: "no-store",
      });
      if (res.status === 429 || res.status === 503) {
        const wait = Number(res.headers.get("retry-after")) || 30;
        // Espera curta: tenta de novo uma vez. Espera longa: abre o "disjuntor".
        if (attempt === 0 && wait <= 2) {
          await new Promise((r) => setTimeout(r, wait * 1000));
          continue;
        }
        blockedUntil = Date.now() + wait * 1000;
        throw new WikimediaUnavailable(`HTTP ${res.status}`);
      }
      if (!res.ok) throw new Error(`Wikimedia HTTP ${res.status}`);
      return (await res.json()) as ApiQueryResponse;
    }
  });
}

/** `null` = indisponível agora (bloqueio/erro); `[]` = não há fotos. */
export async function serverNearbyPhotos(point: LatLng, limit = 8): Promise<NearbyPhoto[] | null> {
  const key = `wm:nearby:${point.lat.toFixed(4)},${point.lng.toFixed(4)}:${limit}`;
  return cache.memo(key, 24 * HOUR, () => loadNearbyPhotos(serverFetch, point, limit)).catch(() => null);
}

export async function serverPlacePhotos(titles: string[]): Promise<Record<string, NearbyPhoto> | null> {
  return cache.memo(`wm:places:${titles.join("|")}`, 24 * HOUR, () => loadPlacePhotos(serverFetch, titles)).catch(() => null);
}

/** `undefined` = indisponível agora; `null` = hotel sem artigo na Wikipédia. */
export async function serverHotelBuildingPhoto(point: LatLng, hotelName: string): Promise<BuildingPhoto | null | undefined> {
  const key = `wm:building:${point.lat.toFixed(4)},${point.lng.toFixed(4)}:${hotelName}`;
  return cache.memo(key, 24 * HOUR, () => loadHotelBuildingPhoto(serverFetch, point, hotelName)).catch(() => undefined);
}
