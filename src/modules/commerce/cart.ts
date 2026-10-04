import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import type { PaymentMethod } from "@/generated/prisma/enums";
import { VISIBLE_PRODUCT } from "@/modules/trust/visibility";
import { db } from "@/server/db";
import { getStorage } from "@/server/providers/storage";

export class CartError extends Error {
  override name = "CartError";
  constructor(readonly code: "NOT_AVAILABLE" | "OWN_PRODUCT" | "NOT_ENOUGH_STOCK") {
    super(code);
  }
}

export const MAX_QUANTITY_PER_ITEM = 10;

/**
 * Agrega (o suma) un producto al carrito respetando el stock disponible. Un producto oculto por
 * moderación se rechaza igual que uno que ya no está a la venta («Este producto ya no está
 * disponible»): no se revela que el equipo lo ocultó.
 */
export async function addToCart(
  userId: string,
  productId: string,
  quantity: number,
  sourcePostId: string | null,
) {
  const product = await db.product.findUnique({
    where: { id: productId },
    select: {
      status: true,
      stock: true,
      moderationStatus: true,
      seller: { select: { userId: true, status: true } },
    },
  });
  // Un vendedor suspendido no vende (SEC-24); lo oculto por moderación tampoco (P14).
  if (
    !product ||
    product.status !== "ACTIVE" ||
    product.stock <= 0 ||
    product.moderationStatus !== "VISIBLE" ||
    product.seller.status !== "ACTIVE"
  ) {
    throw new CartError("NOT_AVAILABLE");
  }
  if (product.seller.userId === userId) throw new CartError("OWN_PRODUCT");

  const cart = await db.cart.upsert({
    where: { userId },
    create: { userId },
    update: {},
    select: { id: true },
  });
  const existing = await db.cartItem.findUnique({
    where: { cartId_productId: { cartId: cart.id, productId } },
    select: { quantity: true },
  });
  const desired = Math.min((existing?.quantity ?? 0) + quantity, MAX_QUANTITY_PER_ITEM);
  if (desired > product.stock) throw new CartError("NOT_ENOUGH_STOCK");

  await db.cartItem.upsert({
    where: { cartId_productId: { cartId: cart.id, productId } },
    create: { cartId: cart.id, productId, quantity: desired, sourcePostId },
    update: { quantity: desired, ...(sourcePostId ? { sourcePostId } : {}) },
  });
  return cartCount(userId);
}

/** Piezas en el carrito (el número de la navegación). Sin las de productos ocultos por moderación. */
export async function cartCount(userId: string) {
  const result = await db.cartItem.aggregate({
    where: { cart: { userId }, product: VISIBLE_PRODUCT },
    _sum: { quantity: true },
  });
  return result._sum.quantity ?? 0;
}

export async function setCartItemQuantity(userId: string, itemId: string, quantity: number) {
  if (quantity <= 0) {
    await db.cartItem.deleteMany({ where: { id: itemId, cart: { userId } } });
    return;
  }
  await db.cartItem.updateMany({
    where: { id: itemId, cart: { userId } },
    data: { quantity: Math.min(quantity, MAX_QUANTITY_PER_ITEM) },
  });
}

export type CartLine = {
  itemId: string;
  quantity: number;
  sourcePostId: string | null;
  requestedSize?: string | null;
  giftRecipientName?: string | null;
  product: {
    id: string;
    slug: string;
    title: string;
    priceCents: number;
    currency: string;
    stock: number;
    /** A la venta: publicado y de un vendedor activo (SEC-24). */
    forSale: boolean;
    /** A la venta y con piezas suficientes para esta línea. */
    available: boolean;
    imageUrl: string | null;
    pickupAvailable: boolean;
    localDeliveryAvailable: boolean;
    localDeliveryZones: string[];
    nationalShippingAvailable: boolean;
    shippingPriceCents: number | null;
  };
  seller: { id: string; displayName: string; paymentMethods: PaymentMethod[] };
};

/** Aviso del carrito cuando se quitaron productos que el equipo ocultó. */
export function unavailableCartNotice(count: number): string | null {
  if (count <= 0) return null;
  return count === 1
    ? "Un producto ya no está disponible"
    : `${count} productos ya no están disponibles`;
}

/**
 * Líneas del carrito cuyo producto ocultó el equipo (P14) y que siguen en la base: `getCartLines` las
 * omite y solo `listCartRemovingHidden` (/carrito) las borra.
 */
export function countHiddenCartLines(userId: string) {
  return db.cartItem.count({
    where: { cart: { userId }, product: { moderationStatus: "HIDDEN" } },
  });
}

/** Lo que muestra /carrito: sus líneas y cuántas se quitaron al listarlas. */
export type CartListing = {
  lines: CartLine[];
  /** Líneas que ESTA llamada borró porque el equipo ocultó su producto (para avisar una sola vez). */
  removedHidden: number;
};

/**
 * Carrito de /carrito: borra las líneas cuyo producto ocultó el equipo (P14) y lee las demás en la
 * misma transacción. El aviso sale una sola vez porque la siguiente carga ya no encuentra esas líneas;
 * con dos cargas a la vez, el segundo DELETE espera al primero y ya no las ve (READ COMMITTED), así
 * que tampoco se cuentan dos veces. Una vez borrada, la línea no regresa si el equipo restaura el
 * producto. Mientras nadie abra /carrito, la fila sigue en la base y `getCartLines` (checkout) solo la
 * omite.
 */
export async function listCartRemovingHidden(userId: string): Promise<CartListing> {
  return db.$transaction(async (tx) => {
    const removed = await tx.cartItem.deleteMany({
      where: { cart: { userId }, product: { moderationStatus: "HIDDEN" } },
    });
    const lines = await readCartLines(tx, userId);
    return { lines, removedHidden: removed.count };
  });
}

/**
 * Carrito con datos públicos del producto (sin costos). Omite los productos ocultos por moderación:
 * ni el carrito, ni la revisión del pedido, ni `placeOrder` (que arma el pedido con estas líneas) los
 * ven. Aquí no se borra nada: si el equipo lo restaura antes de que la persona abra /carrito
 * (`listCartRemovingHidden`), vuelve a aparecer.
 */
export function getCartLines(userId: string): Promise<CartLine[]> {
  return readCartLines(db, userId);
}

async function readCartLines(
  client: Prisma.TransactionClient | typeof db,
  userId: string,
): Promise<CartLine[]> {
  const items = await client.cartItem.findMany({
    where: { cart: { userId }, product: VISIBLE_PRODUCT },
    orderBy: { addedAt: "asc" },
    select: {
      id: true,
      quantity: true,
      sourcePostId: true,
      requestedSize: true,
      giftRecipientName: true,
      product: {
        select: {
          id: true,
          slug: true,
          title: true,
          priceCents: true,
          currency: true,
          stock: true,
          status: true,
          pickupAvailable: true,
          localDeliveryAvailable: true,
          localDeliveryZones: true,
          nationalShippingAvailable: true,
          shippingPriceCents: true,
          media: {
            orderBy: { position: "asc" },
            take: 1,
            select: { media: { select: { storageKey: true } } },
          },
          seller: {
            select: { id: true, displayName: true, acceptedPaymentMethods: true, status: true },
          },
        },
      },
    },
  });
  const storage = getStorage();
  return items.map(({ product, ...item }) => {
    const cover = product.media[0]?.media.storageKey;
    const forSale = product.status === "ACTIVE" && product.seller.status === "ACTIVE";
    return {
      itemId: item.id,
      quantity: item.quantity,
      sourcePostId: item.sourcePostId,
      requestedSize: item.requestedSize,
      giftRecipientName: item.giftRecipientName,
      product: {
        id: product.id,
        slug: product.slug,
        title: product.title,
        priceCents: product.priceCents,
        currency: product.currency,
        stock: product.stock,
        forSale,
        available: forSale && product.stock >= item.quantity,
        imageUrl: cover ? storage.publicUrl(cover) : null,
        pickupAvailable: product.pickupAvailable,
        localDeliveryAvailable: product.localDeliveryAvailable,
        localDeliveryZones: product.localDeliveryZones,
        nationalShippingAvailable: product.nationalShippingAvailable,
        shippingPriceCents: product.shippingPriceCents,
      },
      seller: {
        id: product.seller.id,
        displayName: product.seller.displayName,
        paymentMethods: product.seller.acceptedPaymentMethods,
      },
    };
  });
}

/** Agrupa las líneas por vendedor (una orden por vendedor). */
export function groupBySeller(lines: CartLine[]) {
  const groups = new Map<string, { seller: CartLine["seller"]; lines: CartLine[] }>();
  for (const line of lines) {
    const group = groups.get(line.seller.id) ?? { seller: line.seller, lines: [] };
    group.lines.push(line);
    groups.set(line.seller.id, group);
  }
  return [...groups.values()];
}
