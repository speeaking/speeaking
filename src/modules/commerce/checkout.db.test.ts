import { randomUUID } from "node:crypto";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import type * as Payments from "@/server/providers/payments";
import type { PaymentProvider } from "@/server/providers/payments";

/**
 * Integración contra la base de desarrollo (`pnpm db:start`): candados, topes de reserva, stock y
 * transiciones solo se pueden probar con PostgreSQL real (SEC-01, SEC-05, SEC-08, SEC-23, SEC-24,
 * SEC-25). Crea sus propias cuentas `e2e.fix.*@example.com` y las borra al final.
 */
const { databaseUrl } = await vi.hoisted(async () => {
  const { config } = await import("dotenv");
  // Sin tocar `process.env`: el resto de las pruebas no debe ver las variables de `.env`.
  const local: Record<string, string | undefined> = {};
  config({ quiet: true, processEnv: local });
  return { databaseUrl: process.env.DATABASE_URL ?? local.DATABASE_URL };
});

// Proveedor de pagos de la prueba: `null` usa el real del módulo (el simulado en NODE_ENV=test).
const providerState = vi.hoisted(() => ({ current: null as PaymentProvider | null }));

vi.mock("@/server/db", async () => {
  const { createPrismaClient } = await import("@/server/db-client");
  return { db: createPrismaClient(databaseUrl ?? "postgresql://localhost:1/sin-base") };
});
vi.mock("@/server/env", () => ({
  env: {
    NODE_ENV: "test",
    PAYMENT_PROVIDER: "mock",
    ALLOW_SIMULATED_PAYMENTS: false,
    TRUSTED_PROXY_HOPS: 0,
  },
}));
vi.mock("@/server/providers/payments", async (importOriginal) => {
  const actual = await importOriginal<typeof Payments>();
  return {
    ...actual,
    getPaymentProvider: () => providerState.current ?? actual.getPaymentProvider(),
  };
});
vi.mock("@/server/providers/storage", () => ({
  getStorage: () => ({ publicUrl: (key: string) => `/media/${key}` }),
}));
vi.mock("@/modules/analytics/track", () => ({ track: vi.fn() }));
// Comisión de 5 %: así se ve que un pago simulado no escribe COMMISSION y uno real sí.
vi.mock("@/modules/platform/settings", () => ({
  getCommerceFees: async () => ({ version: 1, platformFeeBps: 500, estimatedPaymentFeeBps: 350 }),
}));

const { db } = await import("@/server/db");
const { addToCart, CartError, getCartLines } = await import("./cart");
const {
  advanceOrder,
  applyPaymentEvent,
  cancelOrderBySeller,
  CheckoutError,
  checkoutCartKey,
  expireStaleCheckouts,
  placeOrder,
} = await import("./checkout");
const { listSellerOrders } = await import("./seller-orders");

const RUN = randomUUID().slice(0, 8);
const userIds: string[] = [];
const productIds: string[] = [];
let categoryId = "";
let createdCategory = false;

const ADDRESS = {
  recipientName: "Ana López",
  phone: "5512345678",
  street: "Calle Secreta",
  exteriorNumber: "742",
  interiorNumber: undefined,
  neighborhood: "Del Valle",
  city: "Benito Juárez",
  state: "CDMX",
  postalCode: "03100",
  references: undefined,
};

async function createUser(tag: string) {
  const user = await db.user.create({
    data: {
      name: `Prueba ${tag}`,
      email: `e2e.fix.${RUN}.${tag}.${randomUUID().slice(0, 6)}@example.com`,
    },
    select: { id: true },
  });
  userIds.push(user.id);
  return user.id;
}

async function createSeller() {
  const userId = await createUser("vendedor");
  const seller = await db.sellerProfile.create({
    data: { userId, displayName: "Tienda de prueba", acceptedPaymentMethods: ["CARD"] },
    select: { id: true },
  });
  return { userId, sellerId: seller.id };
}

async function createProduct(sellerId: string, stock: number, priceCents = 349_900) {
  const product = await db.product.create({
    data: {
      sellerId,
      slug: `e2e-fix-${RUN}-${randomUUID().slice(0, 8)}`,
      title: "AirPods Pro 2",
      description: "Producto de prueba",
      priceCents,
      stock,
      categoryId,
      city: "Ciudad de México",
      state: "CDMX",
      pickupAvailable: true,
      nationalShippingAvailable: true,
      shippingPriceCents: 9_900,
      cost: { create: { unitCostCents: 240_000 } },
    },
    select: { id: true },
  });
  productIds.push(product.id);
  return product.id;
}

async function setCart(
  userId: string,
  items: { productId: string; quantity: number; addedAt?: Date }[],
) {
  const cart = await db.cart.upsert({
    where: { userId },
    create: { userId },
    update: {},
    select: { id: true },
  });
  await db.cartItem.deleteMany({ where: { cartId: cart.id } });
  for (const item of items) await db.cartItem.create({ data: { cartId: cart.id, ...item } });
}

async function order(userId: string, sellerId: string) {
  const cartKey = checkoutCartKey(await getCartLines(userId));
  return placeOrder(userId, {
    cartKey,
    delivery: { [sellerId]: "NATIONAL_SHIPPING" },
    paymentMethod: "CARD",
    addressId: null,
    newAddress: ADDRESS,
  });
}

async function checkoutCode(promise: Promise<unknown>) {
  const error = await promise.then(
    () => null,
    (reason: unknown) => reason,
  );
  expect(error).toBeInstanceOf(CheckoutError);
  return (error as InstanceType<typeof CheckoutError>).code;
}

async function paymentOf(checkoutId: string) {
  return db.payment.findFirstOrThrow({
    where: { checkoutId },
    select: { provider: true, providerRef: true, amountCents: true, currency: true },
  });
}

async function approve(checkoutId: string) {
  const payment = await paymentOf(checkoutId);
  return applyPaymentEvent({
    provider: payment.provider,
    providerEventId: `test_${randomUUID()}`,
    providerRef: payment.providerRef,
    status: "APPROVED",
    amountCents: payment.amountCents,
    currency: payment.currency,
    payload: {},
  });
}

async function orderOf(checkoutId: string) {
  return db.order.findFirstOrThrow({
    where: { checkoutId },
    select: { id: true, status: true, shippingAddress: true },
  });
}

async function stockOf(productId: string) {
  return (await db.product.findUniqueOrThrow({ where: { id: productId }, select: { stock: true } }))
    .stock;
}

async function cartQuantities(userId: string) {
  const items = await db.cartItem.findMany({
    where: { cart: { userId } },
    select: { productId: true, quantity: true },
  });
  return Object.fromEntries(items.map((item) => [item.productId, item.quantity]));
}

/** Proveedor "real" de prueba (no simulado): cobra comisión y exige reembolso para cancelar. */
function realProvider(overrides: Partial<PaymentProvider> = {}): PaymentProvider {
  return {
    id: "testpay",
    createPayment: async () => ({
      providerRef: `testpay_${randomUUID()}`,
      redirectUrl: "https://pagos.example.com/pagar",
    }),
    cancelPayment: vi.fn(async () => {}),
    ...overrides,
  };
}

describe.skipIf(!databaseUrl)("checkout contra PostgreSQL", () => {
  beforeAll(async () => {
    const existing = await db.category.findFirst({ select: { id: true } });
    if (existing) {
      categoryId = existing.id;
    } else {
      categoryId = (
        await db.category.create({
          data: { slug: `e2e-fix-${RUN}`, name: "Prueba" },
          select: { id: true },
        })
      ).id;
      createdCategory = true;
    }
  });

  afterEach(() => {
    providerState.current = null;
  });

  afterAll(async () => {
    const orders = await db.order.findMany({
      where: { buyerId: { in: userIds } },
      select: { id: true },
    });
    await db.platformLedgerEntry.deleteMany({
      where: { reference: { in: orders.map((row) => `order:${row.id}`) } },
    });
    await db.paymentEvent.deleteMany({
      where: { payment: { checkout: { buyerId: { in: userIds } } } },
    });
    await db.checkout.deleteMany({ where: { buyerId: { in: userIds } } });
    await db.product.deleteMany({ where: { id: { in: productIds } } });
    await db.user.deleteMany({ where: { id: { in: userIds } } });
    if (createdCategory) await db.category.delete({ where: { id: categoryId } });
    await db.$disconnect();
  });

  it("SEC-23: dos confirmaciones simultáneas del mismo carrito crean un solo checkout", async () => {
    const { sellerId } = await createSeller();
    const productId = await createProduct(sellerId, 5);
    const buyer = await createUser("doble");
    await setCart(buyer, [{ productId, quantity: 2 }]);

    const results = await Promise.allSettled([order(buyer, sellerId), order(buyer, sellerId)]);

    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    const rejected = results.find((result) => result.status === "rejected");
    // Las dos respuestas son el mismo rechazo y dependen de cuándo arranca la segunda: si leyó el
    // carrito antes de que la primera terminara, se forma en fila y encuentra las líneas ya tomadas
    // (CART_CHANGED); si lo leyó después, ya está vacío (EMPTY_CART). Lo que no puede pasar es una
    // segunda reserva: un solo checkout y el stock apartado una vez.
    expect(["CART_CHANGED", "EMPTY_CART"]).toContain(
      (rejected?.reason as InstanceType<typeof CheckoutError>).code,
    );
    expect(await stockOf(productId)).toBe(3);
    expect(await db.checkout.count({ where: { buyerId: buyer } })).toBe(1);
  });

  it("SEC-23: dos compras simultáneas con los mismos productos en otro orden no se bloquean", async () => {
    // El carrito se recorre en el orden en que se agregó: sin un orden fijo al apartar, A bloquea
    // el producto 1 y espera el 2 mientras B bloquea el 2 y espera el 1 (PostgreSQL aborta una).
    const { sellerId } = await createSeller();
    const early = new Date(Date.now() - 60_000);
    const late = new Date();
    for (let round = 0; round < 4; round++) {
      const first = await createProduct(sellerId, 5);
      const second = await createProduct(sellerId, 5);
      const [a, b] = [await createUser("orden-a"), await createUser("orden-b")];
      await setCart(a, [
        { productId: first, quantity: 1, addedAt: early },
        { productId: second, quantity: 1, addedAt: late },
      ]);
      await setCart(b, [
        { productId: second, quantity: 1, addedAt: early },
        { productId: first, quantity: 1, addedAt: late },
      ]);

      const results = await Promise.allSettled([order(a, sellerId), order(b, sellerId)]);
      expect(results.map((result) => result.status)).toEqual(["fulfilled", "fulfilled"]);
      expect([await stockOf(first), await stockOf(second)]).toEqual([3, 3]);
    }
  }, 30_000);

  it("SEC-05: una persona no aparta más de 10 piezas de un producto sin pagar", async () => {
    const { sellerId } = await createSeller();
    const productId = await createProduct(sellerId, 25);
    const buyer = await createUser("acaparador");
    await setCart(buyer, [{ productId, quantity: 10 }]);
    await order(buyer, sellerId);

    await setCart(buyer, [{ productId, quantity: 1 }]);
    expect(await checkoutCode(order(buyer, sellerId))).toBe("RESERVATION_LIMIT");
    // Nada se reservó y el carrito sigue como estaba (la transacción se deshizo).
    expect(await stockOf(productId)).toBe(15);
    expect(await cartQuantities(buyer)).toEqual({ [productId]: 1 });
  });

  it("SEC-05: una persona no tiene más de 2 checkouts esperando pago", async () => {
    const { sellerId } = await createSeller();
    const productId = await createProduct(sellerId, 25);
    const buyer = await createUser("pendientes");
    for (let round = 0; round < 2; round++) {
      await setCart(buyer, [{ productId, quantity: 1 }]);
      await order(buyer, sellerId);
    }
    await setCart(buyer, [{ productId, quantity: 1 }]);
    expect(await checkoutCode(order(buyer, sellerId))).toBe("TOO_MANY_PENDING");
    expect(await stockOf(productId)).toBe(23);
  });

  it("SEC-01: un pago simulado no escribe COMMISSION; el vendedor no lo envía, solo lo cancela", async () => {
    const { userId: sellerUser, sellerId } = await createSeller();
    const productId = await createProduct(sellerId, 5);
    const buyer = await createUser("simulado");
    await setCart(buyer, [{ productId, quantity: 2 }]);
    const { checkoutId } = await order(buyer, sellerId);
    expect(await approve(checkoutId)).toEqual({ applied: true });

    const paid = await orderOf(checkoutId);
    expect(paid.status).toBe("PAID");
    expect(await db.platformLedgerEntry.count({ where: { reference: `order:${paid.id}` } })).toBe(
      0,
    );

    // Marcado como simulado y sin domicilio: no hay nada que enviar (SEC-01, SEC-08).
    const [listed] = await listSellerOrders(sellerId);
    expect(listed).toMatchObject({
      id: paid.id,
      simulatedPayment: true,
      buyerName: "Comprador",
      shippingAddress: null,
      actions: ["CANCELLED"],
    });

    // SEC-25: nada de enviar ni entregar un pedido que no se cobró.
    expect(await advanceOrder(sellerUser, paid.id, "SHIPPED")).toBe(false);
    expect(await advanceOrder(sellerUser, paid.id, "DELIVERED")).toBe(false);
    // Otra cuenta no puede cancelarlo.
    const stranger = await createUser("extrano");
    expect(await cancelOrderBySeller(stranger, paid.id)).toBe("NOT_ALLOWED");

    expect(await cancelOrderBySeller(sellerUser, paid.id)).toBe("CANCELLED");
    expect(await stockOf(productId)).toBe(5);
    const cancelled = await orderOf(checkoutId);
    expect(cancelled).toMatchObject({ status: "CANCELLED", shippingAddress: null });
    // Una segunda cancelación no devuelve stock dos veces.
    expect(await cancelOrderBySeller(sellerUser, paid.id)).toBe("NOT_ALLOWED");
    expect(await stockOf(productId)).toBe(5);

    const [after] = await listSellerOrders(sellerId);
    expect(after).toMatchObject({ status: "CANCELLED", buyerName: null, shippingAddress: null });
  });

  it("SEC-01: el mismo evento dos veces (doble clic, reintento) se aplica y registra una sola vez", async () => {
    const { sellerId } = await createSeller();
    const productId = await createProduct(sellerId, 5);
    const buyer = await createUser("dobleclic");
    await setCart(buyer, [{ productId, quantity: 1 }]);
    const { checkoutId } = await order(buyer, sellerId);
    const payment = await paymentOf(checkoutId);
    const event = (status: "APPROVED" | "DECLINED") =>
      applyPaymentEvent({
        provider: payment.provider,
        providerEventId: `sim_${payment.providerRef}`,
        providerRef: payment.providerRef,
        status,
        amountCents: payment.amountCents,
        currency: payment.currency,
        payload: { simulated: true },
      });

    const results = await Promise.all([event("APPROVED"), event("APPROVED")]);
    expect(results).toContainEqual({ applied: true });
    expect(results).toContainEqual({ applied: false, reason: "DUPLICATE_EVENT" });
    expect(await event("DECLINED")).toEqual({ applied: false, reason: "DUPLICATE_EVENT" });
    expect(await db.paymentEvent.count({ where: { payment: { checkoutId } } })).toBe(1);
    expect((await orderOf(checkoutId)).status).toBe("PAID");
    expect(await stockOf(productId)).toBe(4);
  });

  it("SEC-23: un APPROVED sin el monto exacto no marca nada como pagado", async () => {
    const { sellerId } = await createSeller();
    const productId = await createProduct(sellerId, 5);
    const buyer = await createUser("monto");
    await setCart(buyer, [{ productId, quantity: 1 }]);
    const { checkoutId } = await order(buyer, sellerId);
    const payment = await paymentOf(checkoutId);

    for (const amountCents of [undefined, payment.amountCents - 1]) {
      const result = await applyPaymentEvent({
        provider: payment.provider,
        providerEventId: `test_${randomUUID()}`,
        providerRef: payment.providerRef,
        status: "APPROVED",
        amountCents,
        currency: "MXN",
        payload: {},
      });
      expect(result).toEqual({ applied: false, reason: "AMOUNT_MISMATCH" });
    }
    expect((await orderOf(checkoutId)).status).toBe("PENDING_PAYMENT");
  });

  it("con cobro real: COMMISSION, transiciones validadas y cancelar exige reembolso", async () => {
    providerState.current = realProvider();
    const { userId: sellerUser, sellerId } = await createSeller();
    const productId = await createProduct(sellerId, 5);
    const buyer = await createUser("real");
    await setCart(buyer, [{ productId, quantity: 1 }]);
    const { checkoutId, redirectUrl } = await order(buyer, sellerId);
    expect(redirectUrl).toBe("https://pagos.example.com/pagar");
    await approve(checkoutId);
    const paid = await orderOf(checkoutId);

    const ledger = await db.platformLedgerEntry.findMany({
      where: { reference: `order:${paid.id}` },
      select: { kind: true, amountCents: true },
    });
    expect(ledger).toEqual([{ kind: "COMMISSION", amountCents: 17_495 }]);

    // SEC-08: con el cobro hecho, el vendedor ve adónde entregar (sin el teléfono).
    const [listed] = await listSellerOrders(sellerId);
    expect(listed).toMatchObject({ id: paid.id, simulatedPayment: false, actions: ["SHIPPED"] });
    expect(listed?.shippingAddress?.street).toBe("Calle Secreta");
    expect(JSON.stringify(listed)).not.toContain(ADDRESS.phone);

    // SEC-25: un envío nacional no pasa a entregado sin haberse enviado.
    expect(await advanceOrder(sellerUser, paid.id, "DELIVERED")).toBe(false);
    expect(await advanceOrder(sellerUser, paid.id, "SHIPPED")).toBe(true);
    expect(await advanceOrder(sellerUser, paid.id, "SHIPPED")).toBe(false);
    expect(await advanceOrder(sellerUser, paid.id, "DELIVERED")).toBe(true);

    await setCart(buyer, [{ productId, quantity: 1 }]);
    const second = await order(buyer, sellerId);
    await approve(second.checkoutId);
    const secondOrder = await orderOf(second.checkoutId);
    expect(await cancelOrderBySeller(sellerUser, secondOrder.id)).toBe("REFUND_REQUIRED");
    expect((await orderOf(second.checkoutId)).status).toBe("PAID");
  });

  it("SEC-08: un pago rechazado cancela sin domicilio y el vendedor no ve el intento", async () => {
    const { sellerId } = await createSeller();
    const productId = await createProduct(sellerId, 5);
    const buyer = await createUser("rechazo");
    await setCart(buyer, [{ productId, quantity: 1 }]);
    const { checkoutId } = await order(buyer, sellerId);
    const payment = await paymentOf(checkoutId);

    const result = await applyPaymentEvent({
      provider: payment.provider,
      providerEventId: `test_${randomUUID()}`,
      providerRef: payment.providerRef,
      status: "DECLINED",
      payload: {},
    });
    expect(result).toEqual({ applied: true });
    expect(await orderOf(checkoutId)).toMatchObject({
      status: "CANCELLED",
      shippingAddress: null,
    });
    expect(await listSellerOrders(sellerId)).toEqual([]);
    expect(await stockOf(productId)).toBe(5);
    expect(await cartQuantities(buyer)).toEqual({ [productId]: 1 });
  });

  it("SEC-23: si el proveedor falla al crear el pago, la reserva se libera en el momento", async () => {
    providerState.current = realProvider({
      createPayment: async () => {
        throw new Error("proveedor caído");
      },
    });
    const { sellerId } = await createSeller();
    const productId = await createProduct(sellerId, 5);
    const buyer = await createUser("huerfano");
    await setCart(buyer, [{ productId, quantity: 2 }]);
    vi.spyOn(console, "error").mockImplementation(() => {});

    expect(await checkoutCode(order(buyer, sellerId))).toBe("PAYMENT_UNAVAILABLE");
    const checkout = await db.checkout.findFirstOrThrow({
      where: { buyerId: buyer },
      select: { status: true },
    });
    expect(checkout.status).toBe("FAILED");
    expect(await stockOf(productId)).toBe(5);
    expect(await cartQuantities(buyer)).toEqual({ [productId]: 2 });
    vi.mocked(console.error).mockRestore();
  });

  it("SEC-23: un checkout sin pago que venció también se libera", async () => {
    const { sellerId } = await createSeller();
    const productId = await createProduct(sellerId, 5);
    const buyer = await createUser("sinpago");
    await setCart(buyer, [{ productId, quantity: 2 }]);
    const { checkoutId } = await order(buyer, sellerId);
    // Como si el proceso hubiera caído entre la reserva y el registro del pago.
    await db.payment.deleteMany({ where: { checkoutId } });
    await db.checkout.update({
      where: { id: checkoutId },
      data: { expiresAt: new Date(Date.now() - 60_000) },
    });

    await expireStaleCheckouts(new Date(), buyer);
    expect(
      (await db.checkout.findUniqueOrThrow({ where: { id: checkoutId }, select: { status: true } }))
        .status,
    ).toBe("EXPIRED");
    expect(await stockOf(productId)).toBe(5);
  });

  it("SEC-05: un checkout que falla al vencer no detiene el barrido de los demás", async () => {
    const { sellerId } = await createSeller();
    const productId = await createProduct(sellerId, 5);
    const buyer = await createUser("barrido");
    const checkoutIds: string[] = [];
    for (let round = 0; round < 2; round++) {
      await setCart(buyer, [{ productId, quantity: 1 }]);
      checkoutIds.push((await order(buyer, sellerId)).checkoutId);
    }
    await db.checkout.updateMany({
      where: { id: { in: checkoutIds } },
      data: { expiresAt: new Date(Date.now() - 60_000) },
    });
    const statuses = async () =>
      (
        await db.checkout.findMany({ where: { id: { in: checkoutIds } }, select: { status: true } })
      ).map((checkout) => checkout.status);

    // P. ej. un bloqueo mutuo con otra transacción: el primero falla, el segundo sí se vence.
    const transaction = vi
      .spyOn(db, "$transaction")
      .mockRejectedValueOnce(new Error("deadlock detected"));
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(expireStaleCheckouts(new Date(), buyer)).resolves.toBeUndefined();
    transaction.mockRestore();
    expect(logged).toHaveBeenCalledWith(
      expect.stringContaining("no se pudo vencer el checkout"),
      expect.any(Error),
    );
    logged.mockRestore();
    expect((await statuses()).sort()).toEqual(["EXPIRED", "PENDING_PAYMENT"]);
    expect(await stockOf(productId)).toBe(4);

    // El siguiente barrido lo vence.
    await expireStaleCheckouts(new Date(), buyer);
    expect(await statuses()).toEqual(["EXPIRED", "EXPIRED"]);
    expect(await stockOf(productId)).toBe(5);
  });

  it("SEC-23: un APPROVED tardío no revive un checkout vencido y el pago se da de baja", async () => {
    const provider = realProvider();
    providerState.current = provider;
    const { sellerId } = await createSeller();
    const productId = await createProduct(sellerId, 5);
    const buyer = await createUser("tardio");
    await setCart(buyer, [{ productId, quantity: 1 }]);
    const { checkoutId } = await order(buyer, sellerId);
    await db.checkout.update({
      where: { id: checkoutId },
      data: { expiresAt: new Date(Date.now() - 60_000) },
    });

    await expireStaleCheckouts(new Date(), buyer);
    const payment = await paymentOf(checkoutId);
    expect(provider.cancelPayment).toHaveBeenCalledWith({ providerRef: payment.providerRef });

    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await approve(checkoutId)).toEqual({ applied: false, reason: "LATE_APPROVAL" });
    vi.mocked(console.error).mockRestore();
    expect((await orderOf(checkoutId)).status).toBe("CANCELLED");
    expect(await stockOf(productId)).toBe(5);
  });

  it("SEC-23: un total que no cabe en int4 se rechaza sin reservar", async () => {
    const { sellerId } = await createSeller();
    // $10,000,000 (el precio máximo) × 3 piezas rebasa 2,147,483,647 centavos.
    const productId = await createProduct(sellerId, 5, 1_000_000_000);
    const buyer = await createUser("overflow");
    await setCart(buyer, [{ productId, quantity: 3 }]);
    expect(await checkoutCode(order(buyer, sellerId))).toBe("TOTAL_TOO_LARGE");
    expect(await stockOf(productId)).toBe(5);
  });

  it("SEC-24: los productos de un vendedor suspendido no se agregan ni se compran", async () => {
    const { sellerId } = await createSeller();
    const productId = await createProduct(sellerId, 5);
    const other = await createProduct(sellerId, 5);
    const buyer = await createUser("suspendido");
    await setCart(buyer, [{ productId, quantity: 1 }]);
    await db.sellerProfile.update({ where: { id: sellerId }, data: { status: "SUSPENDED" } });

    const error = await addToCart(buyer, other, 1, null).catch((reason: unknown) => reason);
    expect(error).toBeInstanceOf(CartError);
    expect((error as InstanceType<typeof CartError>).code).toBe("NOT_AVAILABLE");

    const [line] = await getCartLines(buyer);
    expect(line?.product).toMatchObject({ forSale: false, available: false });
    expect(await checkoutCode(order(buyer, sellerId))).toBe("NOT_AVAILABLE");
    expect(await stockOf(productId)).toBe(5);
  });
});
