import { describe, expect, it } from "vitest";
import { type FeedPostRow, productAvailability, toFeedItem } from "./dto";

const media = (
  storageKey: string,
  credit: Partial<FeedPostRow["media"][number]["media"]> = {},
) => ({
  media: {
    storageKey,
    width: 800,
    height: 1000,
    blurDataUrl: null,
    altText: null,
    creditName: null,
    creditUrl: null,
    license: null,
    ...credit,
  },
});

const row: FeedPostRow = {
  id: "0199a000-0000-7000-8000-000000000001",
  type: "PRODUCT",
  body: "AirPods Pro 2 nuevos.",
  publishedAt: new Date("2026-09-25T12:00:00Z"),
  isAiGenerated: true,
  likeCount: 3,
  commentCount: 0,
  saveCount: 1,
  author: {
    id: "0199a000-0000-7000-8000-000000000002",
    profile: {
      username: "demo.electro",
      displayName: "Electro Demo CDMX",
      avatarUrl: null,
      isEditorial: false,
    },
    sellerProfile: { status: "ACTIVE" },
  },
  community: { slug: "tecnologia", name: "Tecnología", emoji: "💻", hue: 235 },
  media: [media("post/copia.webp")],
  product: {
    slug: "airpods-pro-2-demo",
    title: "AirPods Pro 2",
    priceCents: 349_900,
    currency: "MXN",
    stock: 50,
    status: "ACTIVE",
    city: "Ciudad de México",
    state: "CDMX",
    pickupAvailable: true,
    localDeliveryAvailable: true,
    localDeliveryZones: ["Coyoacán"],
    nationalShippingAvailable: true,
    shippingPriceCents: 9_900,
    deliveryMinDays: 2,
    deliveryMaxDays: 5,
    warrantyType: "SELLER",
    warrantyDays: 90,
    returnWindowDays: 7,
    authenticity: "DECLARED_ORIGINAL",
    category: { name: "Audio y audífonos" },
    seller: { acceptedPaymentMethods: ["CARD"] },
    media: [media("product/1.webp")],
  },
  likes: [{ userId: "yo" }],
  saves: [],
};

const publicUrl = (key: string) => `/media/${key}`;

describe("toFeedItem (el costo nunca llega al navegador)", () => {
  it("no incluye el costo ni datos internos aunque la fila de la base de datos los traiga", () => {
    const leakyRow = {
      ...row,
      authorId: "interno",
      product: {
        ...row.product!,
        id: "producto-interno",
        sellerId: "vendedor-interno",
        cost: { unitCostCents: 240_000 },
        unitCostCents: 240_000,
        compareAtPriceCents: 399_900,
        seller: { ...row.product!.seller, userId: "interno", status: "ACTIVE" },
      },
    } as FeedPostRow;

    const serialized = JSON.stringify(toFeedItem(leakyRow, publicUrl));

    expect(serialized).not.toMatch(/cost/i);
    expect(serialized).not.toContain("240000");
    expect(serialized).not.toContain("interno");
    expect(serialized).not.toContain("399900");
  });

  it("expone los datos verificables (P4), la categoría y la disponibilidad", () => {
    const dto = toFeedItem(row, publicUrl)!;

    expect(dto.product).toMatchObject({
      priceCents: 349_900,
      availability: "available",
      inStock: true,
      categoryName: "Audio y audífonos",
      facts: { shippingPriceCents: 9_900, returnWindowDays: 7, warrantyDays: 90 },
    });
    expect(dto.author.isSeller).toBe(true);
    expect(dto.viewer).toEqual({ liked: true, saved: false, withinBudget: false });
    // Una venta muestra las fotos actuales del producto, no la copia de la publicación.
    expect(dto.media.map((item) => item.url)).toEqual(["/media/product/1.webp"]);
  });

  it("incluye el crédito de la foto y descarta enlaces que no son web", () => {
    const withCredit = toFeedItem(
      {
        ...row,
        type: "POST",
        product: null,
        media: [
          media("a.webp", {
            creditName: " Ana Pérez ",
            creditUrl: "https://unsplash.com/@ana",
            license: "Unsplash",
          }),
          media("b.webp", { creditName: "Beto", creditUrl: "javascript:alert(1)" }),
          media("c.webp"),
        ],
      },
      publicUrl,
    )!;

    expect(withCredit.media.map((item) => item.credit)).toEqual([
      { name: "Ana Pérez", url: "https://unsplash.com/@ana", license: "Unsplash" },
      { name: "Beto", url: null, license: null },
      null,
    ]);
  });

  it("sin perfil del autor no hay publicación que mostrar", () => {
    expect(toFeedItem({ ...row, author: { ...row.author, profile: null } }, publicUrl)).toBeNull();
  });
});

describe("productAvailability", () => {
  it("distingue pausado de agotado", () => {
    expect(productAvailability("ACTIVE", 3)).toBe("available");
    expect(productAvailability("ACTIVE", 0)).toBe("sold_out");
    expect(productAvailability("SOLD_OUT", 0)).toBe("sold_out");
    expect(productAvailability("PAUSED", 5)).toBe("paused");
    expect(productAvailability("ARCHIVED", 5)).toBe("unavailable");
    expect(productAvailability("DRAFT", 5)).toBe("unavailable");
  });
});
