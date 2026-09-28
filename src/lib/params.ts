import { z } from "zod";
import { addDays, defaultStay, isIsoDate, nightsBetween, todayIso } from "./dates";
import {
  CABIN_CLASSES,
  CURRENCIES,
  NYC_AIRPORTS,
  type FlightSearchParams,
  type HotelSearchParams,
} from "./types";

type RawParams = URLSearchParams | Record<string, string | string[] | undefined>;

function get(raw: RawParams, key: string): string | undefined {
  if (raw instanceof URLSearchParams) return raw.get(key) ?? undefined;
  const v = raw[key];
  return Array.isArray(v) ? v[0] : v;
}

const isoDate = z.string().refine(isIsoDate, "data inválida (use AAAA-MM-DD)");
const MAX_DAYS_AHEAD = 360;

export type ParseResult<T> = { ok: true; params: T } | { ok: false; error: string; params: T };

// ---------------------------------------------------------------------------
// Hotéis — parâmetros de URL: checkin, checkout, adultos, quartos, criancas, moeda, pagina
// ---------------------------------------------------------------------------

const hotelSchema = z
  .object({
    checkin: isoDate,
    checkout: isoDate,
    adults: z.coerce.number().int().min(1).max(16),
    rooms: z.coerce.number().int().min(1).max(8),
    childrenAges: z.array(z.coerce.number().int().min(0).max(17)).max(8),
    currency: z.enum(CURRENCIES),
    page: z.coerce.number().int().min(1).max(20),
  })
  .superRefine((p, ctx) => {
    const today = todayIso();
    if (p.checkin < today) ctx.addIssue({ code: "custom", message: "o check-in não pode ser no passado" });
    const nights = nightsBetween(p.checkin, p.checkout);
    if (nights < 1) ctx.addIssue({ code: "custom", message: "o check-out deve ser depois do check-in" });
    if (nights > 30) ctx.addIssue({ code: "custom", message: "estadia máxima de 30 noites" });
    if (p.checkin > addDays(today, MAX_DAYS_AHEAD))
      ctx.addIssue({ code: "custom", message: "o check-in deve ser em até 360 dias" });
    if (p.adults < p.rooms) ctx.addIssue({ code: "custom", message: "cada quarto precisa de pelo menos 1 adulto" });
  });

export function hotelDefaults(): HotelSearchParams {
  return { ...defaultStay(), adults: 2, rooms: 1, childrenAges: [], currency: "BRL", page: 1 };
}

export function parseHotelSearch(raw: RawParams): ParseResult<HotelSearchParams> {
  const defaults = hotelDefaults();
  const kids = get(raw, "criancas");
  const candidate = {
    checkin: get(raw, "checkin") || defaults.checkin,
    checkout: get(raw, "checkout") || defaults.checkout,
    adults: get(raw, "adultos") || defaults.adults,
    rooms: get(raw, "quartos") || defaults.rooms,
    childrenAges: kids ? kids.split(",").filter(Boolean) : [],
    currency: (get(raw, "moeda") || defaults.currency).toUpperCase(),
    page: get(raw, "pagina") || 1,
  };
  const parsed = hotelSchema.safeParse(candidate);
  if (parsed.success) return { ok: true, params: parsed.data };
  return { ok: false, error: parsed.error.issues[0]?.message ?? "parâmetros inválidos", params: defaults };
}

export function hotelSearchToQuery(p: HotelSearchParams, extra: Record<string, string> = {}): string {
  const q = new URLSearchParams({
    checkin: p.checkin,
    checkout: p.checkout,
    adultos: String(p.adults),
    quartos: String(p.rooms),
    moeda: p.currency,
  });
  if (p.childrenAges.length) q.set("criancas", p.childrenAges.join(","));
  if (p.page > 1) q.set("pagina", String(p.page));
  for (const [k, v] of Object.entries(extra)) q.set(k, v);
  return q.toString();
}

// ---------------------------------------------------------------------------
// Voos — parâmetros de URL: origem, destino, ida, volta, adultos, criancas, bebes, classe, moeda, flex
// ---------------------------------------------------------------------------

const flightSchema = z
  .object({
    origin: z
      .string()
      .trim()
      .min(2, "informe a origem")
      .max(60)
      .regex(/^[\p{L}\p{N} .,'-]+$/u, "origem inválida"),
    destination: z.enum(NYC_AIRPORTS),
    departDate: isoDate,
    returnDate: isoDate.optional(),
    adults: z.coerce.number().int().min(1).max(9),
    children: z.coerce.number().int().min(0).max(8),
    infants: z.coerce.number().int().min(0).max(4),
    cabin: z.enum(CABIN_CLASSES),
    currency: z.enum(CURRENCIES),
    flexDays: z.coerce.number().int().min(0).max(3),
  })
  .superRefine((p, ctx) => {
    const today = todayIso();
    if (p.departDate < today) ctx.addIssue({ code: "custom", message: "a data de ida não pode ser no passado" });
    if (p.departDate > addDays(today, MAX_DAYS_AHEAD))
      ctx.addIssue({ code: "custom", message: "a ida deve ser em até 360 dias" });
    if (p.returnDate && p.returnDate < p.departDate)
      ctx.addIssue({ code: "custom", message: "a volta deve ser depois da ida" });
    if (p.infants > p.adults) ctx.addIssue({ code: "custom", message: "no máximo 1 bebê por adulto" });
    if (p.adults + p.children > 9) ctx.addIssue({ code: "custom", message: "no máximo 9 passageiros" });
  });

export function flightDefaults(): FlightSearchParams {
  const { checkin, checkout } = defaultStay();
  return {
    origin: "GRU",
    destination: "NYC",
    departDate: checkin,
    returnDate: checkout,
    adults: 1,
    children: 0,
    infants: 0,
    cabin: "M",
    currency: "BRL",
    flexDays: 0,
  };
}

export function parseFlightSearch(raw: RawParams): ParseResult<FlightSearchParams> {
  const defaults = flightDefaults();
  const oneWay = get(raw, "volta") === "";
  const candidate = {
    origin: get(raw, "origem") || defaults.origin,
    destination: (get(raw, "destino") || defaults.destination).toUpperCase(),
    departDate: get(raw, "ida") || defaults.departDate,
    returnDate: oneWay ? undefined : get(raw, "volta") || (get(raw, "ida") ? undefined : defaults.returnDate),
    adults: get(raw, "adultos") || defaults.adults,
    children: get(raw, "criancas") || 0,
    infants: get(raw, "bebes") || 0,
    cabin: (get(raw, "classe") || defaults.cabin).toUpperCase(),
    currency: (get(raw, "moeda") || defaults.currency).toUpperCase(),
    flexDays: get(raw, "flex") || 0,
  };
  const parsed = flightSchema.safeParse(candidate);
  if (parsed.success) return { ok: true, params: parsed.data };
  return { ok: false, error: parsed.error.issues[0]?.message ?? "parâmetros inválidos", params: defaults };
}

export function flightSearchToQuery(p: FlightSearchParams): string {
  const q = new URLSearchParams({
    origem: p.origin,
    destino: p.destination,
    ida: p.departDate,
    volta: p.returnDate ?? "",
    adultos: String(p.adults),
    moeda: p.currency,
    classe: p.cabin,
  });
  if (p.children) q.set("criancas", String(p.children));
  if (p.infants) q.set("bebes", String(p.infants));
  if (p.flexDays) q.set("flex", String(p.flexDays));
  return q.toString();
}
