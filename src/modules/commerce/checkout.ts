import "server-only";
import { Prisma } from "@/generated/prisma/client";
import type { DeliveryMethod, PaymentMethod } from "@/generated/prisma/enums";
import { track } from "@/modules/analytics/track";
import { notifyOrders } from "@/modules/notifications/notify";
import { getCommerceFees } from "@/modules/platform/settings";
import { db } from "@/server/db";
import {
  getPaymentProvider,
  isSimulatedPayment,
  type PaymentEventInput,
  type PaymentProvider,
  SIMULATED_PAYMENT_PROVIDER,
} from "@/server/providers/payments";
import type { AddressInput } from "./address-schema";
import { type CartLine, getCartLines, groupBySeller, MAX_QUANTITY_PER_ITEM } from "./cart";
import {
  availableDeliveryMethods,
  cartFingerprint,
  commonPaymentMethods,
  computeOrderTotals,
  exceedsReservationLimit,
  fitsInInt32,
  orderShippingCents,
  restoredCartItems,
} from "./checkout-math";
import { CHECKOUT_TTL_MINUTES, MAX_PENDING_CHECKOUTS_PER_BUYER } from "./fees";
import { sellerTransitionWhere } from "./order-transitions";

type Tx = Prisma.TransactionClient;

export type CheckoutErrorCode =
  | "EMPTY_CART"
  | "NOT_AVAILABLE"
  | "DELIVERY_NOT_ALLOWED"
  | "PAYMENT_NOT_ALLOWED"
  | "ADDRESS_REQUIRED"
  | "OUT_OF_STOCK"
  | "CART_CHANGED"
  | "TOO_MANY_PENDING"
  | "RESERVATION_LIMIT"
  | "TOTAL_TOO_LARGE"
  | "PAYMENT_UNAVAILABLE";

export class CheckoutError extends Error {
  override name = "CheckoutError";
  constructor(readonly code: CheckoutErrorCode) {
    super(code);
  }
}

type PlaceOrderInput = {
  /** `checkoutCartKey` de lo que la persona revisó en /checkout. */
  cartKey: string;
  delivery: Record<string, DeliveryMethod>;
  paymentMethod: PaymentMethod;
  addressId: string | null;
  newAddress: AddressInput | null;
};

/**
 * Crea el checkout: comprueba que el carrito sea el que la persona revisó, valida entrega y pago,
 * descuenta stock de forma atómica y condicionada (evita sobreventa), congela
 * precio/costo/comisión y crea una orden por vendedor. Después pide el pago al proveedor.
 * Devuelve adónde mandar a la persona para pagar.
 */
export async function placeOrder(userId: string, input: PlaceOrderInput) {
  // Sin proveedor permitido no se reserva nada (SEC-01).
  const provider = paymentProviderOrThrow();
  // Primero los vencidos de esta persona (los topes de reserva cuentan sus pendientes), luego el resto.
  await expireStaleCheckouts(new Date(), userId);
  await expireStaleCheckouts();
  const lines = await getCartLines(userId);
  if (lines.length === 0) throw new CheckoutError("EMPTY_CART");
  if (checkoutCartKey(lines) !== input.cartKey) throw new CheckoutError("CART_CHANGED");
  // Pausado, sin piezas suficientes o de un vendedor suspendido (SEC-24).
  if (lines.some((line) => !line.product.available)) throw new CheckoutError("NOT_AVAILABLE");
  const groups = groupBySeller(lines);

  for (const group of groups) {
    const method = input.delivery[group.seller.id];
    const allowed = availableDeliveryMethods(group.lines.map((line) => line.product));
    if (!method || !allowed.includes(method)) throw new CheckoutError("DELIVERY_NOT_ALLOWED");
  }
  const allowedPayments = commonPaymentMethods(groups.map((group) => group.seller.paymentMethods));
  if (!allowedPayments.includes(input.paymentMethod))
    throw new CheckoutError("PAYMENT_NOT_ALLOWED");

  const needsAddress = groups.some((group) => input.delivery[group.seller.id] !== "PICKUP");
  let addressSnapshot: Prisma.InputJsonValue | null = null;
  // La dirección nueva se guarda dentro de la transacción: si falla (p. ej. sin stock) y la
  // persona reintenta, no se duplica.
  let addressToSave: AddressInput | null = null;
  if (needsAddress) {
    if (input.addressId) {
      const saved = await db.address.findFirst({
        where: { id: input.addressId, userId },
        omit: { id: true, userId: true, createdAt: true, updatedAt: true, isDefault: true },
      });
      if (!saved) throw new CheckoutError("ADDRESS_REQUIRED");
      addressSnapshot = saved;
    } else if (input.newAddress) {
      addressToSave = input.newAddress;
      addressSnapshot = input.newAddress;
    } else {
      throw new CheckoutError("ADDRESS_REQUIRED");
    }
  }

  const fees = await getCommerceFees();
  const productIds = lines.map((line) => line.product.id);

  const checkout = await db.$transaction(async (tx) => {
    // Un checkout a la vez por persona (SEC-05, SEC-23): dos confirmaciones simultáneas (doble clic,
    // dos pestañas) se forman en fila y los topes de abajo ven lo que la anterior ya reservó.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`checkout:${userId}`}, 0))`;
    // El carrito es el candado: vaciar las líneas revisadas es la primera escritura. Si ya no están
    // todas, otro checkout las tomó y este no reserva nada. Solo esas líneas: lo que llegue al
    // carrito mientras tanto (otra pestaña, un pedido vencido que regresa) se queda ahí.
    const removed = await tx.cartItem.deleteMany({
      where: { id: { in: lines.map((line) => line.itemId) }, cart: { userId } },
    });
    if (removed.count !== lines.length) throw new CheckoutError("CART_CHANGED");
    await assertReservationLimits(tx, userId, lines);

    // Siempre en el mismo orden (por id): dos compras simultáneas con los mismos productos en otro
    // orden de carrito se forman en fila en vez de bloquearse mutuamente (PostgreSQL abortaría una).
    for (const line of byProductId(lines, (line) => line.product.id)) {
      const updated = await tx.product.updateMany({
        where: {
          id: line.product.id,
          status: "ACTIVE",
          stock: { gte: line.quantity },
          seller: { status: "ACTIVE" },
        },
        data: { stock: { decrement: line.quantity } },
      });
      if (updated.count === 0) throw new CheckoutError("OUT_OF_STOCK");
    }
    await tx.product.updateMany({
      where: { id: { in: productIds }, stock: 0, status: "ACTIVE" },
      data: { status: "SOLD_OUT" },
    });

    // Precio y costo vigentes, leídos dentro de la transacción (el costo nunca sale del servidor).
    const current = await tx.product.findMany({
      where: { id: { in: productIds } },
      select: {
        id: true,
        title: true,
        priceCents: true,
        shippingPriceCents: true,
        cost: { select: { unitCostCents: true } },
      },
    });
    const byId = new Map(current.map((product) => [product.id, product]));
    // Las filas ya están bloqueadas por el descuento de stock: si el precio o el envío cambiaron
    // desde la revisión, no se cobra un monto que la persona no vio.
    const changed = lines.some((line) => {
      const product = byId.get(line.product.id)!;
      return (
        product.priceCents !== line.product.priceCents ||
        product.shippingPriceCents !== line.product.shippingPriceCents
      );
    });
    if (changed) throw new CheckoutError("CART_CHANGED");

    const orders = groups.map((group) => {
      const method = input.delivery[group.seller.id]!;
      const orderLines = group.lines.map((line) => {
        const product = byId.get(line.product.id)!;
        return {
          productId: product.id,
          titleSnapshot: product.title,
          unitPriceCents: product.priceCents,
          unitCostCents: product.cost?.unitCostCents ?? 0,
          quantity: line.quantity,
          commissionBps: fees.platformFeeBps,
          sourcePostId: line.sourcePostId,
          requestedSize: line.requestedSize ?? null,
          giftRecipientName: line.giftRecipientName ?? null,
        };
      });
      const totals = computeOrderTotals({
        lines: orderLines,
        shippingCents: orderShippingCents(
          method,
          group.lines.map((line) => line.product),
        ),
        platformFeeBps: fees.platformFeeBps,
      });
      return { sellerId: group.seller.id, method, orderLines, totals };
    });

    const totalCents = orders.reduce((sum, order) => sum + order.totals.totalCents, 0);
    // Los montos son `int4`: un total mayor daría un error 500 al guardar (SEC-23). Cada monto de
    // una orden es no negativo y no mayor que este total.
    if (!fitsInInt32(totalCents)) throw new CheckoutError("TOTAL_TOO_LARGE");
    const created = await tx.checkout.create({
      data: {
        buyerId: userId,
        totalCents,
        paymentMethod: input.paymentMethod,
        expiresAt: new Date(Date.now() + CHECKOUT_TTL_MINUTES * 60_000),
        orders: {
          create: orders.map((order) => ({
            buyerId: userId,
            sellerId: order.sellerId,
            deliveryMethod: order.method,
            subtotalCents: order.totals.subtotalCents,
            shippingCents: order.totals.shippingCents,
            platformFeeCents: order.totals.platformFeeCents,
            totalCents: order.totals.totalCents,
            shippingAddress:
              order.method === "PICKUP" ? Prisma.DbNull : (addressSnapshot ?? Prisma.DbNull),
            items: { create: order.orderLines },
          })),
        },
      },
      select: { id: true, totalCents: true },
    });
    if (addressToSave) {
      const isFirst = (await tx.address.count({ where: { userId } })) === 0;
      await tx.address.create({ data: { ...addressToSave, userId, isDefault: isFirst } });
    }
    return created;
  });

  const payment = await startPayment(provider, checkout, input.paymentMethod);

  track(
    ...lines.map((line) => ({
      type: "CHECKOUT_STARTED" as const,
      userId,
      entityType: "PRODUCT" as const,
      entityId: line.product.id,
      sourcePostId: line.sourcePostId,
      metadata: { checkoutId: checkout.id, quantity: line.quantity },
    })),
  );
  return { checkoutId: checkout.id, redirectUrl: payment.redirectUrl };
}

/**
 * Topes de reservas sin pagar por persona (SEC-05): pocos checkouts pendientes a la vez y, por
 * producto, no más piezas apartadas que las que caben en un carrito. Corre con el candado del
 * comprador tomado, así que cuenta también lo que otra confirmación simultánea acaba de reservar.
 */
async function assertReservationLimits(tx: Tx, userId: string, lines: CartLine[]) {
  const pending = await tx.checkout.findMany({
    where: { buyerId: userId, status: "PENDING_PAYMENT" },
    select: { id: true },
  });
  if (pending.length >= MAX_PENDING_CHECKOUTS_PER_BUYER) {
    throw new CheckoutError("TOO_MANY_PENDING");
  }
  if (pending.length === 0) return;
  const reserved = await tx.orderItem.groupBy({
    by: ["productId"],
    where: {
      productId: { in: lines.map((line) => line.product.id) },
      order: { checkoutId: { in: pending.map((checkout) => checkout.id) } },
    },
    _sum: { quantity: true },
  });
  const overLimit = exceedsReservationLimit(
    lines.map((line) => ({ productId: line.product.id, quantity: line.quantity })),
    reserved.map((row) => ({ productId: row.productId, quantity: row._sum.quantity ?? 0 })),
    MAX_QUANTITY_PER_ITEM,
  );
  if (overLimit) throw new CheckoutError("RESERVATION_LIMIT");
}

function paymentProviderOrThrow() {
  try {
    return getPaymentProvider();
  } catch (error) {
    console.error("[checkout] no hay proveedor de pagos disponible", error);
    throw new CheckoutError("PAYMENT_UNAVAILABLE");
  }
}

/**
 * Pide el pago al proveedor. Si falla, el checkout se libera en el momento (stock y carrito de
 * regreso) en lugar de quedar reservado sin forma de pagarse (SEC-23); si la liberación también
 * falla, `expireStaleCheckouts` lo barre al vencer.
 */
async function startPayment(
  provider: PaymentProvider,
  checkout: { id: string; totalCents: number },
  method: PaymentMethod,
) {
  let created: Awaited<ReturnType<PaymentProvider["createPayment"]>> | undefined;
  try {
    created = await provider.createPayment({
      checkoutId: checkout.id,
      amountCents: checkout.totalCents,
      currency: "MXN",
      method,
      description: `Pedido ${checkout.id.slice(0, 8)}`,
    });
    await db.payment.create({
      data: {
        checkoutId: checkout.id,
        provider: provider.id,
        providerRef: created.providerRef,
        amountCents: checkout.totalCents,
        method,
      },
    });
    return created;
  } catch (error) {
    console.error("[checkout] no se pudo iniciar el pago; se libera la reserva", error);
    try {
      if (created) await provider.cancelPayment({ providerRef: created.providerRef });
      await db.$transaction((tx) => releaseCheckout(tx, checkout.id, "FAILED"));
    } catch (releaseError) {
      console.error(
        "[checkout] no se pudo liberar la reserva; se liberará al vencer",
        releaseError,
      );
    }
    throw new CheckoutError("PAYMENT_UNAVAILABLE");
  }
}

/** Huella del carrito que se muestra en /checkout y se vuelve a comprobar al confirmar. */
export function checkoutCartKey(lines: CartLine[]) {
  return cartFingerprint(
    lines.map((line) => ({
      productId: line.product.id,
      quantity: line.quantity,
      unitPriceCents: line.product.priceCents,
      shippingPriceCents: line.product.shippingPriceCents,
      requestedSize: line.requestedSize,
      giftRecipientName: line.giftRecipientName,
    })),
  );
}

type NotApplied = {
  applied: false;
  reason:
    | "UNKNOWN_PAYMENT"
    | "DUPLICATE_EVENT"
    | "AMOUNT_MISMATCH"
    | "NOT_PENDING"
    /** Aprobado después de vencer o rechazarse: hubo cobro sin pedido, hay que reembolsar. */
    | "LATE_APPROVAL";
};

export type ApplyPaymentResult = { applied: true } | NotApplied;

type PaidOrder = {
  id: string;
  items: { productId: string; quantity: number; sourcePostId: string | null }[];
};

/**
 * Aplica una notificación del proveedor de pagos. Idempotente: cada evento se registra una sola
 * vez y el pago solo cambia desde PENDING (un segundo evento no lo altera). Un APPROVED solo cuenta
 * si trae el monto y la moneda exactos del pago.
 */
export async function applyPaymentEvent(event: PaymentEventInput): Promise<ApplyPaymentResult> {
  const payment = await db.payment.findUnique({
    where: { providerRef: event.providerRef },
    select: { id: true, provider: true, checkoutId: true, amountCents: true, currency: true },
  });
  if (!payment || payment.provider !== event.provider) {
    return { applied: false, reason: "UNKNOWN_PAYMENT" };
  }

  const result = await db.$transaction(
    async (tx): Promise<NotApplied | { applied: true; orders: PaidOrder[] }> => {
      // El checkout se bloquea primero en todo camino que lo cambia (aquí y `releaseCheckout`): un
      // pago y una liberación simultáneos se forman en fila en vez de cruzarse.
      await tx.$executeRaw`SELECT 1 FROM "checkouts" WHERE "id" = ${payment.checkoutId}::uuid FOR UPDATE`;
      try {
        await tx.paymentEvent.create({
          data: {
            paymentId: payment.id,
            provider: event.provider,
            providerEventId: event.providerEventId,
            status: event.status,
            payload: event.payload as Prisma.InputJsonValue,
          },
        });
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
          return { applied: false, reason: "DUPLICATE_EVENT" };
        }
        throw error;
      }

      // Un cobro que no coincide con lo que se pidió no marca nada como pagado (queda registrado).
      if (
        event.status === "APPROVED" &&
        (event.amountCents !== payment.amountCents || event.currency !== payment.currency)
      ) {
        return { applied: false, reason: "AMOUNT_MISMATCH" };
      }

      const moved = await tx.payment.updateMany({
        where: { id: payment.id, status: "PENDING" },
        data: { status: event.status },
      });
      if (moved.count === 0) {
        const current = await tx.payment.findUniqueOrThrow({
          where: { id: payment.id },
          select: { status: true },
        });
        const late = event.status === "APPROVED" && current.status !== "APPROVED";
        return { applied: false, reason: late ? "LATE_APPROVAL" : "NOT_PENDING" };
      }

      if (event.status !== "APPROVED") {
        await releaseCheckout(
          tx,
          payment.checkoutId,
          event.status === "EXPIRED" ? "EXPIRED" : "FAILED",
        );
        return { applied: true, orders: [] };
      }

      const orders = await tx.order.findMany({
        where: { checkoutId: payment.checkoutId },
        select: {
          id: true,
          platformFeeCents: true,
          items: { select: { productId: true, quantity: true, sourcePostId: true } },
        },
      });
      const now = new Date();
      await tx.checkout.update({ where: { id: payment.checkoutId }, data: { status: "PAID" } });
      await tx.order.updateMany({
        where: { checkoutId: payment.checkoutId },
        data: { status: "PAID", paidAt: now },
      });
      // Ingreso de la plataforma (ADR-020): comisiones cobradas en este pago. Un pago simulado no
      // cobró nada, así que no es ingreso ni sube el presupuesto de IA (SEC-01).
      const commissions = isSimulatedPayment(payment.provider)
        ? []
        : orders.filter((order) => order.platformFeeCents > 0);
      if (commissions.length > 0) {
        await tx.platformLedgerEntry.createMany({
          data: commissions.map((order) => ({
            kind: "COMMISSION" as const,
            amountCents: order.platformFeeCents,
            reference: `order:${order.id}`,
            occurredAt: now,
          })),
        });
      }
      return { applied: true, orders };
    },
  );

  if (!result.applied) {
    const needsReview = result.reason === "AMOUNT_MISMATCH" || result.reason === "LATE_APPROVAL";
    // Con un proveedor real hubo (o pudo haber) un cobro sin pedido: se revisa y se reembolsa.
    if (needsReview && !isSimulatedPayment(payment.provider)) {
      console.error(`[payments] ${result.reason} en el pago ${payment.id}: revisar y reembolsar`);
    }
    return { applied: false, reason: result.reason };
  }

  if (event.status === "APPROVED") {
    // Aviso a cada tienda de su pedido nuevo (ADR-059).
    await notifyOrders(
      "ORDER_PAID",
      result.orders.map((order) => order.id),
    );
    const checkout = await db.checkout.findUnique({
      where: { id: payment.checkoutId },
      select: { buyerId: true },
    });
    track(
      ...result.orders.flatMap((order) =>
        order.items.map((item) => ({
          type: "PURCHASE" as const,
          userId: checkout?.buyerId ?? null,
          entityType: "PRODUCT" as const,
          entityId: item.productId,
          sourcePostId: item.sourcePostId,
          metadata: { orderId: order.id, quantity: item.quantity },
        })),
      ),
    );
  }
  return { applied: true };
}

/**
 * Cancela un checkout que no se pagó: sus pedidos quedan cancelados y sin domicilio (el vendedor no
 * lo conserva, SEC-08), el stock regresa y los productos vuelven al carrito para reintentar. Un pago
 * que siguiera pendiente deja de serlo, así que un APPROVED tardío ya no lo marca como pagado. Solo
 * actúa si el checkout sigue esperando pago: es idempotente.
 */
async function releaseCheckout(
  tx: Tx,
  checkoutId: string,
  status: "FAILED" | "EXPIRED",
  where: Prisma.CheckoutWhereInput = {},
) {
  const moved = await tx.checkout.updateMany({
    where: { ...where, id: checkoutId, status: "PENDING_PAYMENT" },
    data: { status },
  });
  if (moved.count === 0) return false;
  await tx.payment.updateMany({
    where: { checkoutId, status: "PENDING" },
    data: { status: status === "EXPIRED" ? "EXPIRED" : "DECLINED" },
  });
  const { buyerId, orders } = await tx.checkout.findUniqueOrThrow({
    where: { id: checkoutId },
    select: {
      buyerId: true,
      orders: {
        select: {
          items: {
            select: {
              productId: true,
              quantity: true,
              sourcePostId: true,
              requestedSize: true,
              giftRecipientName: true,
            },
          },
        },
      },
    },
  });
  await tx.order.updateMany({
    where: { checkoutId },
    data: { status: "CANCELLED", shippingAddress: Prisma.DbNull },
  });
  const returned = orders.flatMap((order) => order.items);
  await restoreStock(tx, returned);

  // Y los productos regresan al carrito para volver a intentar (el carrito se vació al pedir).
  const cart = await tx.cart.upsert({
    where: { userId: buyerId },
    create: { userId: buyerId },
    update: {},
    select: { id: true },
  });
  const inCart = await tx.cartItem.findMany({
    where: { cartId: cart.id, productId: { in: returned.map((item) => item.productId) } },
    select: { productId: true, quantity: true, requestedSize: true, giftRecipientName: true },
  });
  // Si se agregó otra talla o destinatario mientras se esperaba el pago, conserva esa elección.
  const compatible = returned.filter((item) => {
    const existing = inCart.find((line) => line.productId === item.productId);
    return (
      !existing ||
      (existing.requestedSize === item.requestedSize &&
        existing.giftRecipientName === item.giftRecipientName)
    );
  });
  for (const item of restoredCartItems(compatible, inCart, MAX_QUANTITY_PER_ITEM)) {
    await tx.cartItem.upsert({
      where: { cartId_productId: { cartId: cart.id, productId: item.productId } },
      create: { cartId: cart.id, ...item },
      update: {
        quantity: item.quantity,
        ...(item.requestedSize !== undefined ? { requestedSize: item.requestedSize } : {}),
        ...(item.giftRecipientName !== undefined
          ? { giftRecipientName: item.giftRecipientName }
          : {}),
        ...(item.sourcePostId ? { sourcePostId: item.sourcePostId } : {}),
      },
    });
  }
  return true;
}

/** Orden fijo para bloquear filas de productos: el mismo al apartar y al devolver stock. */
function byProductId<T>(items: T[], productId: (item: T) => string) {
  return [...items].sort((a, b) => {
    const [left, right] = [productId(a), productId(b)];
    return left < right ? -1 : left > right ? 1 : 0;
  });
}

/** Devuelve piezas apartadas; un producto agotado vuelve a estar a la venta. */
async function restoreStock(tx: Tx, items: { productId: string; quantity: number }[]) {
  for (const item of byProductId(items, (item) => item.productId)) {
    await tx.product.update({
      where: { id: item.productId },
      data: { stock: { increment: item.quantity } },
    });
    await tx.product.updateMany({
      where: { id: item.productId, status: "SOLD_OUT", stock: { gt: 0 } },
      data: { status: "ACTIVE" },
    });
  }
}

/**
 * Vence checkouts sin pagar después del tiempo de reserva y devuelve su stock. Con `buyerId` solo
 * revisa los de esa persona (se llama al abrir carrito, checkout y pedidos, para que nunca vea como
 * pendiente algo ya vencido). También libera checkouts que se quedaron sin pago (SEC-23).
 *
 * Cada checkout se libera por separado y un error no detiene el resto: el barrido global corre
 * dentro de páginas y compras de otras personas (y de un cron), que no deben fallar por un pedido
 * ajeno. Lo que falle se reintenta en el siguiente barrido.
 */
export async function expireStaleCheckouts(now = new Date(), buyerId?: string) {
  const stale = await db.payment.findMany({
    where: {
      status: "PENDING",
      checkout: {
        status: "PENDING_PAYMENT",
        expiresAt: { lt: now },
        ...(buyerId ? { buyerId } : {}),
      },
    },
    take: 50,
    select: { provider: true, providerRef: true, checkoutId: true },
  });
  for (const payment of stale) {
    await sweepOne(payment.checkoutId, async () => {
      const result = await applyPaymentEvent({
        provider: payment.provider,
        providerEventId: `expire_${payment.checkoutId}`,
        providerRef: payment.providerRef,
        status: "EXPIRED",
        payload: { reason: "timeout" },
      });
      if (result.applied) await cancelAtProvider(payment);
    });
  }

  const orphans = await db.checkout.findMany({
    where: {
      status: "PENDING_PAYMENT",
      expiresAt: { lt: now },
      payments: { none: {} },
      ...(buyerId ? { buyerId } : {}),
    },
    take: 50,
    select: { id: true },
  });
  for (const orphan of orphans) {
    await sweepOne(orphan.id, () =>
      db.$transaction((tx) =>
        releaseCheckout(tx, orphan.id, "EXPIRED", { payments: { none: {} } }),
      ),
    );
  }
}

async function sweepOne(checkoutId: string, release: () => Promise<unknown>) {
  try {
    await release();
  } catch (error) {
    console.error(`[checkout] no se pudo vencer el checkout ${checkoutId}; se reintenta`, error);
  }
}

/** El proveedor deja de aceptar un pago vencido: así no llega un cobro sin pedido (SEC-23). */
async function cancelAtProvider(payment: { provider: string; providerRef: string }) {
  try {
    const provider = getPaymentProvider();
    if (provider.id !== payment.provider) return;
    await provider.cancelPayment({ providerRef: payment.providerRef });
  } catch (error) {
    console.error("[payments] no se pudo dar de baja un pago vencido en el proveedor", error);
  }
}

/**
 * El vendedor avanza un pedido según las transiciones permitidas (SEC-25). Solo con un cobro real:
 * un pedido pagado en simulación nunca se envía ni se entrega (SEC-01).
 */
export async function advanceOrder(
  sellerUserId: string,
  orderId: string,
  to: "SHIPPED" | "DELIVERED",
) {
  const updated = await db.order.updateMany({
    where: {
      id: orderId,
      seller: { userId: sellerUserId },
      ...sellerTransitionWhere(to),
      checkout: {
        payments: {
          some: { status: "APPROVED", provider: { not: SIMULATED_PAYMENT_PROVIDER } },
        },
      },
    },
    data:
      to === "SHIPPED"
        ? { status: "SHIPPED", shippedAt: new Date() }
        : { status: "DELIVERED", deliveredAt: new Date() },
  });
  if (updated.count === 0) return false;
  // Aviso a quien compró: su pedido salió o se entregó (ADR-059).
  await notifyOrders(to === "SHIPPED" ? "ORDER_SHIPPED" : "ORDER_DELIVERED", [orderId]);
  return true;
}

export type CancelOrderResult = "CANCELLED" | "NOT_ALLOWED" | "REFUND_REQUIRED";

/**
 * El vendedor cancela un pedido pagado antes de enviarlo (SEC-25): p. ej. sin piezas reales o una
 * dirección fuera de sus zonas de entrega local. El stock regresa y el domicilio se borra (SEC-08).
 * Un cobro real solo se podrá cancelar cuando el proveedor lo reembolse; hoy solo hay simulados.
 */
export async function cancelOrderBySeller(
  sellerUserId: string,
  orderId: string,
): Promise<CancelOrderResult> {
  const result = await db.$transaction(async (tx): Promise<CancelOrderResult> => {
    const order = await tx.order.findFirst({
      where: {
        id: orderId,
        seller: { userId: sellerUserId },
        ...sellerTransitionWhere("CANCELLED"),
      },
      select: {
        checkout: {
          select: { payments: { where: { status: "APPROVED" }, select: { provider: true } } },
        },
        items: { select: { productId: true, quantity: true } },
      },
    });
    if (!order) return "NOT_ALLOWED";
    if (order.checkout.payments.some((payment) => !isSimulatedPayment(payment.provider))) {
      return "REFUND_REQUIRED";
    }
    // Condicionado al estado: si otra petición lo envió o canceló antes, no se devuelve dos veces.
    const moved = await tx.order.updateMany({
      where: { id: orderId, ...sellerTransitionWhere("CANCELLED") },
      data: { status: "CANCELLED", shippingAddress: Prisma.DbNull },
    });
    if (moved.count === 0) return "NOT_ALLOWED";
    await restoreStock(tx, order.items);
    return "CANCELLED";
  });
  // Aviso a quien compró: la tienda canceló su pedido (ADR-059).
  if (result === "CANCELLED") await notifyOrders("ORDER_CANCELLED", [orderId]);
  return result;
}
