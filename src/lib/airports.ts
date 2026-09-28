export interface Airport {
  code: string;
  city: string;
  name: string;
  country: string;
}

/** Origens mais comuns para Nova York a partir do Brasil (o campo aceita qualquer IATA/cidade). */
export const ORIGIN_AIRPORTS: Airport[] = [
  { code: "GRU", city: "São Paulo", name: "Guarulhos", country: "Brasil" },
  { code: "VCP", city: "Campinas", name: "Viracopos", country: "Brasil" },
  { code: "GIG", city: "Rio de Janeiro", name: "Galeão", country: "Brasil" },
  { code: "BSB", city: "Brasília", name: "Presidente Juscelino Kubitschek", country: "Brasil" },
  { code: "CNF", city: "Belo Horizonte", name: "Confins", country: "Brasil" },
  { code: "POA", city: "Porto Alegre", name: "Salgado Filho", country: "Brasil" },
  { code: "CWB", city: "Curitiba", name: "Afonso Pena", country: "Brasil" },
  { code: "FLN", city: "Florianópolis", name: "Hercílio Luz", country: "Brasil" },
  { code: "REC", city: "Recife", name: "Guararapes", country: "Brasil" },
  { code: "FOR", city: "Fortaleza", name: "Pinto Martins", country: "Brasil" },
  { code: "SSA", city: "Salvador", name: "Luís Eduardo Magalhães", country: "Brasil" },
  { code: "BEL", city: "Belém", name: "Val-de-Cans", country: "Brasil" },
  { code: "MAO", city: "Manaus", name: "Eduardo Gomes", country: "Brasil" },
  { code: "NAT", city: "Natal", name: "São Gonçalo do Amarante", country: "Brasil" },
  { code: "MCZ", city: "Maceió", name: "Zumbi dos Palmares", country: "Brasil" },
  { code: "VIX", city: "Vitória", name: "Eurico de Aguiar Salles", country: "Brasil" },
  { code: "GYN", city: "Goiânia", name: "Santa Genoveva", country: "Brasil" },
  { code: "LIS", city: "Lisboa", name: "Humberto Delgado", country: "Portugal" },
  { code: "OPO", city: "Porto", name: "Francisco Sá Carneiro", country: "Portugal" },
  { code: "EZE", city: "Buenos Aires", name: "Ezeiza", country: "Argentina" },
  { code: "SCL", city: "Santiago", name: "Arturo Merino Benítez", country: "Chile" },
  { code: "BOG", city: "Bogotá", name: "El Dorado", country: "Colômbia" },
  { code: "LIM", city: "Lima", name: "Jorge Chávez", country: "Peru" },
  { code: "MEX", city: "Cidade do México", name: "Benito Juárez", country: "México" },
  { code: "MIA", city: "Miami", name: "Miami International", country: "EUA" },
  { code: "MCO", city: "Orlando", name: "Orlando International", country: "EUA" },
  { code: "LHR", city: "Londres", name: "Heathrow", country: "Reino Unido" },
  { code: "MAD", city: "Madri", name: "Barajas", country: "Espanha" },
  { code: "CDG", city: "Paris", name: "Charles de Gaulle", country: "França" },
];

function normalize(s: string): string {
  return s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
}

export function findAirports(query: string, limit = 8): Airport[] {
  const q = normalize(query.trim());
  if (!q) return ORIGIN_AIRPORTS.slice(0, limit);
  return ORIGIN_AIRPORTS.filter(
    (a) => normalize(`${a.code} ${a.city} ${a.name} ${a.country}`).includes(q),
  )
    .sort((a, b) => Number(normalize(b.code) === q) - Number(normalize(a.code) === q))
    .slice(0, limit);
}

export function airportLabel(value: string): string {
  const a = ORIGIN_AIRPORTS.find((x) => x.code === value.toUpperCase());
  return a ? `${a.city} (${a.code})` : value;
}
