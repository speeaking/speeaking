import { describe, expect, it } from "vitest";
import type { DeliveryMethod, OrderStatus } from "@/generated/prisma/enums";
import { canSellerMoveOrder, sellerOrderActions, sellerTransitionWhere } from "./order-transitions";

const order = (status: OrderStatus, deliveryMethod: DeliveryMethod) => ({ status, deliveryMethod });

describe("canSellerMoveOrder (SEC-25)", () => {
  it("enviar: solo un pedido pagado que se envía", () => {
    expect(canSellerMoveOrder(order("PAID", "NATIONAL_SHIPPING"), "SHIPPED")).toBe(true);
    expect(canSellerMoveOrder(order("PAID", "LOCAL_DELIVERY"), "SHIPPED")).toBe(true);
    expect(canSellerMoveOrder(order("PAID", "PICKUP"), "SHIPPED")).toBe(false);
    expect(canSellerMoveOrder(order("SHIPPED", "NATIONAL_SHIPPING"), "SHIPPED")).toBe(false);
  });

  it("entregar: un envío nacional no se marca entregado sin pasar por enviado", () => {
    expect(canSellerMoveOrder(order("PAID", "NATIONAL_SHIPPING"), "DELIVERED")).toBe(false);
    expect(canSellerMoveOrder(order("PAID", "LOCAL_DELIVERY"), "DELIVERED")).toBe(false);
    expect(canSellerMoveOrder(order("SHIPPED", "NATIONAL_SHIPPING"), "DELIVERED")).toBe(true);
    expect(canSellerMoveOrder(order("PAID", "PICKUP"), "DELIVERED")).toBe(true);
  });

  it("cancelar: solo antes de enviar", () => {
    expect(canSellerMoveOrder(order("PAID", "NATIONAL_SHIPPING"), "CANCELLED")).toBe(true);
    expect(canSellerMoveOrder(order("PAID", "PICKUP"), "CANCELLED")).toBe(true);
    for (const status of ["SHIPPED", "DELIVERED", "CANCELLED", "PENDING_PAYMENT"] as const) {
      expect(canSellerMoveOrder(order(status, "NATIONAL_SHIPPING"), "CANCELLED")).toBe(false);
    }
  });

  it("nada sale de un pedido sin pagar, cancelado o entregado", () => {
    for (const status of ["PENDING_PAYMENT", "CANCELLED", "DELIVERED"] as const) {
      for (const to of ["SHIPPED", "DELIVERED", "CANCELLED"] as const) {
        expect(canSellerMoveOrder(order(status, "PICKUP"), to)).toBe(false);
      }
    }
  });
});

describe("sellerOrderActions (SEC-01, SEC-25)", () => {
  const actions = (status: OrderStatus, deliveryMethod: DeliveryMethod, simulatedPayment: boolean) =>
    sellerOrderActions({ status, deliveryMethod, simulatedPayment });

  it("cobro real: enviar y entregar según la tabla; cancelar no, porque exige reembolso", () => {
    expect(actions("PAID", "NATIONAL_SHIPPING", false)).toEqual(["SHIPPED"]);
    expect(actions("SHIPPED", "NATIONAL_SHIPPING", false)).toEqual(["DELIVERED"]);
    expect(actions("PAID", "PICKUP", false)).toEqual(["DELIVERED"]);
    expect(actions("DELIVERED", "PICKUP", false)).toEqual([]);
  });

  it("pago simulado: nunca se envía ni se entrega, solo se cancela antes de enviar", () => {
    expect(actions("PAID", "NATIONAL_SHIPPING", true)).toEqual(["CANCELLED"]);
    expect(actions("PAID", "PICKUP", true)).toEqual(["CANCELLED"]);
    expect(actions("SHIPPED", "NATIONAL_SHIPPING", true)).toEqual([]);
    expect(actions("CANCELLED", "NATIONAL_SHIPPING", true)).toEqual([]);
  });
});

describe("sellerTransitionWhere", () => {
  it("traduce la misma tabla a la condición del updateMany", () => {
    expect(sellerTransitionWhere("DELIVERED")).toEqual({
      OR: [
        { status: "SHIPPED", deliveryMethod: { in: ["NATIONAL_SHIPPING", "LOCAL_DELIVERY"] } },
        { status: "PAID", deliveryMethod: { in: ["PICKUP"] } },
      ],
    });
  });
});
