import { describe, expect, it } from "vitest";
import type { ProductCardDTO } from "@/modules/catalog/queries";
import {
  composeFeedProducts,
  FALLBACK_ORDER,
  FEED_PRODUCTS_SIZE,
  type ProductTier,
  rotate,
} from "./product-carousel-compose";

const card = (n: number, overrides: Partial<ProductCardDTO> = {}): ProductCardDTO => ({
  id: `0199a000-0000-7000-8000-0000000000${n.toString().padStart(2, "0")}`,
  slug: `producto-${n}`,
  title: `Producto ${n}`,
  priceCents: 10_000 * n,
  currency: "MXN",
  city: "Guadalajara",
  inStock: true,
  tryOn: false,
  image: null,
  ...overrides,
});

const cardsOf = (...cards: ProductCardDTO[]) => new Map(cards.map((item) => [item.id, item]));
const ids = (...numbers: number[]) => numbers.map((n) => card(n).id);

describe("composeFeedProducts (ADR-051)", () => {
  it("patrocinados primero y etiquetados, luego el tramo personal, hasta llenar el carrusel", () => {
    const sponsored = [card(90), card(91), card(92)];
    const tiers: ProductTier[] = [
      { kind: "intent", ids: ids(1, 2), reason: "“lentes de sol” hasta $800" },
      { kind: "bestSellers", ids: ids(3, 4, 5, 6, 7, 8, 9) },
    ];
    const cards = cardsOf(...[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => card(n)));

    const block = composeFeedProducts({ sponsored, tiers, cards, exclude: new Set() })!;

    expect(block.items).toHaveLength(FEED_PRODUCTS_SIZE);
    // Máximo dos patrocinados, siempre al frente.
    expect(block.items.slice(0, 2).map((item) => item.sponsored)).toEqual([true, true]);
    expect(block.items.slice(2).every((item) => !item.sponsored)).toBe(true);
    expect(block.items.map((item) => item.product.slug).slice(2, 4)).toEqual([
      "producto-1",
      "producto-2",
    ]);
    // El título lo da el tramo que aportó primero, con su razón escrita.
    expect(block.title).toBe("Según tu búsqueda");
    expect(block.reason).toBe("“lentes de sol” hasta $800");
  });

  it("no repite productos: ni los de la página del feed, ni entre tramos, ni los sin existencia", () => {
    const tiers: ProductTier[] = [
      { kind: "bestSellers", ids: ids(1, 2, 3) },
      { kind: "popular", ids: ids(2, 3, 4) },
      { kind: "newest", ids: ids(5) },
    ];
    const cards = cardsOf(card(1), card(2), card(3), card(4, { inStock: false }), card(5));

    const block = composeFeedProducts({
      sponsored: [card(1)],
      tiers,
      cards,
      exclude: new Set(["producto-3"]),
    })!;

    expect(block.items.map((item) => item.product.slug)).toEqual([
      "producto-1",
      "producto-2",
      "producto-5",
    ]);
    expect(block.items[0]!.sponsored).toBe(true);
    expect(block.title).toBe("Lo más vendido");
    expect(block.reason).toBe("En los últimos 30 días");
  });

  it("omite ids sin tarjeta (ocultos o ya inactivos) y con menos de tres piezas no pinta nada", () => {
    const tiers: ProductTier[] = [{ kind: "newest", ids: ids(1, 2, 3, 4) }];

    expect(
      composeFeedProducts({
        sponsored: [],
        tiers,
        cards: cardsOf(card(1), card(2)),
        exclude: new Set(),
      }),
    ).toBeNull();
    expect(
      composeFeedProducts({
        sponsored: [],
        tiers,
        cards: cardsOf(card(1), card(2), card(3)),
        exclude: new Set(),
      })?.items,
    ).toHaveLength(3);
  });

  it("con solo patrocinados lo dice; «Ver todo» de la intención lleva a su búsqueda", () => {
    const onlyAds = composeFeedProducts({
      sponsored: [card(1), card(2), card(3)],
      tiers: [],
      cards: new Map(),
      exclude: new Set(),
    });
    // Dos patrocinados como máximo: no llega a tres piezas.
    expect(onlyAds).toBeNull();

    const block = composeFeedProducts({
      sponsored: [],
      tiers: [{ kind: "intent", ids: ids(1, 2, 3), reason: "“tenis”" }],
      cards: cardsOf(card(1), card(2), card(3)),
      exclude: new Set(),
      searchHref: "/comprar?q=tenis",
    })!;
    expect(block.href).toBe("/comprar?q=tenis");

    const fallback = composeFeedProducts({
      sponsored: [],
      tiers: [{ kind: "popular", ids: ids(1, 2, 3) }],
      cards: cardsOf(card(1), card(2), card(3)),
      exclude: new Set(),
      searchHref: "/comprar?q=tenis",
    })!;
    expect(fallback.href).toBe("/comprar");
    expect(fallback.title).toBe("Populares");
  });

  it("rota los respaldos para que cada página empiece en un tramo distinto", () => {
    expect(rotate(FALLBACK_ORDER, 0)).toEqual(["bestSellers", "popular", "newest"]);
    expect(rotate(FALLBACK_ORDER, 1)).toEqual(["popular", "newest", "bestSellers"]);
    expect(rotate(FALLBACK_ORDER, 5)).toEqual(["newest", "bestSellers", "popular"]);
    expect(rotate([], 3)).toEqual([]);
  });
});
