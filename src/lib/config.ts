/** Variável de ambiente, tratando string vazia como ausente. */
const env = (name: string): string | undefined => process.env[name] || undefined;

/**
 * URL pública do site. Na Vercel, sem NEXT_PUBLIC_SITE_URL, usa o domínio de produção
 * do projeto (variável de sistema VERCEL_PROJECT_PRODUCTION_URL) ou o do deploy atual.
 */
function siteUrl(): string {
  const explicit = env("NEXT_PUBLIC_SITE_URL");
  if (explicit) return explicit.replace(/\/$/, "");
  const vercelHost = env("VERCEL_PROJECT_PRODUCTION_URL") ?? env("VERCEL_URL");
  return vercelHost ? `https://${vercelHost}` : "http://localhost:3000";
}

/**
 * Configuração lida das variáveis de ambiente (ver .env.example).
 * Fontes sem chave (Kiwi.com MCP, Xotelo) ficam ligadas por padrão.
 */
export const config = {
  siteUrl: siteUrl(),
  kiwiMcpUrl: env("KIWI_MCP_URL") ?? "https://mcp.kiwi.com",
  kiwiEnabled: env("KIWI_MCP_ENABLED") !== "false",
  xoteloEnabled: env("XOTELO_ENABLED") !== "false",
  xoteloLocationKey: env("XOTELO_LOCATION_KEY") ?? "g60763", // Nova York no TripAdvisor
  liteApiKey: env("LITEAPI_KEY") ?? "",
  serpApiKey: env("SERPAPI_KEY") ?? "",
  /** off: nunca usa dados fictícios; fallback: só quando todas as fontes reais falham; only: só demo. */
  demoMode: (env("DEMO_MODE") ?? "fallback") as "off" | "fallback" | "only",
  rateLimitPerMinute: Number(env("RATE_LIMIT_PER_MINUTE") ?? 60),
};
