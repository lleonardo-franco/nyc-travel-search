import { describe, expect, it } from "vitest";
import commons from "./fixtures/commons-geosearch.json";
import enwikiGeo from "./fixtures/enwiki-geosearch.json";
import pageImages from "./fixtures/enwiki-pageimages.json";
import {
  loadHotelBuildingPhoto,
  nearbyPhotosUrl,
  parseNearbyPhotos,
  parsePageImages,
  pickHotelArticleImage,
  wikimediaUserAgent,
  type ApiQueryResponse,
  type WikiFetch,
} from "@/lib/wikimedia";

describe("Wikimedia Commons — fotos perto do hotel", () => {
  it("monta a URL com CORS anônimo e raio em metros", () => {
    const url = new URL(nearbyPhotosUrl({ lat: 40.74406, lng: -73.99294 }, 8, 200));
    expect(url.searchParams.get("origin")).toBe("*");
    expect(url.searchParams.get("generator")).toBe("geosearch");
    expect(url.searchParams.get("ggscoord")).toBe("40.74406|-73.99294");
    expect(url.searchParams.get("ggsradius")).toBe("200");
  });

  it("aceita URLs com ?utm_source=… e descarta SVG e miniaturas", () => {
    const photos = parseNearbyPhotos(commons as ApiQueryResponse);
    expect(photos.map((p) => p.title)).toEqual([
      "Olde Good Things on the sidewalk",
      "131 West 24th Street",
      "Space...for once",
      "The Corner II",
    ]);
    expect(photos[0].thumbnail).toContain("utm_source");
  });

  it("limpa o HTML do autor e mantém licença e link do arquivo", () => {
    const [first] = parseNearbyPhotos(commons as ApiQueryResponse);
    expect(first.author).toBe("Jim.henderson");
    expect(first.license).toBe("CC0");
    expect(first.pageUrl).toMatch(/^https:\/\/commons\.wikimedia\.org\/wiki\/File:/);
  });

  it("respeita o limite", () => {
    expect(parseNearbyPhotos(commons as ApiQueryResponse, 2)).toHaveLength(2);
  });
});

describe("Wikipédia — fotos de lugares e do prédio do hotel", () => {
  it("segue normalização e redirecionamentos de títulos", () => {
    const files = parsePageImages(pageImages as ApiQueryResponse, ["Times Square", "SoHo,_Manhattan", "Nonexistent place"]);
    expect(files).toEqual({ "Times Square": "Times_Square,_New_York_City_(HDR).jpg", "SoHo,_Manhattan": "SoHo_building.jpg" });
  });

  it("só aceita o artigo cujo título bate com o nome do hotel", () => {
    const res = enwikiGeo as ApiQueryResponse;
    expect(pickHotelArticleImage(res, "The Plaza")).toEqual({ title: "The Plaza Hotel", file: "Plaza_Hotel_(New_York_City).jpg" });
    expect(pickHotelArticleImage(res, "The Plaza, a Fairmont Managed Hotel")?.title).toBe("The Plaza Hotel");
    expect(pickHotelArticleImage(res, "The Pierre, A Taj Hotel")?.title).toBe("The Pierre");
    expect(pickHotelArticleImage(res, "Pestana CR7 Times Square")).toBeNull();
    // "Grand Army Plaza (Manhattan)" tem palavras fora do nome; "Broadway" é genérico demais.
    expect(pickHotelArticleImage(res, "Park Lane Hotel")).toBeNull();
    expect(pickHotelArticleImage(res, "Hotel Edison on Broadway")).toBeNull();
  });

  it("encadeia geosearch + informações do arquivo com qualquer fetcher", async () => {
    const calls: string[] = [];
    const fetcher: WikiFetch = async (url) => {
      calls.push(url);
      if (url.includes("generator=geosearch")) return enwikiGeo as ApiQueryResponse;
      return {
        query: {
          pages: {
            "5": {
              title: "File:Plaza Hotel (New York City).jpg",
              imageinfo: [
                {
                  url: "https://upload.wikimedia.org/p.jpg?utm_source=x",
                  thumburl: "https://upload.wikimedia.org/p-960.jpg",
                  width: 3000,
                  descriptionurl: "https://commons.wikimedia.org/wiki/File:Plaza_Hotel_(New_York_City).jpg",
                  extmetadata: { LicenseShortName: { value: "CC BY-SA 3.0" } },
                },
              ],
            },
          },
        },
      };
    };
    const res = await loadHotelBuildingPhoto(fetcher, { lat: 40.7646, lng: -73.9743 }, "The Plaza");
    expect(calls).toHaveLength(2);
    expect(res?.article).toBe("The Plaza Hotel");
    expect(res?.articleUrl).toBe("https://en.wikipedia.org/wiki/The_Plaza_Hotel");
    expect(res?.photo.license).toBe("CC BY-SA 3.0");
  });

  it("identifica o app no User-Agent como pede a política do Wikimedia", () => {
    expect(wikimediaUserAgent()).toMatch(/^NycTravelSearch\/\d+\.\d+ \(https:\/\/github\.com\/.+\)/);
    expect(wikimediaUserAgent("contato@exemplo.com")).toContain("(contato@exemplo.com)");
  });
});
