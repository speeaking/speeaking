import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  advanceOrderAction,
  cancelOrderAction,
  placeOrderAction,
  simulatePaymentAction,
} from "./actions";

// Las acciones solo traducen lo que llega del navegador: validan argumentos, aplican el límite de
// frecuencia y el candado de la pasarela simulada. Stock, topes y transiciones se prueban contra
// PostgreSQL en checkout.db.test.
const { session, checkout, payments, rateLimits, db, navigation, revalidatePath } = vi.hoisted(
  () => {
    class CheckoutError extends Error {
      constructor(readonly code: string) {
        super(code);
      }
    }
    return {
      session: { getViewer: vi.fn(), requireOnboardedViewer: vi.fn() },
      checkout: {
        CheckoutError,
        advanceOrder: vi.fn(),
        applyPaymentEvent: vi.fn(),
        cancelOrderBySeller: vi.fn(),
        expireStaleCheckouts: vi.fn(),
        placeOrder: vi.fn(),
      },
      payments: {
        simulatedPaymentsEnabled: vi.fn(() => true),
        isSimulatedPayment: (provider: string) => provider === "mock",
        SIMULATED_PAYMENT_PROVIDER: "mock",
      },
      rateLimits: {
        rateLimitMany: vi.fn(async () => ({ ok: true })),
        rateLimitKey: (scope: string, subject: string, value: string) =>
          `${scope}:${subject}:${value}`,
        limitOrError: (result: { ok: boolean }) =>
          result.ok ? null : "Demasiados intentos. Intenta de nuevo en 1 hora.",
      },
      db: { payment: { findUnique: vi.fn() } },
      navigation: {
        redirect: vi.fn((to: string) => {
          throw new Error(`redirect:${to}`);
        }),
        notFound: vi.fn(() => {
          throw new Error("notFound");
        }),
      },
      revalidatePath: vi.fn(),
    };
  },
);
vi.mock("@/modules/identity/session", () => session);
vi.mock("./checkout", () => checkout);
vi.mock("./cart", () => ({ addToCart: vi.fn(), CartError: Error, MAX_QUANTITY_PER_ITEM: 10 }));
vi.mock("@/server/providers/payments", () => payments);
vi.mock("@/server/rate-limit", () => rateLimits);
vi.mock("@/server/db", () => ({ db }));
vi.mock("next/navigation", () => navigation);
vi.mock("next/cache", () => ({ revalidatePath }));
vi.mock("@/modules/analytics/track", () => ({ track: vi.fn() }));

const BUYER = "0199a000-0000-7000-8000-00000000000a";
const OTHER = "0199a000-0000-7000-8000-00000000000f";
const ORDER = "0199a000-0000-7000-8000-00000000000b";
const CHECKOUT = "0199a000-0000-7000-8000-00000000000c";
const REF = "mock_0123456789abcdef0123456789abcdef";

beforeEach(() => {
  vi.clearAllMocks();
  payments.simulatedPaymentsEnabled.mockReturnValue(true);
  session.requireOnboardedViewer.mockResolvedValue({ userId: BUYER });
  db.payment.findUnique.mockResolvedValue({
    provider: "mock",
    status: "PENDING",
    amountCents: 359_800,
    currency: "MXN",
    checkoutId: CHECKOUT,
    checkout: { buyerId: BUYER },
  });
});

describe("simulatePaymentAction (SEC-01)", () => {
  it("sin pagos simulados permitidos responde 404 antes de tocar nada", async () => {
    payments.simulatedPaymentsEnabled.mockReturnValue(false);
    await expect(simulatePaymentAction(REF, "APPROVED")).rejects.toThrow("notFound");
    expect(session.requireOnboardedViewer).not.toHaveBeenCalled();
    expect(db.payment.findUnique).not.toHaveBeenCalled();
    expect(checkout.applyPaymentEvent).not.toHaveBeenCalled();
  });

  it("aplica el resultado con el monto exacto y un solo evento por pago", async () => {
    await expect(simulatePaymentAction(REF, "APPROVED")).rejects.toThrow(
      `redirect:/pedidos/${CHECKOUT}`,
    );
    expect(checkout.expireStaleCheckouts).toHaveBeenCalledWith(expect.any(Date), BUYER);
    expect(checkout.applyPaymentEvent).toHaveBeenCalledWith({
      provider: "mock",
      providerEventId: `sim_${REF}`,
      providerRef: REF,
      status: "APPROVED",
      amountCents: 359_800,
      currency: "MXN",
      payload: { simulated: true },
    });
  });

  it("un pago que ya no está pendiente no registra otro evento", async () => {
    db.payment.findUnique.mockResolvedValue({
      provider: "mock",
      status: "APPROVED",
      amountCents: 359_800,
      currency: "MXN",
      checkoutId: CHECKOUT,
      checkout: { buyerId: BUYER },
    });
    await expect(simulatePaymentAction(REF, "DECLINED")).rejects.toThrow("redirect:");
    expect(checkout.applyPaymentEvent).not.toHaveBeenCalled();
  });

  it("solo la persona que compra, solo pagos simulados y solo los dos resultados", async () => {
    session.requireOnboardedViewer.mockResolvedValue({ userId: OTHER });
    await expect(simulatePaymentAction(REF, "APPROVED")).rejects.toThrow("redirect:/pedidos");

    session.requireOnboardedViewer.mockResolvedValue({ userId: BUYER });
    db.payment.findUnique.mockResolvedValue({
      provider: "mercadopago",
      status: "PENDING",
      amountCents: 1,
      currency: "MXN",
      checkoutId: CHECKOUT,
      checkout: { buyerId: BUYER },
    });
    await expect(simulatePaymentAction(REF, "APPROVED")).rejects.toThrow("redirect:/pedidos");

    await expect(simulatePaymentAction(REF, "REFUNDED" as unknown as "APPROVED")).rejects.toThrow(
      "redirect:/pedidos",
    );
    expect(checkout.applyPaymentEvent).not.toHaveBeenCalled();
  });
});

describe("advanceOrderAction (SEC-25)", () => {
  it("solo acepta enviar o entregar", async () => {
    for (const to of ["CANCELLED", "PAID", "delivered", "DELIVERED ", ""]) {
      await advanceOrderAction(ORDER, to as "DELIVERED");
    }
    await advanceOrderAction("no-es-uuid", "SHIPPED");
    expect(checkout.advanceOrder).not.toHaveBeenCalled();

    await advanceOrderAction(ORDER, "DELIVERED");
    expect(checkout.advanceOrder).toHaveBeenCalledWith(BUYER, ORDER, "DELIVERED");
  });
});

describe("cancelOrderAction (SEC-25)", () => {
  it("cancela como la persona de la sesión", async () => {
    await cancelOrderAction("no-es-uuid");
    expect(checkout.cancelOrderBySeller).not.toHaveBeenCalled();
    await cancelOrderAction(ORDER);
    expect(checkout.cancelOrderBySeller).toHaveBeenCalledWith(BUYER, ORDER);
  });
});

describe("placeOrderAction (SEC-05)", () => {
  function checkoutForm() {
    const data = new FormData();
    data.append("cartKey", "k");
    data.append("paymentMethod", "CARD");
    data.append("delivery:seller-1", "PICKUP");
    return data;
  }

  it("con el límite de confirmaciones agotado no reserva nada", async () => {
    rateLimits.rateLimitMany.mockResolvedValueOnce({
      ok: false,
      retryAfterSeconds: 3_600,
    } as never);
    const state = await placeOrderAction({}, checkoutForm());
    expect(state.error).toBe("Demasiados intentos. Intenta de nuevo en 1 hora.");
    expect(state.values).toEqual({ paymentMethod: "CARD" });
    expect(checkout.placeOrder).not.toHaveBeenCalled();
    expect(rateLimits.rateLimitMany).toHaveBeenCalledWith([
      { key: `checkout:user:${BUYER}`, limit: 10, windowSeconds: 3_600 },
    ]);
  });

  it("traduce los topes de reserva a mensajes", async () => {
    checkout.placeOrder.mockRejectedValueOnce(new checkout.CheckoutError("TOO_MANY_PENDING"));
    expect((await placeOrderAction({}, checkoutForm())).error).toMatch(
      /Ya tienes 2 pedidos esperando pago/,
    );
    checkout.placeOrder.mockRejectedValueOnce(new checkout.CheckoutError("RESERVATION_LIMIT"));
    expect((await placeOrderAction({}, checkoutForm())).error).toMatch(/máximo de 10 piezas/);
  });
});
