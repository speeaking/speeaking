import { describe, expect, it } from "vitest";
import type { CartLine } from "./cart";
import { toCartSheet } from "./cart-sheet";

const line = (n: number, overrides: Partial<CartLine["product"]> = {}, quantity = 1): CartLine => ({
  itemId: `item-${n}`,
  quantity,
  sourcePostId: null,
  product: {
    id: `0199a000-0000-7000-8000-0000000000${n.toString().padStart(2, "0")}`,
    slug: `producto-${n}`,
    title: `Producto ${n}`,
    priceCents: 10_000 * n,
    currency: "MXN",
    stock: 5,
    forSale: true,
    available: true,
    imageUrl: null,
    pickupAvailable: false,
    localDeliveryAvailable: false,
    localDeliveryZones: [],
    nationalShippingAvailable: true,
    shippingPriceCents: 9_900,
    ...overrides,
  },
  seller: { id: "s-1", displayName: "Tienda", paymentMethods: ["CARD"] },
});

describe("toCartSheet", () => {
  it("cuenta piezas, suma solo lo disponible y nunca incluye el costo", () => {
    const sheet = toCartSheet([line(1, {}, 2), line(2, { available: false }), line(3)]);

    expect(sheet.count).toBe(4);
    expect(sheet.subtotalCents).toBe(2 * 10_000 + 30_000);
    expect(sheet.currency).toBe("MXN");
    expect(sheet.lines.map((item) => item.slug)).toEqual([
      "producto-1",
      "producto-2",
      "producto-3",
    ]);
    expect(JSON.stringify(sheet)).not.toMatch(/cost|stock|seller/i);
  });

  it("vacío: cero piezas y la moneda del sitio", () => {
    expect(toCartSheet([])).toEqual({ count: 0, subtotalCents: 0, currency: "MXN", lines: [] });
  });
});
