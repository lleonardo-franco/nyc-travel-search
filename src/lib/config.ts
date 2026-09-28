/**
 * Configuração lida das variáveis de ambiente (ver .env.example).
 * Fontes sem chave (Kiwi.com MCP, Xotelo) ficam ligadas por padrão.
 */
export const config = {
  siteUrl: process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
  kiwiMcpUrl: process.env.KIWI_MCP_URL ?? "https://mcp.kiwi.com",
  kiwiEnabled: process.env.KIWI_MCP_ENABLED !== "false",
  xoteloEnabled: process.env.XOTELO_ENABLED !== "false",
  xoteloLocationKey: process.env.XOTELO_LOCATION_KEY ?? "g60763", // Nova York no TripAdvisor
  liteApiKey: process.env.LITEAPI_KEY ?? "",
  serpApiKey: process.env.SERPAPI_KEY ?? "",
  /** off: nunca usa dados fictícios; fallback: só quando todas as fontes reais falham; only: só demo. */
  demoMode: (process.env.DEMO_MODE ?? "fallback") as "off" | "fallback" | "only",
  rateLimitPerMinute: Number(process.env.RATE_LIMIT_PER_MINUTE ?? 60),
};
