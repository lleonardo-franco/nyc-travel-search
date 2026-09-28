import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { addDays, todayIso } from "@/lib/dates";

// Servidor MCP do projeto contra os provedores de demonstração (sem rede).
let client: Client;

beforeAll(async () => {
  vi.stubEnv("DEMO_MODE", "only");
  const { createMcpServer } = await import("@/lib/mcp/server");
  const [clientSide, serverSide] = InMemoryTransport.createLinkedPair();
  await createMcpServer().connect(serverSide);
  client = new Client({ name: "teste", version: "1.0.0" });
  await client.connect(clientSide);
});

const checkin = addDays(todayIso(), 30);
const checkout = addDays(checkin, 4);

describe("servidor MCP", () => {
  it("lista as ferramentas e o prompt", async () => {
    const { tools } = await client.listTools();
    expect(tools.map((t) => t.name).sort()).toEqual(["get_hotel_details", "search_flights", "search_hotels"]);
    expect(tools.every((t) => t.annotations?.readOnlyHint)).toBe(true);
    const { prompts } = await client.listPrompts();
    expect(prompts.map((p) => p.name)).toContain("planejar_viagem_nyc");
  });

  it("search_hotels aplica preço máximo e devolve links para o site", async () => {
    const res = await client.callTool({
      name: "search_hotels",
      arguments: { checkin, checkout, max_price_per_night: 2000, limit: 5, sort: "price_asc" },
    });
    const data = res.structuredContent as { results: { best_price_per_night: number; details_url: string; id: string }[]; demo_data: boolean };
    expect(data.demo_data).toBe(true);
    expect(data.results.length).toBeGreaterThan(0);
    expect(data.results.length).toBeLessThanOrEqual(5);
    const prices = data.results.map((r) => r.best_price_per_night);
    expect(prices.every((p) => p <= 2000)).toBe(true);
    expect(prices).toEqual([...prices].sort((a, b) => a - b));
    expect(data.results[0].details_url).toContain(`/hoteis/demo/`);

    const details = await client.callTool({ name: "get_hotel_details", arguments: { hotel_id: data.results[0].id, checkin, checkout } });
    const hotel = details.structuredContent as { offers: { url?: string }[]; price_calendar?: object };
    expect(hotel.offers.length).toBeGreaterThan(0);
    expect(hotel.price_calendar).toBeDefined();
  });

  it("search_flights filtra por paradas e valida datas", async () => {
    const res = await client.callTool({
      name: "search_flights",
      arguments: { origin: "GRU", depart_date: checkin, return_date: checkout, max_stops: 0, sort: "price" },
    });
    const data = res.structuredContent as { results: { outbound: { stops: number } }[] };
    expect(data.results.every((f) => f.outbound.stops === 0)).toBe(true);

    const bad = await client.callTool({ name: "search_flights", arguments: { origin: "GRU", depart_date: "2001-01-01" } });
    expect(bad.isError).toBe(true);
  });
});
