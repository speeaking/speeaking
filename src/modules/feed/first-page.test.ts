import type * as React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { productSlugsIn, repeatsFeedProduct } from "./dedupe";
import type { FeedItemDTO, FeedPageDTO } from "./dto";

// `cache` de React solo memoriza dentro de un request de servidor (RSC). Aquí se simula con la
// misma semántica —misma función y mismos argumentos (por identidad) → misma promesa— para
// comprobar que el inicio y la columna comparten la primera página.
vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal<typeof React>();
  return {
    ...actual,
    cache: <A extends unknown[], R>(fn: (...args: A) => R) => {
      const memo = new Map<string, R>();
      return (...args: A) => {
        const key = JSON.stringify(args);
        if (!memo.has(key)) memo.set(key, fn(...args));
        return memo.get(key)!;
      };
    },
  };
});
vi.mock("./engine", () => ({ recommendationEngine: { getFeed: vi.fn() } }));
// El carrusel de productos (ADR-051) se prueba aparte; aquí la página va sin él.
vi.mock("./product-carousel", () => ({ pickFeedProducts: vi.fn(async () => null) }));
// Los videos de la vitrina superior consultan la base; aquí no se usan.
vi.mock("@/modules/social/video-queries", () => ({
  listHomeReelVideos: vi.fn(async () => ({ items: [], platformUpdateId: null })),
}));

const { recommendationEngine } = await import("./engine");
const { getHomeFirstPage } = await import("./first-page");

const product = (slug: string) => ({ product: { slug } }) as Pick<FeedItemDTO, "product">;
const post = () => ({ product: null }) as Pick<FeedItemDTO, "product">;

beforeEach(() => {
  vi.mocked(recommendationEngine.getFeed).mockReset();
  vi.mocked(recommendationEngine.getFeed).mockImplementation(async (): Promise<FeedPageDTO> => ({
    items: [],
    nextCursor: null,
  }));
});

describe("getHomeFirstPage (una vez por request)", () => {
  it("la página de inicio y la columna reciben la misma primera página", async () => {
    const fromPage = getHomeFirstPage("viewer-cache-1");
    const fromRail = getHomeFirstPage("viewer-cache-1");

    expect(fromRail).toBe(fromPage);
    expect(recommendationEngine.getFeed).toHaveBeenCalledTimes(1);
    // «Para ti» sin filtros ni cursor: la misma que pinta el inicio.
    expect(recommendationEngine.getFeed).toHaveBeenCalledWith({ viewerId: "viewer-cache-1" });
  });

  it("cada persona (y el visitante) tiene su propia página", async () => {
    await getHomeFirstPage("viewer-cache-2");
    await getHomeFirstPage(null);

    expect(recommendationEngine.getFeed).toHaveBeenCalledTimes(2);
  });
});

describe("dedupe de «Lo que buscas»", () => {
  const items = [post(), product("tenis-rojos"), post(), product("audifonos")];

  it("junta los productos de la página por slug", () => {
    expect(productSlugsIn(items)).toEqual(new Set(["tenis-rojos", "audifonos"]));
  });

  it("un producto que ya está en la primera página se repetiría", () => {
    expect(repeatsFeedProduct({ slug: "tenis-rojos" }, items)).toBe(true);
  });

  it("uno que no está, o ningún producto, no se repite", () => {
    expect(repeatsFeedProduct({ slug: "tenis-azules" }, items)).toBe(false);
    expect(repeatsFeedProduct(null, items)).toBe(false);
    expect(repeatsFeedProduct({ slug: "tenis-rojos" }, [])).toBe(false);
  });
});
