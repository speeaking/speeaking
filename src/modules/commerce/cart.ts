import "server-only";
import type { PaymentMethod } from "@/generated/prisma/enums";
import { db } from "@/server/db";
import { getStorage } from "@/server/providers/storage";

export class CartError extends Error {
  override name = "CartError";
  constructor(readonly code: "NOT_AVAILABLE" | "OWN_PRODUCT" | "NOT_ENOUGH_STOCK") {
    super(code);
  }
}

export const MAX_QUANTITY_PER_ITEM = 10;

/** Agrega (o suma) un producto al carrito respetando el stock disponible. */
export async function addToCart(
  userId: string,
  productId: string,
  quantity: number,
  sourcePostId: string | null,
) {
  const product = await db.product.findUnique({
    where: { id: productId },
    select: { status: true, stock: true, seller: { select: { userId: true, status: true } } },
  });
  // Un vendedor suspendido no vende (SEC-24).
  if (
    !product ||
    product.status !== "ACTIVE" ||
    product.stock <= 0 ||
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

export async function cartCount(userId: string) {
  const result = await db.cartItem.aggregate({
    where: { cart: { userId } },
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

/** Carrito con datos públicos del producto (sin costos). */
export async function getCartLines(userId: string): Promise<CartLine[]> {
  const items = await db.cartItem.findMany({
    where: { cart: { userId } },
    orderBy: { addedAt: "asc" },
    select: {
      id: true,
      quantity: true,
      sourcePostId: true,
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
