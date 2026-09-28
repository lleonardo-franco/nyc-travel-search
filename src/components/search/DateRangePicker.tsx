"use client";

import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { useState } from "react";
import { addDays, formatMonthTitle, formatWeekdayDate, nightsBetween, todayIso } from "@/lib/dates";
import { Popover, SearchSegment } from "@/components/ui/Popover";

const WEEKDAYS = ["D", "S", "T", "Q", "Q", "S", "S"];

function monthStart(iso: string): string {
  return `${iso.slice(0, 7)}-01`;
}

function addMonths(iso: string, n: number): string {
  const d = new Date(`${monthStart(iso)}T00:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + n);
  return d.toISOString().slice(0, 10);
}

function monthDays(first: string): (string | null)[] {
  const d = new Date(`${first}T00:00:00Z`);
  const lead = d.getUTCDay();
  const count = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  return [...Array<null>(lead).fill(null), ...Array.from({ length: count }, (_, i) => addDays(first, i))];
}

interface Props {
  mode: "range" | "single";
  start: string;
  end?: string;
  onChange: (start: string, end?: string) => void;
  /** Máximo de noites entre início e fim (hotéis: 30). */
  maxSpan?: number;
  labels?: { start: string; end: string };
  /** Preço relativo de cada dia (calendário de preços), opcional. */
  dayTone?: (iso: string) => "cheap" | "average" | "high" | undefined;
  align?: "left" | "right";
}

export function DateRangePicker({ mode, start, end, onChange, maxSpan = 330, labels, dayTone, align = "left" }: Props) {
  const today = todayIso();
  const maxDate = addDays(today, 360);
  const [open, setOpen] = useState(false);
  const [view, setView] = useState(monthStart(start));
  const [picking, setPicking] = useState<"start" | "end">("start");
  const [hover, setHover] = useState<string | null>(null);

  const openPicker = (v: boolean) => {
    setOpen(v);
    if (v) {
      setView(monthStart(start));
      setPicking("start");
    } else if (mode === "range" && !end) {
      // Fechou sem escolher a saída: assume 1 noite para o formulário continuar válido.
      onChange(start, addDays(start, 1));
    }
  };

  const select = (day: string) => {
    if (mode === "single") {
      onChange(day);
      setOpen(false);
      return;
    }
    if (picking === "start" || !start || day <= start) {
      onChange(day, undefined);
      setPicking("end");
    } else {
      onChange(start, day);
      setPicking("start");
    }
  };

  const disabled = (day: string) => {
    if (day < today || day > maxDate) return true;
    if (mode === "range" && picking === "end" && start && day > start) return nightsBetween(start, day) > maxSpan;
    return false;
  };

  const rangeEnd = mode === "range" ? (picking === "end" ? hover ?? end : end) : undefined;
  const nights = start && end ? nightsBetween(start, end) : 0;

  const summary =
    mode === "single"
      ? formatWeekdayDate(start)
      : `${formatWeekdayDate(start)} — ${end ? formatWeekdayDate(end) : "…"}`;

  return (
    <Popover
      open={open}
      onOpenChange={openPicker}
      align={align}
      panelClassName="w-[21rem] md:w-[42rem]"
      trigger={({ toggle, open }) => (
        <SearchSegment
          icon={<CalendarDays className="h-5 w-5" />}
          label={mode === "single" ? labels?.start ?? "Data" : `${labels?.start ?? "Check-in"} — ${labels?.end ?? "Check-out"}`}
          value={summary}
          onClick={toggle}
          active={open}
        />
      )}
    >
      {(close) => (
        <div>
          <div className="mb-2 flex items-center justify-between">
            <button
              type="button"
              className="grid h-9 w-9 place-items-center rounded-full hover:bg-slate-100 disabled:opacity-30"
              onClick={() => setView(addMonths(view, -1))}
              disabled={view <= monthStart(today)}
              aria-label="Mês anterior"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <p className="text-sm text-slate-600">
              {mode === "range"
                ? picking === "end"
                  ? "Escolha a data de saída"
                  : "Escolha a data de entrada"
                : "Escolha a data"}
            </p>
            <button
              type="button"
              className="grid h-9 w-9 place-items-center rounded-full hover:bg-slate-100 disabled:opacity-30"
              onClick={() => setView(addMonths(view, 1))}
              disabled={addMonths(view, 1) > maxDate}
              aria-label="Próximo mês"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>

          <div className="grid gap-6 md:grid-cols-2" onMouseLeave={() => setHover(null)}>
            {[view, addMonths(view, 1)].map((first, idx) => (
              <div key={first} className={idx === 1 ? "hidden md:block" : ""}>
                <p className="mb-2 text-center text-sm font-semibold text-slate-900">
                  {formatMonthTitle(first)}
                </p>
                <div className="grid grid-cols-7 text-center text-xs text-slate-500">
                  {WEEKDAYS.map((w, i) => (
                    <span key={i} className="py-1">
                      {w}
                    </span>
                  ))}
                </div>
                <div className="grid grid-cols-7">
                  {monthDays(first).map((day, i) => {
                    if (!day) return <span key={`e${i}`} />;
                    const isStart = day === start;
                    const isEnd = day === rangeEnd;
                    const inRange = mode === "range" && start && rangeEnd && day > start && day < rangeEnd;
                    const off = disabled(day);
                    const tone = dayTone?.(day);
                    return (
                      <button
                        key={day}
                        type="button"
                        disabled={off}
                        onClick={() => select(day)}
                        onMouseEnter={() => setHover(day)}
                        className={`relative h-10 text-sm tabular-nums transition ${
                          inRange ? "bg-blue-50" : ""
                        } ${isStart && rangeEnd ? "rounded-l-full bg-blue-50" : ""} ${isEnd ? "rounded-r-full bg-blue-50" : ""} ${
                          off ? "cursor-not-allowed text-slate-300 line-through decoration-slate-200" : "text-slate-800"
                        }`}
                      >
                        <span
                          className={`mx-auto grid h-10 w-10 place-items-center rounded-full ${
                            isStart || isEnd ? "bg-blue-600 font-semibold text-white" : off ? "" : "hover:ring-1 hover:ring-slate-900"
                          }`}
                        >
                          {Number(day.slice(8))}
                        </span>
                        {tone && !off ? (
                          <span
                            className={`absolute bottom-1 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full ${
                              tone === "cheap" ? "bg-emerald-500" : tone === "high" ? "bg-rose-500" : "bg-amber-400"
                            }`}
                          />
                        ) : null}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-3">
            <span className="text-sm text-slate-600">
              {mode === "range" && nights > 0 ? `${nights} ${nights === 1 ? "noite" : "noites"}` : ""}
            </span>
            <button
              type="button"
              onClick={close}
              disabled={mode === "range" && !end}
              className="rounded-full bg-blue-600 px-5 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-40"
            >
              Concluir
            </button>
          </div>
        </div>
      )}
    </Popover>
  );
}
