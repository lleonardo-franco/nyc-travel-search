"use client";

import { useEffect, useEffectEvent, useRef, useState, type ReactNode } from "react";

/**
 * Popover leve: abre sob o gatilho, fecha ao clicar fora ou com Esc.
 * Em telas pequenas ocupa a largura toda (como nos apps de viagem).
 */
export function Popover({
  trigger,
  children,
  align = "left",
  panelClassName = "",
  open: controlledOpen,
  onOpenChange,
}: {
  trigger: (props: { open: boolean; toggle: () => void }) => ReactNode;
  children: ReactNode | ((close: () => void) => ReactNode);
  align?: "left" | "right";
  panelClassName?: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const [uncontrolled, setUncontrolled] = useState(false);
  const open = controlledOpen ?? uncontrolled;
  const setOpen = (v: boolean) => {
    setUncontrolled(v);
    onOpenChange?.(v);
  };
  const ref = useRef<HTMLDivElement>(null);
  const dismiss = useEffectEvent(() => setOpen(false));

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) dismiss();
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && dismiss();
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const close = () => setOpen(false);
  return (
    <div ref={ref} className="relative min-w-0">
      {trigger({ open, toggle: () => setOpen(!open) })}
      {open ? (
        <div
          role="dialog"
          className={`absolute top-full z-50 mt-2 max-w-[calc(100vw-2rem)] rounded-2xl border border-slate-200 bg-white p-4 shadow-2xl ${
            align === "right" ? "right-0" : "left-0"
          } ${panelClassName}`}
        >
          {typeof children === "function" ? children(close) : children}
        </div>
      ) : null}
    </div>
  );
}

/** Linha com botões − / + usada nos seletores de hóspedes e passageiros. */
export function Counter({
  label,
  hint,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  hint?: string;
  value: number;
  min: number;
  max: number;
  onChange: (n: number) => void;
}) {
  const btn =
    "grid h-9 w-9 place-items-center rounded-full border border-slate-300 text-lg text-slate-700 transition hover:border-blue-600 hover:text-blue-600 disabled:cursor-not-allowed disabled:opacity-30";
  return (
    <div className="flex items-center justify-between gap-4 py-2">
      <div>
        <div className="text-sm font-medium text-slate-900">{label}</div>
        {hint ? <div className="text-xs text-slate-500">{hint}</div> : null}
      </div>
      <div className="flex items-center gap-3">
        <button type="button" className={btn} disabled={value <= min} onClick={() => onChange(value - 1)} aria-label={`Menos ${label}`}>
          −
        </button>
        <span className="w-5 text-center text-sm font-semibold tabular-nums" aria-live="polite">
          {value}
        </span>
        <button type="button" className={btn} disabled={value >= max} onClick={() => onChange(value + 1)} aria-label={`Mais ${label}`}>
          +
        </button>
      </div>
    </div>
  );
}

/** Segmento clicável da barra de busca (estilo Hotels.com): ícone, rótulo pequeno e valor. */
export function SearchSegment({
  icon,
  label,
  value,
  onClick,
  active,
}: {
  icon: ReactNode;
  label: string;
  value: ReactNode;
  onClick?: () => void;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex h-14 w-full min-w-0 items-center gap-3 rounded-xl border px-3 text-left transition ${
        active ? "border-blue-600 ring-2 ring-blue-600/20" : "border-slate-300 hover:border-slate-500"
      }`}
    >
      <span className="shrink-0 text-slate-500">{icon}</span>
      <span className="min-w-0">
        <span className="block text-xs text-slate-500">{label}</span>
        <span className="block truncate text-sm font-medium text-slate-900">{value}</span>
      </span>
    </button>
  );
}
