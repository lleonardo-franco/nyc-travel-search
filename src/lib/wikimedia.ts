import type { LatLng } from "./geo";
import type { NearbyPhoto } from "./types";

/**
 * Wikimedia Commons / Wikipédia — funções isomórficas (servidor e navegador):
 * montam as URLs da Action API e interpretam as respostas.
 *
 * Política de uso: https://www.mediawiki.org/wiki/Wikimedia_APIs/Rate_limits
 * - Requisições sem identificação: ~10/min por IP (e IPs de nuvem compartilhados esgotam rápido).
 * - Com User-Agent identificável (nome/versão + URL ou e-mail): 200/min.
 * - Com token OAuth (WIKIMEDIA_ACCESS_TOKEN): limites de usuário autenticado.
 * - No navegador, cada visitante usa a própria cota (200/min).
 */

export const WIKIMEDIA_APP = "NycTravelSearch/0.1";
export const WIKIMEDIA_DEFAULT_CONTACT = "https://github.com/lleonardo-franco/nyc-travel-search";

export function wikimediaUserAgent(contact = WIKIMEDIA_DEFAULT_CONTACT): string {
  return `${WIKIMEDIA_APP} (${contact}) node-fetch`;
}

const COMMONS_API = "https://commons.wikimedia.org/w/api.php";
const ENWIKI_API = "https://en.wikipedia.org/w/api.php";

type ExtMeta = Record<string, { value?: string } | undefined>;

interface ImageInfo {
  url: string;
  thumburl?: string;
  descriptionurl: string;
  width?: number;
  height?: number;
  extmetadata?: ExtMeta;
}

export interface ApiQueryResponse {
  query?: {
    pages?: Record<
      string,
      {
        pageid?: number;
        index?: number;
        title: string;
        missing?: string;
        imageinfo?: ImageInfo[];
        pageimage?: string;
        thumbnail?: { source: string; width: number; height: number };
        coordinates?: { lat: number; lon: number }[];
      }
    >;
    redirects?: { from: string; to: string }[];
    normalized?: { from: string; to: string }[];
  };
}

function apiUrl(base: string, params: Record<string, string>): string {
  // origin=* libera CORS anônimo, permitindo a mesma URL no navegador.
  return `${base}?${new URLSearchParams({ action: "query", format: "json", formatversion: "1", origin: "*", ...params })}`;
}

const stripHtml = (s?: string) =>
  s
    ?.replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim() || undefined;

const PHOTO_EXT = /\.(jpe?g|png|webp)$/i;

/** O Wikimedia acrescenta "?utm_source=…" às URLs: a extensão é checada só no caminho. */
function urlPath(url: string): string {
  try {
    return new URL(url).pathname;
  } catch {
    return url.split("?")[0];
  }
}

function toPhoto(title: string, info: ImageInfo): NearbyPhoto | null {
  if (!info.thumburl || !PHOTO_EXT.test(urlPath(info.url))) return null;
  if (info.width && info.width < 500) return null; // descarta miniaturas/ícones
  const meta = info.extmetadata ?? {};
  return {
    url: info.url,
    thumbnail: info.thumburl,
    title: stripHtml(meta.ObjectName?.value) ?? title.replace(/^File:/, "").replace(/\.\w+$/, "").replace(/_/g, " "),
    author: stripHtml(meta.Artist?.value)?.slice(0, 80),
    license: stripHtml(meta.LicenseShortName?.value),
    pageUrl: info.descriptionurl,
  };
}

const IMAGEINFO = {
  prop: "imageinfo",
  iiprop: "url|size|extmetadata",
  iiurlwidth: "960",
  iiextmetadatafilter: "Artist|LicenseShortName|ObjectName",
};

// ---------------------------------------------------------------------------
// Fotos livres tiradas perto de um ponto (Commons geosearch)
// ---------------------------------------------------------------------------

export function nearbyPhotosUrl(point: LatLng, limit = 8, radiusM = 200): string {
  return apiUrl(COMMONS_API, {
    generator: "geosearch",
    ggscoord: `${point.lat.toFixed(5)}|${point.lng.toFixed(5)}`,
    ggsradius: String(radiusM),
    ggsnamespace: "6",
    ggslimit: String(Math.min(limit * 3, 50)),
    ...IMAGEINFO,
  });
}

export function parseNearbyPhotos(res: ApiQueryResponse, limit = 8): NearbyPhoto[] {
  return Object.values(res.query?.pages ?? {})
    .sort((a, b) => (a.index ?? 0) - (b.index ?? 0)) // geosearch devolve por distância
    .flatMap((page) => {
      const info = page.imageinfo?.[0];
      const photo = info && toPhoto(page.title, info);
      return photo ? [photo] : [];
    })
    .slice(0, limit);
}

// ---------------------------------------------------------------------------
// Foto principal de artigos da Wikipédia (bairros, pontos turísticos, hotéis famosos)
// ---------------------------------------------------------------------------

export function pageImagesUrl(titles: string[]): string {
  return apiUrl(ENWIKI_API, {
    titles: titles.join("|"),
    redirects: "1",
    prop: "pageimages",
    piprop: "name",
  });
}

/** Mapeia título pedido → nome do arquivo da imagem principal do artigo. */
export function parsePageImages(res: ApiQueryResponse, titles: string[]): Record<string, string> {
  const alias = new Map<string, string>();
  for (const { from, to } of [...(res.query?.normalized ?? []), ...(res.query?.redirects ?? [])]) alias.set(from, to);
  const resolve = (t: string) => {
    let cur = t;
    for (let i = 0; i < 3 && alias.has(cur); i++) cur = alias.get(cur)!;
    return cur;
  };
  const byTitle = new Map(Object.values(res.query?.pages ?? {}).map((p) => [p.title, p.pageimage]));
  const out: Record<string, string> = {};
  for (const t of titles) {
    const file = byTitle.get(resolve(t));
    if (file) out[t] = file;
  }
  return out;
}

export function fileInfoUrl(files: string[]): string {
  return apiUrl(COMMONS_API, {
    titles: files.map((f) => (f.startsWith("File:") ? f : `File:${f}`)).join("|"),
    ...IMAGEINFO,
  });
}

/** Mapeia nome do arquivo (sem "File:", com "_") → foto com autor e licença. */
export function parseFileInfo(res: ApiQueryResponse): Record<string, NearbyPhoto> {
  const out: Record<string, NearbyPhoto> = {};
  for (const page of Object.values(res.query?.pages ?? {})) {
    const info = page.imageinfo?.[0];
    const photo = info && toPhoto(page.title, info);
    if (photo) out[page.title.replace(/^File:/, "").replace(/ /g, "_")] = photo;
  }
  return out;
}

// ---------------------------------------------------------------------------
// Artigo da Wikipédia sobre o próprio hotel (pelo local + nome)
// ---------------------------------------------------------------------------

export function nearbyArticlesUrl(point: LatLng, radiusM = 150): string {
  return apiUrl(ENWIKI_API, {
    generator: "geosearch",
    ggscoord: `${point.lat.toFixed(5)}|${point.lng.toFixed(5)}`,
    ggsradius: String(radiusM),
    ggslimit: "20",
    prop: "pageimages",
    piprop: "name",
  });
}

const STOP = new Set(["the", "hotel", "new", "york", "nyc", "by", "a", "an", "and", "&", "at", "of", "in", "on", "city", "manhattan"]);

function tokens(s: string): Set<string> {
  return new Set(
    s
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "")
      .toLowerCase()
      .replace(/\(.*?\)/g, " ")
      .replace(/[^a-z0-9 ]+/g, " ")
      .split(/\s+/)
      .filter((t) => t.length > 1 && !STOP.has(t)),
  );
}

const LODGING = /\b(hotel|inn|suites|lodge|hostel|resort|motel)\b/i;

/**
 * Escolhe, entre os artigos próximos (≤150 m), o que fala do hotel. Todas as palavras
 * relevantes do título do artigo precisam estar no nome do hotel e, além disso, o artigo
 * deve ser de hospedagem ("The Plaza Hotel"), dividir 2+ palavras com o nome, ou ser a
 * primeira palavra do nome ("The Pierre" ↔ "The Pierre, A Taj Hotel").
 * Devolve o arquivo da imagem principal do artigo.
 */
export function pickHotelArticleImage(res: ApiQueryResponse, hotelName: string): { title: string; file: string } | null {
  const hotel = tokens(hotelName);
  const firstWord = [...hotel][0];
  let best: { title: string; file: string; score: number } | null = null;
  for (const page of Object.values(res.query?.pages ?? {})) {
    if (!page.pageimage) continue;
    const art = [...tokens(page.title)];
    if (!art.length || !art.every((t) => hotel.has(t))) continue;
    const lodging = LODGING.test(page.title);
    if (!lodging && art.length < 2 && art[0] !== firstWord) continue;
    const score = art.length * 2 + Number(lodging);
    if (!best || score > best.score) best = { title: page.title, file: page.pageimage, score };
  }
  return best ? { title: best.title, file: best.file } : null;
}

// ---------------------------------------------------------------------------
// Composição — recebe o "fetcher" (servidor ou navegador) e junta as chamadas
// ---------------------------------------------------------------------------

export type WikiFetch = (url: string) => Promise<ApiQueryResponse>;

export async function loadNearbyPhotos(fetcher: WikiFetch, point: LatLng, limit = 8): Promise<NearbyPhoto[]> {
  return parseNearbyPhotos(await fetcher(nearbyPhotosUrl(point, limit)), limit);
}

/** Foto principal (com autor/licença) de cada artigo da Wikipédia pedido. */
export async function loadPlacePhotos(fetcher: WikiFetch, titles: string[]): Promise<Record<string, NearbyPhoto>> {
  const files = parsePageImages(await fetcher(pageImagesUrl(titles)), titles);
  const names = [...new Set(Object.values(files))];
  if (!names.length) return {};
  const infos = parseFileInfo(await fetcher(fileInfoUrl(names)));
  const out: Record<string, NearbyPhoto> = {};
  for (const [title, file] of Object.entries(files)) {
    const photo = infos[file.replace(/ /g, "_")];
    if (photo) out[title] = photo;
  }
  return out;
}

export interface BuildingPhoto {
  photo: NearbyPhoto;
  article: string;
  articleUrl: string;
}

/** Foto do prédio do hotel, se ele tiver artigo na Wikipédia (hotéis históricos/famosos). */
export async function loadHotelBuildingPhoto(fetcher: WikiFetch, point: LatLng, hotelName: string): Promise<BuildingPhoto | null> {
  const match = pickHotelArticleImage(await fetcher(nearbyArticlesUrl(point)), hotelName);
  if (!match) return null;
  const photo = parseFileInfo(await fetcher(fileInfoUrl([match.file])))[match.file.replace(/ /g, "_")];
  if (!photo) return null;
  return {
    photo,
    article: match.title,
    articleUrl: `https://en.wikipedia.org/wiki/${encodeURIComponent(match.title.replace(/ /g, "_"))}`,
  };
}
