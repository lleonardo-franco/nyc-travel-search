import { describe, expect, it, vi } from "vitest";
import { TtlCache } from "@/lib/cache";
import { addDays, formatDuration, nightsBetween, toDayMonthYear, todayIso } from "@/lib/dates";
import { distanceKm, LANDMARKS, neighborhoodOf } from "@/lib/geo";
import { mapLimit } from "@/lib/http";
import { flightSearchToQuery, hotelSearchToQuery, parseFlightSearch, parseHotelSearch } from "@/lib/params";

describe("datas", () => {
  it("calcula noites e formata para o MCP da Kiwi", () => {
    expect(nightsBetween("2026-11-10", "2026-11-15")).toBe(5);
    expect(addDays("2026-12-30", 3)).toBe("2027-01-02");
    expect(toDayMonthYear("2026-11-05")).toBe("05/11/2026");
    expect(formatDuration(815)).toBe("13h 35min");
    expect(formatDuration(45)).toBe("45min");
  });
});

describe("parâmetros de busca", () => {
  const checkin = addDays(todayIso(), 20);

  it("valida e normaliza a busca de hotéis", () => {
    const res = parseHotelSearch({ checkin, checkout: addDays(checkin, 3), adultos: "3", quartos: "2", criancas: "5,9", moeda: "usd" });
    expect(res.ok).toBe(true);
    expect(res.params).toMatchObject({ adults: 3, rooms: 2, childrenAges: [5, 9], currency: "USD" });
    const round = parseHotelSearch(new URLSearchParams(hotelSearchToQuery(res.params)));
    expect(round.params).toEqual(res.params);
  });

  it("recusa datas no passado, estadias longas e quartos sem adulto", () => {
    expect(parseHotelSearch({ checkin: "2020-01-01", checkout: "2020-01-03" }).ok).toBe(false);
    expect(parseHotelSearch({ checkin, checkout: addDays(checkin, 45) }).ok).toBe(false);
    expect(parseHotelSearch({ checkin, checkout: checkin }).ok).toBe(false);
    expect(parseHotelSearch({ checkin, checkout: addDays(checkin, 2), adultos: "1", quartos: "2" }).ok).toBe(false);
    const bad = parseHotelSearch({ checkin: "banana" });
    expect(bad.ok).toBe(false);
    // Em caso de erro, devolve parâmetros padrão válidos para a página continuar.
    expect(parseHotelSearch(new URLSearchParams(hotelSearchToQuery(bad.params))).ok).toBe(true);
  });

  it("entende ida e volta, só ida e rejeita origem inválida", () => {
    const rt = parseFlightSearch({ origem: "POA", ida: checkin, volta: addDays(checkin, 7), classe: "c" });
    expect(rt.ok && rt.params.returnDate).toBe(addDays(checkin, 7));
    expect(rt.params.cabin).toBe("C");
    const ow = parseFlightSearch(new URLSearchParams(flightSearchToQuery({ ...rt.params, returnDate: undefined })));
    expect(ow.ok).toBe(true);
    expect(ow.params.returnDate).toBeUndefined();
    expect(parseFlightSearch({ origem: "<script>", ida: checkin }).ok).toBe(false);
    expect(parseFlightSearch({ origem: "GRU", ida: checkin, adultos: "1", bebes: "2" }).ok).toBe(false);
  });
});

describe("geografia de NY", () => {
  it("identifica bairros pelas coordenadas", () => {
    expect(neighborhoodOf(LANDMARKS["times-square"])?.neighborhood).toBe("Times Square / Theater District");
    expect(neighborhoodOf({ lat: 40.7081, lng: -73.9571 })).toEqual({ neighborhood: "Williamsburg", borough: "Brooklyn" });
    expect(neighborhoodOf({ lat: 41.5, lng: -74.5 })).toBeUndefined();
  });

  it("calcula distâncias em km", () => {
    const km = distanceKm(LANDMARKS["times-square"], LANDMARKS["empire-state"]);
    expect(km).toBeGreaterThan(1)
    expect(km).toBeLessThan(1.2);
  });
});

describe("infra", () => {
  it("cache deduplica chamadas simultâneas e não guarda falhas", async () => {
    const cache = new TtlCache();
    const load = vi.fn(async () => 42);
    await Promise.all([cache.memo("k", 1000, load), cache.memo("k", 1000, load)]);
    expect(load).toHaveBeenCalledTimes(1);

    let calls = 0;
    const flaky = async () => {
      calls++;
      if (calls === 1) throw new Error("falhou");
      return "ok";
    };
    await expect(cache.memo("f", 1000, flaky)).rejects.toThrow("falhou");
    await expect(cache.memo("f", 1000, flaky)).resolves.toBe("ok");
  });

  it("mapLimit respeita o limite de concorrência e a ordem", async () => {
    let active = 0;
    let peak = 0;
    const res = await mapLimit([1, 2, 3, 4, 5, 6], 2, async (n) => {
      active++;
      peak = Math.max(peak, active);
      await new Promise((r) => setTimeout(r, 5));
      active--;
      return n * 10;
    });
    expect(res).toEqual([10, 20, 30, 40, 50, 60]);
    expect(peak).toBe(2);
  });
});
