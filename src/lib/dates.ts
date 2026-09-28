const DAY_MS = 86_400_000;

/** Data de hoje (YYYY-MM-DD) no fuso de Nova York, que é o que importa para check-in. */
export function todayIso(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" }).format(now);
}

export function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  return new Date(d.getTime() + days * DAY_MS).toISOString().slice(0, 10);
}

export function nightsBetween(checkin: string, checkout: string): number {
  const a = Date.parse(`${checkin}T00:00:00Z`);
  const b = Date.parse(`${checkout}T00:00:00Z`);
  return Math.round((b - a) / DAY_MS);
}

export function isIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

/** YYYY-MM-DD → dd/mm/yyyy (formato exigido pelo MCP da Kiwi.com). */
export function toDayMonthYear(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

/** Datas padrão: check-in daqui a 30 dias, 5 noites. */
export function defaultStay(now = new Date()): { checkin: string; checkout: string } {
  const checkin = addDays(todayIso(now), 30);
  return { checkin, checkout: addDays(checkin, 5) };
}

const shortDate = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", timeZone: "UTC" });
const weekdayDate = new Intl.DateTimeFormat("pt-BR", {
  weekday: "short",
  day: "2-digit",
  month: "short",
  timeZone: "UTC",
});

export function formatShortDate(iso: string): string {
  return shortDate.format(new Date(`${iso.slice(0, 10)}T00:00:00Z`)).replace(".", "");
}

export function formatWeekdayDate(iso: string): string {
  return weekdayDate.format(new Date(`${iso.slice(0, 10)}T00:00:00Z`)).replace(/\./g, "");
}

/** Hora local HH:mm de um timestamp ISO sem fuso (horário do aeroporto). */
export function formatTime(isoLocal: string): string {
  return isoLocal.slice(11, 16);
}

export function hourOf(isoLocal: string): number {
  return Number(isoLocal.slice(11, 13));
}

/** Dias de diferença entre as datas de dois horários locais (para exibir "+1"). */
export function dayOffset(fromIso: string, toIso: string): number {
  return nightsBetween(fromIso.slice(0, 10), toIso.slice(0, 10));
}

export function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  if (h === 0) return `${m}min`;
  return m === 0 ? `${h}h` : `${h}h ${String(m).padStart(2, "0")}min`;
}

const monthYear = new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric", timeZone: "UTC" });

/** "novembro de 2026" → "Novembro de 2026" */
export function formatMonthTitle(iso: string): string {
  const text = monthYear.format(new Date(`${iso.slice(0, 10)}T00:00:00Z`));
  return text[0].toUpperCase() + text.slice(1);
}
