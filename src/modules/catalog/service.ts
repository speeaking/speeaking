import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { isProofMediaLinkError, proofMediaIdsAmong } from "@/modules/trust/proof-media";
import { evaluateProductAuthenticity } from "@/modules/trust/service";
import { db } from "@/server/db";
import type { ProductFormInput } from "./schemas";
import { statusAfterEdit, statusAfterToggle, type ToggleTarget } from "./status";

export class ProductEditError extends Error {
  override name = "ProductEditError";
  constructor(
    readonly code:
      "NOT_FOUND" | "INVALID_MEDIA" | "INVALID_CATEGORY" | "NOT_TOGGLEABLE" | "STOCK_CHANGED",
    /** Piezas disponibles en este momento (con `STOCK_CHANGED`), para mostrárselas al vendedor. */
    readonly currentStock?: number,
  ) {
    super(code);
  }
}

/**
 * Bloquea la fila del producto dentro de la transacción y, en la misma sentencia, comprueba que
 * sea de quien lo edita (nunca se confía en el ID que manda el navegador). Mientras dure la
 * transacción, el checkout espera: el inventario y el estado que leemos después son los vigentes.
 */
async function lockOwnedProduct(
  tx: Prisma.TransactionClient,
  sellerUserId: string,
  productId: string,
  data: Prisma.ProductUncheckedUpdateManyInput,
) {
  const locked = await tx.product.updateMany({
    where: { id: productId, seller: { userId: sellerUserId } },
    data,
  });
  if (locked.count === 0) throw new ProductEditError("NOT_FOUND");
  return tx.product.findUniqueOrThrow({
    where: { id: productId },
    select: { slug: true, status: true, stock: true },
  });
}

/**
 * Edita un producto propio: datos, costo privado y fotos, en una transacción. El slug no cambia
 * (los enlaces compartidos siguen funcionando).
 *
 * Inventario: es el número absoluto de piezas disponibles que declara el vendedor. Si no lo tocó
 * (`stockShown` = lo que vio al abrir el formulario) no se escribe, para no deshacer las ventas
 * hechas mientras editaba. Si lo cambió y mientras tanto también cambió en la base (una compra o
 * un apartado que venció), no se adivina cuál vale: `STOCK_CHANGED` con el número real.
 */
export async function updateProduct(
  sellerUserId: string,
  productId: string,
  input: ProductFormInput,
  { stockShown }: { stockShown?: number } = {},
) {
  const owned = await db.product.findFirst({
    where: { id: productId, seller: { userId: sellerUserId } },
    select: { id: true, title: true, tags: true, categoryId: true, condition: true },
  });
  if (!owned) throw new ProductEditError("NOT_FOUND");
  // ¿Cambió QUÉ se vende? Un «Comprobante revisado» vale para el artículo revisado: si cambia, la
  // revisión de autenticidad no lo hereda (P14, `trust/status.ts`).
  const tags = input.tags.map((tag) => tag.toLowerCase());
  const listingChanged =
    owned.title.trim() !== input.title.trim() ||
    owned.categoryId !== input.categoryId ||
    owned.condition !== input.condition ||
    [...owned.tags].sort().join("\n") !== [...tags].sort().join("\n");

  // Fotos listas y propias, o que ya eran de este producto; sin repetir.
  const [category, media] = await Promise.all([
    db.category.findUnique({ where: { id: input.categoryId }, select: { id: true } }),
    db.media.findMany({
      where: {
        id: { in: input.mediaIds },
        status: "READY",
        OR: [{ ownerId: sellerUserId }, { productLinks: { some: { productId } } }],
      },
      select: { id: true },
    }),
  ]);
  if (!category) throw new ProductEditError("INVALID_CATEGORY");
  if (media.length !== input.mediaIds.length) throw new ProductEditError("INVALID_MEDIA");
  // Una foto de comprobante de autenticidad (vigente o reemplazada) nunca se adjunta (P14), aunque ya
  // estuviera en este producto desde antes de la regla: el vendedor la quita y guarda.
  if ((await proofMediaIdsAmong(db, input.mediaIds)).size > 0) {
    throw new ProductEditError("INVALID_MEDIA");
  }

  const stockEdited = stockShown === undefined || stockShown !== input.stock;

  const result = await db.$transaction(async (tx) => {
    const product = await lockOwnedProduct(tx, sellerUserId, productId, {
      title: input.title,
      description: input.description,
      priceCents: input.priceCents,
      categoryId: input.categoryId,
      condition: input.condition,
      tags,
      city: input.city,
      state: input.state,
      pickupAvailable: input.pickupAvailable,
      localDeliveryAvailable: input.localDeliveryAvailable,
      localDeliveryZones: input.localDeliveryZones,
      nationalShippingAvailable: input.nationalShippingAvailable,
      shippingPriceCents: input.shippingPriceCents,
      deliveryMinDays: input.deliveryMinDays,
      deliveryMaxDays: input.deliveryMaxDays,
      warrantyType: input.warrantyType,
      warrantyDays: input.warrantyDays,
      returnWindowDays: input.returnWindowDays,
      authenticity: input.authenticity,
    });

    // Con la fila bloqueada, `product.stock` es el vigente. Escribir encima un número pensado sobre
    // uno viejo vendería piezas que ya no existen (o escondería las que regresaron).
    const concurrentChange =
      stockShown !== undefined && product.stock !== stockShown && product.stock !== input.stock;
    if (stockEdited && concurrentChange) {
      throw new ProductEditError("STOCK_CHANGED", product.stock);
    }
    const stock = stockEdited ? input.stock : product.stock;
    const status = statusAfterEdit(product.status, stock);
    if (stock !== product.stock || status !== product.status) {
      await tx.product.update({ where: { id: productId }, data: { stock, status } });
    }

    // Cambió QUÉ se vende: el «Comprobante revisado» se quita aquí, en la misma transacción (falla
    // cerrada). La revisión de después (`evaluateProductAuthenticity`) decide el estado nuevo, pero
    // nunca hace fallar la edición: si fallara (o mientras corre), la ficha ya no presume una revisión
    // hecha para otro artículo. AUTO_CLEAR da el mismo resultado al reevaluar que VERIFIED_BY_ADMIN con
    // `listingChanged` (`trust/status.ts`: riesgo alto → se pide comprobante; si no, AUTO_CLEAR), y
    // mientras tanto quien compra ve lo que declara el vendedor, no un sello.
    if (listingChanged) {
      await tx.authenticityCheck.updateMany({
        where: { productId, status: "VERIFIED_BY_ADMIN" },
        data: { status: "AUTO_CLEAR" },
      });
    }

    await tx.productCost.upsert({
      where: { productId },
      create: { productId, unitCostCents: input.unitCostCents },
      update: { unitCostCents: input.unitCostCents },
    });

    // Las fotos se reemplazan en el orden recibido (la primera es la portada). Las filas de
    // `Media` se conservan: las publicaciones del feed pueden seguir usándolas.
    await tx.productMedia.deleteMany({ where: { productId } });
    try {
      await tx.productMedia.createMany({
        data: input.mediaIds.map((mediaId, position) => ({ productId, mediaId, position })),
      });
    } catch (error) {
      // Se guardó como comprobante entre la validación y este INSERT: el trigger
      // `reject_proof_media_link` lo rechaza y la transacción se deshace.
      if (isProofMediaLinkError(error)) throw new ProductEditError("INVALID_MEDIA");
      throw error;
    }

    return { slug: product.slug, status };
  });

  // Revisión de autenticidad con los datos ya guardados (P14). Va después de la transacción para no
  // alargar el candado de la fila que espera el checkout, y nunca hace fallar la edición.
  await evaluateProductAuthenticity(productId, undefined, { listingChanged });
  return result;
}

/** Pausa o reactiva un producto propio. Reactivar sin piezas lo deja agotado. */
export async function setProductStatus(
  sellerUserId: string,
  productId: string,
  target: ToggleTarget,
) {
  return db.$transaction(async (tx) => {
    const product = await lockOwnedProduct(tx, sellerUserId, productId, {
      updatedAt: new Date(),
    });
    const status = statusAfterToggle(product.status, target, product.stock);
    if (!status) throw new ProductEditError("NOT_TOGGLEABLE");
    if (status !== product.status) {
      await tx.product.update({ where: { id: productId }, data: { status } });
    }
    return { slug: product.slug, status };
  });
}
