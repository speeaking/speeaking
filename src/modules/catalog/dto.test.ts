import { describe, expect, it } from "vitest";
import { type PublicProductRow, toPublicProduct } from "./dto";

const row: PublicProductRow = {
  id: "0199a000-0000-7000-8000-000000000001",
  slug: "airpods-pro-2-demo",
  title: "AirPods Pro 2",
  description: "Nuevos y sellados.",
  priceCents: 349_900,
  currency: "MXN",
  condition: "NEW",
  tags: ["audífonos"],
  status: "ACTIVE",
  stock: 50,
  city: "Ciudad de México",
  state: "CDMX",
  pickupAvailable: true,
  localDeliveryAvailable: false,
  localDeliveryZones: [],
  nationalShippingAvailable: true,
  shippingPriceCents: 9_900,
  deliveryMinDays: 2,
  deliveryMaxDays: 5,
  warrantyType: "SELLER",
  warrantyDays: 90,
  returnWindowDays: 7,
  authenticity: "DECLARED_ORIGINAL",
  saveCount: 3,
  category: { slug: "audio", name: "Audio y audífonos" },
  seller: {
    userId: "0199a000-0000-7000-8000-000000000002",
    displayName: "Electro Demo",
    acceptedPaymentMethods: ["CARD"],
    user: { profile: { username: "demo.electro" } },
  },
};

describe("toPublicProduct (el costo nunca llega al navegador)", () => {
  it("no incluye el costo aunque la fila de la base de datos lo traiga", () => {
    const leakyRow = {
      ...row,
      cost: { unitCostCents: 240_000 },
      unitCostCents: 240_000,
      sellerId: "interno",
    } as PublicProductRow;

    const dto = toPublicProduct(leakyRow, []);
    const serialized = JSON.stringify(dto);

    expect(serialized).not.toMatch(/cost/i);
    expect(serialized).not.toContain("240000");
    expect(serialized).not.toContain("interno");
  });

  it("expone los datos verificables (P4) para las respuestas rápidas", () => {
    const dto = toPublicProduct(row, []);

    expect(dto.facts).toMatchObject({
      stock: 50,
      warrantyDays: 90,
      shippingPriceCents: 9_900,
      currency: "MXN",
      localDeliveryAvailable: false,
    });
    expect(dto.seller.username).toBe("demo.electro");
  });
});
