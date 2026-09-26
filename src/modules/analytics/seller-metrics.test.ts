import { describe, expect, it } from "vitest";
import { conversionRate, sellerActivationSteps } from "./seller-metrics";

describe("conversionRate", () => {
  it("pedidos entre visitas, en porcentaje", () => {
    expect(conversionRate({ orders: 3, visits: 120 })).toBeCloseTo(2.5);
  });

  it("sin visitas la conversión es 0 (no infinito)", () => {
    expect(conversionRate({ orders: 0, visits: 0 })).toBe(0);
    expect(conversionRate({ orders: 2, visits: 0 })).toBe(0);
  });
});

describe("sellerActivationSteps", () => {
  it("marca el avance del vendedor hacia su primera venta", () => {
    const steps = sellerActivationSteps({ products: 1, shares: 0, paidOrders: 0 });

    expect(steps.map((step) => step.done)).toEqual([true, true, false, false]);
    expect(steps.find((step) => !step.done)?.id).toBe("share");
  });
});
