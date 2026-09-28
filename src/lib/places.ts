import { hotelDefaults, hotelSearchToQuery } from "./params";

/** Regiões destacadas na home. `title` é o artigo da Wikipédia (em inglês) de onde vem a foto. */
export const PLACES = [
  { title: "Times Square", name: "Times Square", blurb: "Luzes, teatros da Broadway e metrô para a cidade toda.", filter: { bairros: "Times Square / Theater District" } },
  { title: "Central Park", name: "Central Park", blurb: "Hotéis a até 1 km do parque mais famoso do mundo.", filter: { ref: "central-park", dist: "1" } },
  { title: "SoHo, Manhattan", name: "SoHo", blurb: "Prédios de ferro fundido, lojas e galerias.", filter: { bairros: "SoHo" } },
  { title: "Chelsea, Manhattan", name: "Chelsea", blurb: "High Line, galerias e o Chelsea Market.", filter: { bairros: "Chelsea" } },
  { title: "Financial District, Manhattan", name: "Financial District", blurb: "Wall Street, One World Trade e a balsa para a Estátua.", filter: { bairros: "Financial District" } },
  { title: "Williamsburg, Brooklyn", name: "Williamsburg", blurb: "O Brooklyn descolado, com vista para Manhattan.", filter: { bairros: "Williamsburg" } },
  { title: "Upper West Side", name: "Upper West Side", blurb: "Residencial e tranquilo, entre o Central Park e o Hudson.", filter: { bairros: "Upper West Side" } },
  { title: "Long Island City", name: "Long Island City", blurb: "Diárias menores, a uma estação de metrô de Midtown.", filter: { bairros: "Long Island City" } },
] as const;

export const PLACE_TITLES = PLACES.map((p) => p.title);

export function placeHref(filter: Record<string, string>): string {
  return `/hoteis?${hotelSearchToQuery(hotelDefaults(), filter)}`;
}
