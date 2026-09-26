import { beforeEach, describe, expect, it, vi } from "vitest";
import { parseSearchQuery } from "@/modules/search/normalize";

const db = vi.hoisted(() => ({ $queryRaw: vi.fn(), product: { findMany: vi.fn() } }));

vi.mock("@/server/db", () => ({ db }));
vi.mock("@/server/providers/storage", () => ({
  getStorage: () => ({ publicUrl: (key: string) => `/media/${key}` }),
}));

const { listShopProducts } = await import("./queries");

const A = "0199a000-0000-7000-8000-00000000000a";
const B = "0199a000-0000-7000-8000-00000000000b";

function row(id: string, title: string) {
  return {
    id,
    slug: title.toLowerCase().replaceAll(" ", "-"),
    title,
    priceCents: 349_900,
    currency: "MXN",
    city: "Ciudad de México",
    stock: 5,
    status: "ACTIVE",
    media: [],
  };
}

/** El SQL que recibió la base en la llamada `index`. */
function sqlCall(index = 0) {
  return db.$queryRaw.mock.calls[index]![0] as { text: string; values: unknown[] };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("listShopProducts (búsqueda de Comprar)", () => {
  it("«tecnologia» y «Tecnología» son la misma búsqueda", async () => {
    db.$queryRaw.mockResolvedValue([]);

    await listShopProducts({ query: parseSearchQuery("tecnologia") });
    await listShopProducts({ query: parseSearchQuery("  TECNOLOGÍA ") });

    expect(sqlCall(0).values).toEqual(sqlCall(1).values);
    expect(sqlCall(0).values).toContain("%tecnologia%");
    expect(sqlCall(0).text).toMatch(/translate\(lower\(/);
  });

  it("busca por palabras: todas deben aparecer, en cualquier orden", async () => {
    db.$queryRaw.mockResolvedValue([]);

    await listShopProducts({ query: parseSearchQuery("inalámbrico control") });

    const { text, values } = sqlCall();
    expect(values).toContain("%inalambrico%");
    expect(values).toContain("%control%");
    expect(text).toMatch(/LIKE \$\d+ AND [\s\S]+ LIKE \$\d+/);
  });

  it("el texto y la categoría solo viajan como parámetros", async () => {
    db.$queryRaw.mockResolvedValue([]);

    await listShopProducts({
      query: parseSearchQuery("x'); DROP TABLE products; --"),
      categorySlug: "audio'--",
    });

    const { text, values } = sqlCall();
    expect(text).not.toContain("DROP");
    expect(text).not.toContain("audio'");
    expect(values).toContain("%drop%");
    expect(values).toContain("audio'--");
  });

  it("respeta el orden de relevancia y no pide el costo", async () => {
    db.$queryRaw.mockResolvedValue([{ id: B }, { id: A }]);
    db.product.findMany.mockResolvedValue([row(A, "Control inalámbrico"), row(B, "AirPods Pro 2")]);

    const cards = await listShopProducts({ query: parseSearchQuery("inalambrico"), limit: 24 });

    expect(cards.map((card) => card.id)).toEqual([B, A]);
    expect(sqlCall().values.at(-1)).toBe(24);
    const query = db.product.findMany.mock.calls[0]![0] as {
      where: unknown;
      select: Record<string, unknown>;
    };
    expect(Object.keys(query.select)).not.toContain("cost");
    // Aunque la búsqueda y la carga no ocurren en el mismo instante, solo salen productos visibles
    // (activos, con piezas y no ocultos por moderación).
    expect(query.where).toEqual({
      status: "ACTIVE",
      stock: { gt: 0 },
      moderationStatus: "VISIBLE",
      id: { in: [B, A] },
    });
  });

  it("sin resultados no vuelve a consultar", async () => {
    db.$queryRaw.mockResolvedValue([]);
    await expect(listShopProducts({ query: parseSearchQuery("zzz") })).resolves.toEqual([]);
    expect(db.product.findMany).not.toHaveBeenCalled();
  });

  it("sin texto lista lo más reciente (y no usa SQL crudo)", async () => {
    db.product.findMany.mockResolvedValue([row(A, "Maceta de barro")]);

    await listShopProducts({ query: parseSearchQuery("   "), categorySlug: "hogar" });

    expect(db.$queryRaw).not.toHaveBeenCalled();
    const query = db.product.findMany.mock.calls[0]![0] as { where: Record<string, unknown> };
    expect(query.where).toMatchObject({
      status: "ACTIVE",
      OR: [{ category: { slug: "hogar" } }, { category: { parent: { slug: "hogar" } } }],
    });
  });
});
