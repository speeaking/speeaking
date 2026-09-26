/**
 * Reglas del checkout como funciones puras (P2: montos en centavos, calculados por código).
 */
import type { DeliveryMethod, PaymentMethod } from "@/generated/prisma/enums";

export type DeliveryFacts = {
  pickupAvailable: boolean;
  localDeliveryAvailable: boolean;
  nationalShippingAvailable: boolean;
  shippingPriceCents: number | null;
};

const ORDERED_METHODS: DeliveryMethod[] = ["NATIONAL_SHIPPING", "LOCAL_DELIVERY", "PICKUP"];

/** Métodos de entrega que todos los productos de una orden (un vendedor) permiten. */
export function availableDeliveryMethods(items: DeliveryFacts[]): DeliveryMethod[] {
  return ORDERED_METHODS.filter((method) =>
    items.every((item) =>
      method === "NATIONAL_SHIPPING"
        ? item.nationalShippingAvailable && item.shippingPriceCents !== null
        : method === "LOCAL_DELIVERY"
          ? item.localDeliveryAvailable
          : item.pickupAvailable,
    ),
  );
}

/** Envío de una orden: un solo paquete por vendedor, se cobra la tarifa más alta. */
export function orderShippingCents(
  method: DeliveryMethod,
  items: { shippingPriceCents: number | null }[],
): number {
  if (method !== "NATIONAL_SHIPPING") return 0;
  return Math.max(0, ...items.map((item) => item.shippingPriceCents ?? 0));
}

export function computeOrderTotals({
  lines,
  shippingCents,
  platformFeeBps,
}: {
  lines: { unitPriceCents: number; quantity: number }[];
  shippingCents: number;
  platformFeeBps: number;
}) {
  const subtotalCents = lines.reduce((sum, line) => sum + line.unitPriceCents * line.quantity, 0);
  const platformFeeCents = Math.round((subtotalCents * platformFeeBps) / 10_000);
  return {
    subtotalCents,
    shippingCents,
    platformFeeCents,
    // La comisión se descuenta al vendedor: el comprador paga productos + envío.
    totalCents: subtotalCents + shippingCents,
  };
}

/**
 * Huella de lo que la persona revisó (producto, piezas, precio y envío). Si el carrito cambia
 * antes de confirmar —otra pestaña, un precio o envío nuevo, un pedido vencido que regresó al
 * carrito— no se cobra a ciegas.
 */
export function cartFingerprint(
  lines: {
    productId: string;
    quantity: number;
    unitPriceCents: number;
    shippingPriceCents: number | null;
  }[],
): string {
  return lines
    .map(
      (line) =>
        `${line.productId}:${line.quantity}:${line.unitPriceCents}:${line.shippingPriceCents ?? "-"}`,
    )
    .sort()
    .join(",");
}

type ReturnedItem = { productId: string; quantity: number; sourcePostId: string | null };

/**
 * Piezas de un pedido cancelado que regresan al carrito: se suman a las que ya estén ahí, con el
 * tope por producto, y conservan la publicación de origen (atribución, P5).
 */
export function restoredCartItems(
  items: ReturnedItem[],
  inCart: { productId: string; quantity: number }[],
  maxPerItem: number,
): ReturnedItem[] {
  const current = new Map(inCart.map((item) => [item.productId, item.quantity]));
  const merged = new Map<string, ReturnedItem>();
  for (const item of items) {
    const previous = merged.get(item.productId);
    const base = previous?.quantity ?? current.get(item.productId) ?? 0;
    merged.set(item.productId, {
      productId: item.productId,
      quantity: Math.min(base + item.quantity, maxPerItem),
      sourcePostId: item.sourcePostId ?? previous?.sourcePostId ?? null,
    });
  }
  return [...merged.values()];
}

/** Máximo de una columna `int4` de PostgreSQL: ningún monto guardado puede pasarlo (SEC-23). */
export const MAX_INT32 = 2_147_483_647;

export function fitsInInt32(value: number) {
  return Number.isSafeInteger(value) && value >= 0 && value <= MAX_INT32;
}

/**
 * ¿El pedido rebasa el tope de piezas apartadas sin pagar por producto (SEC-05)? Suma, por cada
 * producto que se quiere pedir, lo que la persona ya tiene en checkouts pendientes.
 */
export function exceedsReservationLimit(
  lines: { productId: string; quantity: number }[],
  reserved: { productId: string; quantity: number }[],
  maxPerProduct: number,
) {
  const units = new Map<string, number>();
  for (const line of lines) {
    units.set(line.productId, (units.get(line.productId) ?? 0) + line.quantity);
  }
  for (const item of reserved) {
    const current = units.get(item.productId);
    if (current !== undefined) units.set(item.productId, current + item.quantity);
  }
  return [...units.values()].some((total) => total > maxPerProduct);
}

/** Métodos de pago aceptados por todos los vendedores de un checkout. */
export function commonPaymentMethods(sellerMethods: PaymentMethod[][]): PaymentMethod[] {
  if (sellerMethods.length === 0) return [];
  const [first = [], ...rest] = sellerMethods;
  return first.filter((method) => rest.every((methods) => methods.includes(method)));
}

/** Beneficio del vendedor: ventas − costo − comisión − comisión estimada del procesador. */
export function sellerProfitCents({
  lines,
  platformFeeCents,
  paymentFeeBps,
}: {
  lines: { unitPriceCents: number; unitCostCents: number; quantity: number }[];
  platformFeeCents: number;
  paymentFeeBps: number;
}) {
  const revenue = lines.reduce((sum, line) => sum + line.unitPriceCents * line.quantity, 0);
  const cost = lines.reduce((sum, line) => sum + line.unitCostCents * line.quantity, 0);
  const paymentFee = Math.round((revenue * paymentFeeBps) / 10_000);
  return revenue - cost - platformFeeCents - paymentFee;
}
