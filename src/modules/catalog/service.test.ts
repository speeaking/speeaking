import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ProductFormInput } from "./schemas";
import { ProductEditError, setProductStatus, updateProduct } from "./service";

// Base de datos simulada: aquí se prueban las reglas (propiedad, inventario, orden), no Prisma.
const { db, tx } = vi.hoisted(() => {
  const tx = {
    product: { updateMany: vi.fn(), findUniqueOrThrow: vi.fn(), update: vi.fn() },
    productCost: { upsert: vi.fn() },
    productMedia: { deleteMany: vi.fn(), createMany: vi.fn() },
    authenticityCheck: { updateMany: vi.fn() },
  };
  const db = {
    product: { findFirst: vi.fn() },
    category: { findUnique: vi.fn() },
    media: { findMany: vi.fn() },
    // Fotos de comprobante de autenticidad (P14): vigentes y reemplazadas.
    authenticityCheck: { findMany: vi.fn() },
    authenticityProofHistory: { findMany: vi.fn() },
    $transaction: vi.fn((run: (client: typeof tx) => unknown) => run(tx)),
  };
  return { db, tx };
});
vi.mock("@/server/db", () => ({ db }));
// Revisión de autenticidad (P14): se prueba en src/modules/trust; aquí, que se llame al guardar.
const trust = vi.hoisted(() => ({ evaluateProductAuthenticity: vi.fn() }));
vi.mock("@/modules/trust/service", () => trust);

const SELLER = "0199a000-0000-7000-8000-00000000000a";
const PRODUCT = "0199a000-0000-7000-8000-00000000000b";
const MEDIA = ["0199a000-0000-7000-8000-0000000000c1", "0199a000-0000-7000-8000-0000000000c2"];

const input: ProductFormInput = {
  title: "AirPods Pro 2",
  description: "Audífonos con cancelación de ruido, nuevos y sellados.",
  priceCents: 329_900,
  unitCostCents: 240_000,
  stock: 5,
  categoryId: "0199a000-0000-7000-8000-00000000000d",
  condition: "NEW",
  tags: ["Apple"],
  city: "Ciudad de México",
  state: "CDMX",
  pickupAvailable: true,
  localDeliveryAvailable: false,
  localDeliveryZones: [],
  nationalShippingAvailable: true,
  shippingPriceCents: 9_900,
  deliveryMinDays: 2,
  deliveryMaxDays: 5,
  warrantyType: "SELLER",
  warrantyDays: 90,
  returnWindowDays: 7,
  authenticity: "DECLARED_ORIGINAL",
  mediaIds: [MEDIA[1]!, MEDIA[0]!],
  publishToFeed: false,
  communitySlug: undefined,
  postBody: undefined,
};

/** Lo que tenía el producto antes de editar (lo mismo que `input`: no cambió qué se vende). */
const before = {
  id: PRODUCT,
  title: input.title,
  tags: ["apple"],
  categoryId: input.categoryId,
  condition: input.condition,
};

function ownedProduct(
  locked: { status: string; stock: number },
  previous: Partial<typeof before> = {},
) {
  db.product.findFirst.mockResolvedValue({ ...before, ...previous });
  db.category.findUnique.mockResolvedValue({ id: input.categoryId });
  db.media.findMany.mockResolvedValue(MEDIA.map((id) => ({ id })));
  tx.product.updateMany.mockResolvedValue({ count: 1 });
  tx.product.findUniqueOrThrow.mockResolvedValue({ slug: "airpods-pro-2-abc123", ...locked });
}

beforeEach(() => {
  vi.clearAllMocks();
  db.authenticityCheck.findMany.mockResolvedValue([]);
  db.authenticityProofHistory.findMany.mockResolvedValue([]);
});

describe("updateProduct", () => {
  it("no toca productos de otra persona: la propiedad se comprueba en la consulta", async () => {
    db.product.findFirst.mockResolvedValue(null);

    await expect(updateProduct(SELLER, PRODUCT, input)).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    expect(db.product.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: PRODUCT, seller: { userId: SELLER } } }),
    );
    expect(db.$transaction).not.toHaveBeenCalled();
  });

  it("solo acepta fotos listas, propias o que ya eran del producto, sin repetir", async () => {
    ownedProduct({ status: "ACTIVE", stock: 5 });
    db.media.findMany.mockResolvedValue([{ id: MEDIA[0] }]);

    await expect(
      updateProduct(SELLER, PRODUCT, { ...input, mediaIds: [MEDIA[0]!, MEDIA[0]!] }),
    ).rejects.toBeInstanceOf(ProductEditError);
    expect(db.media.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: { in: [MEDIA[0], MEDIA[0]] },
          status: "READY",
          kind: "IMAGE",
          OR: [{ ownerId: SELLER }, { productLinks: { some: { productId: PRODUCT } } }],
        },
      }),
    );
    expect(db.$transaction).not.toHaveBeenCalled();
  });

  it("nunca adjunta una foto de comprobante, vigente o reemplazada (P14)", async () => {
    ownedProduct({ status: "ACTIVE", stock: 5 });
    db.authenticityCheck.findMany.mockResolvedValueOnce([{ proofMediaIds: [MEDIA[0]] }]);
    await expect(updateProduct(SELLER, PRODUCT, input)).rejects.toMatchObject({
      code: "INVALID_MEDIA",
    });
    expect(db.authenticityCheck.findMany).toHaveBeenCalledWith({
      where: { proofMediaIds: { hasSome: [MEDIA[1], MEDIA[0]] } },
      select: { proofMediaIds: true },
    });

    db.authenticityProofHistory.findMany.mockResolvedValueOnce([{ mediaId: MEDIA[1] }]);
    await expect(updateProduct(SELLER, PRODUCT, input)).rejects.toMatchObject({
      code: "INVALID_MEDIA",
    });
    expect(db.$transaction).not.toHaveBeenCalled();
    expect(trust.evaluateProductAuthenticity).not.toHaveBeenCalled();
  });

  it("si el trigger rechaza el adjunto (carrera con el comprobante), es una foto inválida", async () => {
    ownedProduct({ status: "ACTIVE", stock: 5 });
    const { Prisma } = await import("@/generated/prisma/client");
    tx.productMedia.createMany.mockRejectedValueOnce(
      new Prisma.PrismaClientKnownRequestError(
        "Database error. Code: `23514`. Message: `proof_media_link: la foto es un comprobante`",
        { code: "P2039", clientVersion: "test" },
      ),
    );

    await expect(updateProduct(SELLER, PRODUCT, input)).rejects.toMatchObject({
      code: "INVALID_MEDIA",
    });
    expect(trust.evaluateProductAuthenticity).not.toHaveBeenCalled();
  });

  it("guarda datos, costo privado y fotos en el orden recibido; el slug no cambia", async () => {
    ownedProduct({ status: "ACTIVE", stock: 5 });

    await expect(updateProduct(SELLER, PRODUCT, input)).resolves.toEqual({
      slug: "airpods-pro-2-abc123",
      status: "ACTIVE",
    });

    const [update] = tx.product.updateMany.mock.calls[0]!;
    expect(update.where).toEqual({ id: PRODUCT, seller: { userId: SELLER } });
    expect(update.data).toMatchObject({ title: input.title, priceCents: 329_900, tags: ["apple"] });
    expect(update.data).not.toHaveProperty("slug");
    expect(tx.productCost.upsert).toHaveBeenCalledWith({
      where: { productId: PRODUCT },
      create: { productId: PRODUCT, unitCostCents: 240_000 },
      update: { unitCostCents: 240_000 },
    });
    expect(tx.productMedia.createMany).toHaveBeenCalledWith({
      data: [
        { productId: PRODUCT, mediaId: MEDIA[1], position: 0 },
        { productId: PRODUCT, mediaId: MEDIA[0], position: 1 },
      ],
    });
  });

  it("si el inventario no cambió no lo escribe (no deshace ventas hechas mientras editaba)", async () => {
    // Se mostraron 5 y el vendedor dejó 5; mientras tanto se vendieron 2.
    ownedProduct({ status: "ACTIVE", stock: 3 });

    await updateProduct(SELLER, PRODUCT, input, { stockShown: 5 });

    expect(tx.product.updateMany.mock.calls[0]![0].data).not.toHaveProperty("stock");
    expect(tx.product.update).not.toHaveBeenCalled();
  });

  it("si el vendedor cambió el inventario y también cambió mientras editaba, no guarda nada", async () => {
    // Vio 5 y escribió 6 (llegó una pieza), pero mientras tanto se vendieron 2: escribir 6
    // vendería dos piezas que ya no tiene.
    ownedProduct({ status: "ACTIVE", stock: 3 });

    await expect(
      updateProduct(SELLER, PRODUCT, { ...input, stock: 6 }, { stockShown: 5 }),
    ).rejects.toMatchObject({ code: "STOCK_CHANGED", currentStock: 3 });
    // El error sale dentro de la transacción: se revierte lo ya escrito y no se sigue.
    expect(tx.product.update).not.toHaveBeenCalled();
    expect(tx.productCost.upsert).not.toHaveBeenCalled();
    expect(tx.productMedia.deleteMany).not.toHaveBeenCalled();
  });

  it("con el inventario vigente como referencia, el cambio se guarda", async () => {
    ownedProduct({ status: "ACTIVE", stock: 3 });

    // Reintento tras el aviso: ahora compara contra las 3 piezas reales.
    await updateProduct(SELLER, PRODUCT, { ...input, stock: 4 }, { stockShown: 3 });
    expect(tx.product.update).toHaveBeenCalledWith({
      where: { id: PRODUCT },
      data: { stock: 4, status: "ACTIVE" },
    });

    // Si lo que escribió ya es lo vigente, no hay conflicto que resolver.
    vi.clearAllMocks();
    ownedProduct({ status: "ACTIVE", stock: 3 });
    await expect(
      updateProduct(SELLER, PRODUCT, { ...input, stock: 3 }, { stockShown: 5 }),
    ).resolves.toMatchObject({ status: "ACTIVE" });
    expect(tx.product.update).not.toHaveBeenCalled();
  });

  it("inventario en 0 lo agota; agotado con piezas nuevas vuelve a estar activo", async () => {
    ownedProduct({ status: "ACTIVE", stock: 5 });
    await updateProduct(SELLER, PRODUCT, { ...input, stock: 0 }, { stockShown: 5 });
    expect(tx.product.update).toHaveBeenCalledWith({
      where: { id: PRODUCT },
      data: { stock: 0, status: "SOLD_OUT" },
    });

    vi.clearAllMocks();
    ownedProduct({ status: "SOLD_OUT", stock: 0 });
    await updateProduct(SELLER, PRODUCT, { ...input, stock: 4 }, { stockShown: 0 });
    expect(tx.product.update).toHaveBeenCalledWith({
      where: { id: PRODUCT },
      data: { stock: 4, status: "ACTIVE" },
    });
  });

  it("revisa la autenticidad con los datos ya guardados, después de la transacción (P14)", async () => {
    ownedProduct({ status: "ACTIVE", stock: 5 });
    const order: string[] = [];
    db.$transaction.mockImplementationOnce(async (run: (client: typeof tx) => unknown) => {
      const result = await run(tx);
      order.push("transacción");
      return result;
    });
    trust.evaluateProductAuthenticity.mockImplementationOnce(() => {
      order.push("revisión");
      return Promise.resolve(null);
    });

    await updateProduct(SELLER, PRODUCT, input, { stockShown: 5 });
    expect(trust.evaluateProductAuthenticity).toHaveBeenCalledWith(PRODUCT, undefined, {
      listingChanged: false,
    });
    expect(order).toEqual(["transacción", "revisión"]);
  });

  it("si cambia qué se vende (título, etiquetas, categoría o condición), la revisión lo sabe", async () => {
    for (const previous of [
      { title: "AirPods 3" },
      { tags: ["apple", "pro"] },
      { categoryId: "0199a000-0000-7000-8000-0000000000ff" },
      { condition: "USED_GOOD" as const },
    ]) {
      vi.clearAllMocks();
      ownedProduct({ status: "ACTIVE", stock: 5 }, previous);
      await updateProduct(SELLER, PRODUCT, input, { stockShown: 5 });
      expect(trust.evaluateProductAuthenticity).toHaveBeenCalledWith(PRODUCT, undefined, {
        listingChanged: true,
      });
      // Falla cerrada: el sello se quita en la transacción de la edición, antes de reevaluar.
      expect(tx.authenticityCheck.updateMany).toHaveBeenCalledWith({
        where: { productId: PRODUCT, status: "VERIFIED_BY_ADMIN" },
        data: { status: "AUTO_CLEAR" },
      });
    }
    // El precio o la descripción no cambian el artículo (si suben el riesgo, lo decide la regla).
    vi.clearAllMocks();
    ownedProduct({ status: "ACTIVE", stock: 5 });
    await updateProduct(
      SELLER,
      PRODUCT,
      { ...input, priceCents: 1_000, description: "Otra descripción del mismo artículo." },
      { stockShown: 5 },
    );
    expect(trust.evaluateProductAuthenticity).toHaveBeenCalledWith(PRODUCT, undefined, {
      listingChanged: false,
    });
    expect(tx.authenticityCheck.updateMany).not.toHaveBeenCalled();
  });

  it("si la revisión de después falla, el «Comprobante revisado» ya no sigue en otro artículo", async () => {
    ownedProduct({ status: "ACTIVE", stock: 5 }, { title: "AirPods 3" });
    // `evaluateProductAuthenticity` nunca lanza: si algo falla, devuelve null y la edición sigue.
    trust.evaluateProductAuthenticity.mockResolvedValueOnce(null);

    await expect(updateProduct(SELLER, PRODUCT, input, { stockShown: 5 })).resolves.toMatchObject({
      status: "ACTIVE",
    });
    expect(tx.authenticityCheck.updateMany).toHaveBeenCalledTimes(1);
  });

  it("si la edición falla, no se revisa nada", async () => {
    db.product.findFirst.mockResolvedValue(null);
    await expect(updateProduct(SELLER, PRODUCT, input)).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    expect(trust.evaluateProductAuthenticity).not.toHaveBeenCalled();
  });

  it("un pausado sigue pausado aunque le agreguen piezas", async () => {
    ownedProduct({ status: "PAUSED", stock: 0 });
    await expect(
      updateProduct(SELLER, PRODUCT, { ...input, stock: 2 }, { stockShown: 0 }),
    ).resolves.toMatchObject({ status: "PAUSED" });
    expect(tx.product.update).toHaveBeenCalledWith({
      where: { id: PRODUCT },
      data: { stock: 2, status: "PAUSED" },
    });
  });
});

describe("setProductStatus", () => {
  it("reactivar un pausado sin piezas lo deja agotado", async () => {
    tx.product.updateMany.mockResolvedValue({ count: 1 });
    tx.product.findUniqueOrThrow.mockResolvedValue({ slug: "x", status: "PAUSED", stock: 0 });

    await expect(setProductStatus(SELLER, PRODUCT, "ACTIVE")).resolves.toEqual({
      slug: "x",
      status: "SOLD_OUT",
    });
    expect(tx.product.updateMany.mock.calls[0]![0].where).toEqual({
      id: PRODUCT,
      seller: { userId: SELLER },
    });
  });

  it("no pausa productos ajenos ni borradores", async () => {
    tx.product.updateMany.mockResolvedValue({ count: 0 });
    await expect(setProductStatus(SELLER, PRODUCT, "PAUSED")).rejects.toMatchObject({
      code: "NOT_FOUND",
    });

    tx.product.updateMany.mockResolvedValue({ count: 1 });
    tx.product.findUniqueOrThrow.mockResolvedValue({ slug: "x", status: "DRAFT", stock: 3 });
    await expect(setProductStatus(SELLER, PRODUCT, "PAUSED")).rejects.toMatchObject({
      code: "NOT_TOGGLEABLE",
    });
    expect(tx.product.update).not.toHaveBeenCalled();
  });
});
