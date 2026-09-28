import { formatNumber } from "@/lib/format";

/** Nota de 0–5 exibida na escala 0–10, como Hotels.com/Trivago. */
export function ratingWord(score10: number): string {
  if (score10 >= 9.4) return "Excepcional";
  if (score10 >= 9) return "Maravilhoso";
  if (score10 >= 8) return "Muito bom";
  if (score10 >= 7) return "Bom";
  if (score10 >= 6) return "Razoável";
  return "Regular";
}

export function RatingBadge({ rating, reviews, size = "md" }: { rating?: number; reviews?: number; size?: "sm" | "md" }) {
  if (rating == null) return <span className="text-xs text-slate-500">Sem avaliações</span>;
  const score = Math.min(10, rating * 2);
  const tone = score >= 8 ? "bg-emerald-700" : score >= 7 ? "bg-emerald-600" : "bg-amber-500";
  return (
    <span className="inline-flex items-center gap-2">
      <span
        className={`${tone} inline-grid place-items-center rounded-lg font-bold text-white tabular-nums ${
          size === "sm" ? "h-7 min-w-9 px-1.5 text-xs" : "h-9 min-w-11 px-2 text-sm"
        }`}
      >
        {score.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
      </span>
      <span className="leading-tight">
        <span className={`block font-semibold text-slate-900 ${size === "sm" ? "text-xs" : "text-sm"}`}>{ratingWord(score)}</span>
        {reviews ? <span className="block text-xs text-slate-500">{formatNumber(reviews)} avaliações</span> : null}
      </span>
    </span>
  );
}

export function Stars({ count }: { count?: number }) {
  if (!count) return null;
  return (
    <span className="text-amber-500" aria-label={`${count} estrelas`} title={`${count} estrelas`}>
      {"★".repeat(Math.round(count))}
    </span>
  );
}
