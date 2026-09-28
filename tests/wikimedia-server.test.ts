import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import commons from "./fixtures/commons-geosearch.json";

const point = { lat: 40.74406, lng: -73.99294 };

function json(body: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" }, ...init });
}

describe("acesso do servidor ao Wikimedia", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv("WIKIMEDIA_ACCESS_TOKEN", "tok123");
    vi.stubEnv("WIKIMEDIA_CONTACT", "contato@exemplo.com");
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("envia User-Agent e token, e devolve o cookie de sessão do gateway", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(json(commons, { headers: { "set-cookie": "sessionJwt=abc; Path=/; Secure; HttpOnly" } }))
      .mockResolvedValueOnce(json({ query: { pages: {} } }));
    vi.stubGlobal("fetch", fetchMock);
    const { serverNearbyPhotos } = await import("@/lib/wikimedia-server");

    expect(await serverNearbyPhotos(point)).toHaveLength(4);
    await serverNearbyPhotos({ lat: 40.7, lng: -74 });

    const first = fetchMock.mock.calls[0][1].headers;
    expect(first["user-agent"]).toContain("(contato@exemplo.com)");
    expect(first.authorization).toBe("Bearer tok123");
    expect(first.cookie).toBeUndefined();
    expect(fetchMock.mock.calls[1][1].headers.cookie).toBe("sessionJwt=abc");
  });

  it("com 429 abre o disjuntor e para de chamar a API até o Retry-After", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response("limite", { status: 429, headers: { "retry-after": "30" } }));
    vi.stubGlobal("fetch", fetchMock);
    const { serverNearbyPhotos, wikimediaBlockedFor } = await import("@/lib/wikimedia-server");

    // null = indisponível: a página cai para a busca pelo navegador.
    expect(await serverNearbyPhotos(point)).toBeNull();
    expect(wikimediaBlockedFor()).toBeGreaterThan(25_000);
    expect(await serverNearbyPhotos({ lat: 40.71, lng: -74.01 })).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
