export interface Facet {
  value: string;
  count: number;
}

/** Conta ocorrências para montar as opções de filtro (mais frequentes primeiro). */
export function countBy(values: string[]): Facet[] {
  const counts = new Map<string, number>();
  for (const v of values) if (v) counts.set(v, (counts.get(v) ?? 0) + 1);
  return [...counts]
    .map(([value, count]) => ({ value, count }))
    .sort((a, b) => b.count - a.count || a.value.localeCompare(b.value));
}

/** Lista separada por "|" na URL. */
export const listParam = (v: string | null) => (v ? v.split("|").filter(Boolean) : []);

export const numParam = (v: string | null) =>
  v != null && v !== "" && Number.isFinite(Number(v)) ? Number(v) : undefined;
