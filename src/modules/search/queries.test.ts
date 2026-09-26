import { beforeEach, describe, expect, it, vi } from "vitest";
import { parseSearchQuery } from "./normalize";

const db = vi.hoisted(() => ({
  $queryRaw: vi.fn(),
  community: { findMany: vi.fn() },
  product: { findMany: vi.fn() },
}));
const hydratePosts = vi.hoisted(() => vi.fn());

vi.mock("@/server/db", () => ({ db }));
vi.mock("@/server/providers/storage", () => ({
  getStorage: () => ({ publicUrl: (key: string) => `/media/${key}` }),
}));
vi.mock("@/modules/social/post-queries", () => ({ hydratePosts }));

const { productCardsByIds, searchEverything } = await import("./queries");

const A = "0199a000-0000-7000-8000-00000000000a";
const B = "0199a000-0000-7000-8000-00000000000b";

function productRow(id: string, extra: Record<string, unknown> = {}) {
  return {
    id,
    slug: `producto-${id.slice(-1)}`,
    title: "Tenis para correr",
    priceCents: 149_900,
    currency: "MXN",
    city: "Guadalajara",
    stock: 3,
    status: "ACTIVE",
    media: [
      {
        media: {
          storageKey: "seed/tenis.webp",
          width: 800,
          height: 1000,
          blurDataUrl: null,
          altText: "Tenis",
        },
      },
    ],
    ...extra,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("productCardsByIds", () => {
  it("no pide el costo y, aunque la fila lo trajera, no lo devuelve", async () => {
    db.product.findMany.mockResolvedValue([
      productRow(A, { cost: { unitCostCents: 90_000 }, unitCostCents: 90_000 }),
    ]);

    const [card] = await productCardsByIds([A]);

    const query = db.product.findMany.mock.calls[0]![0] as { select: Record<string, unknown> };
    expect(Object.keys(query.select)).not.toContain("cost");
    expect(JSON.stringify(card)).not.toMatch(/cost|90000/i);
    expect(card).toEqual({
      id: A,
      slug: "producto-a",
      title: "Tenis para correr",
      priceCents: 149_900,
      currency: "MXN",
      city: "Guadalajara",
      inStock: true,
      image: {
        url: "/media/seed/tenis.webp",
        width: 800,
        height: 1000,
        blurDataUrl: null,
        alt: "Tenis",
      },
    });
  });

  it("respeta el orden pedido y solo los estados permitidos (por omisión, activos)", async () => {
    db.product.findMany.mockResolvedValue([productRow(A), productRow(B)]);

    const cards = await productCardsByIds([B, A]);

    expect(cards.map((card) => card.id)).toEqual([B, A]);
    const query = db.product.findMany.mock.calls[0]![0] as { where: unknown };
    // Nunca los ocultos por moderación (P14).
    expect(query.where).toEqual({
      id: { in: [B, A] },
      status: { in: ["ACTIVE"] },
      moderationStatus: "VISIBLE",
    });
  });

  it("un producto agotado se marca como tal", async () => {
    db.product.findMany.mockResolvedValue([productRow(A, { status: "SOLD_OUT", stock: 0 })]);

    const [card] = await productCardsByIds([A], ["ACTIVE", "SOLD_OUT"]);

    expect(card?.inStock).toBe(false);
  });

  it("sin IDs no consulta la base", async () => {
    expect(await productCardsByIds([])).toEqual([]);
    expect(db.product.findMany).not.toHaveBeenCalled();
  });
});

describe("searchEverything", () => {
  it("conserva el orden de relevancia de la búsqueda en cada sección", async () => {
    db.$queryRaw
      .mockResolvedValueOnce([{ id: B }, { id: A }]) // comunidades
      .mockResolvedValueOnce([]) // productos
      .mockResolvedValueOnce([{ id: A }]); // publicaciones
    db.community.findMany.mockResolvedValue([
      { id: A, slug: "a", name: "A" },
      { id: B, slug: "b", name: "B" },
    ]);
    hydratePosts.mockResolvedValue([{ id: A }]);

    const results = await searchEverything(parseSearchQuery("tecnologia")!, null);

    expect(results.communities.map((community) => community.id)).toEqual([B, A]);
    expect(results.products).toEqual([]);
    expect(db.product.findMany).not.toHaveBeenCalled();
    expect(hydratePosts).toHaveBeenCalledWith([A], null);
  });
});
