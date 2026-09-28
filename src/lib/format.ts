import type { Currency, HotelSearchParams } from "./types";

const formatters = new Map<string, Intl.NumberFormat>();

export function formatMoney(amount: number, currency: Currency, fractionDigits = 0): string {
  const key = `${currency}:${fractionDigits}`;
  let f = formatters.get(key);
  if (!f) {
    f = new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency,
      maximumFractionDigits: fractionDigits,
      minimumFractionDigits: fractionDigits,
    });
    formatters.set(key, f);
  }
  return f.format(amount);
}

export function formatNumber(n: number): string {
  return n.toLocaleString("pt-BR");
}

export function plural(n: number, singular: string, pluralForm = `${singular}s`): string {
  return `${n} ${n === 1 ? singular : pluralForm}`;
}

export const CABIN_LABELS = {
  M: "Econômica",
  W: "Econômica premium",
  C: "Executiva",
  F: "Primeira classe",
} as const;

export const AIRPORT_LABELS = {
  NYC: "Todos os aeroportos de NY",
  JFK: "JFK — John F. Kennedy",
  EWR: "EWR — Newark",
  LGA: "LGA — LaGuardia",
} as const;

export function guestsSummary(p: Pick<HotelSearchParams, "adults" | "rooms" | "childrenAges">): string {
  const guests = p.adults + p.childrenAges.length;
  return `${guests} ${guests === 1 ? "hóspede" : "hóspedes"}, ${p.rooms} ${p.rooms === 1 ? "quarto" : "quartos"}`;
}
