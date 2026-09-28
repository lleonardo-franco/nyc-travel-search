import { config } from "./config";

const hits = new Map<string, { count: number; resetAt: number }>();

/**
 * Limite simples por IP (janela fixa de 1 min) para proteger as APIs públicas
 * que consultamos. Em produção com várias instâncias, troque por Redis/Upstash.
 */
export function rateLimit(request: Request, bucket: string, limit = config.rateLimitPerMinute): Response | null {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "local";
  const key = `${bucket}:${ip}`;
  const now = Date.now();
  const entry = hits.get(key);
  if (!entry || entry.resetAt <= now) {
    hits.set(key, { count: 1, resetAt: now + 60_000 });
    if (hits.size > 10_000) for (const [k, v] of hits) if (v.resetAt <= now) hits.delete(k);
    return null;
  }
  entry.count++;
  if (entry.count <= limit) return null;
  return Response.json(
    { error: "Muitas buscas em pouco tempo. Tente de novo em instantes." },
    { status: 429, headers: { "retry-after": String(Math.ceil((entry.resetAt - now) / 1000)) } },
  );
}
