import { describe, expect, it } from "vitest";
import { MAX_PRODUCT_IMAGES, parseProductForm, productSlug } from "./schemas";

const uuid = "0199a000-0000-7000-8000-000000000001";

function form(overrides: Record<string, string | string[]> = {}) {
  const values: Record<string, string | string[]> = {
    title: "AirPods Pro 2",
    description: "Audífonos con cancelación de ruido, nuevos y sellados.",
    price: "3,499",
    cost: "2,400",
    stock: "50",
    categoryId: uuid,
    condition: "NEW",
    tags: "audífonos, apple, audífonos",
    city: "Ciudad de México",
    state: "CDMX",
    pickupAvailable: "on",
    localDeliveryZones: "Coyoacán, Benito Juárez",
    nationalShippingAvailable: "on",
    shippingPrice: "99",
    deliveryMinDays: "2",
    deliveryMaxDays: "5",
    warrantyType: "SELLER",
    warrantyDays: "90",
    returnWindowDays: "7",
    authenticity: "DECLARED_ORIGINAL",
    mediaIds: [uuid],
    ...overrides,
  };
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) {
    for (const item of Array.isArray(value) ? value : [value]) data.append(key, item);
  }
  return data;
}

describe("parseProductForm", () => {
  it("convierte pesos a centavos y estructura los datos verificables (P4)", () => {
    const result = parseProductForm(form());

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data).toMatchObject({
      priceCents: 349_900,
      unitCostCents: 240_000,
      stock: 50,
      tags: ["audífonos", "apple"],
      localDeliveryAvailable: true,
      localDeliveryZones: ["Coyoacán", "Benito Juárez"],
      shippingPriceCents: 9_900,
      deliveryMinDays: 2,
      deliveryMaxDays: 5,
      warrantyDays: 90,
    });
  });

  it("exige al menos una foto y un precio mayor a cero", () => {
    expect(parseProductForm(form({ mediaIds: [] })).success).toBe(false);
    expect(parseProductForm(form({ price: "0" })).success).toBe(false);
  });

  it(`acepta hasta ${MAX_PRODUCT_IMAGES} fotos en el orden en que llegan`, () => {
    const ids = Array.from(
      { length: MAX_PRODUCT_IMAGES + 1 },
      (_, index) => `0199a000-0000-7000-8000-${String(index).padStart(12, "0")}`,
    );
    const result = parseProductForm(form({ mediaIds: ids.slice(0, MAX_PRODUCT_IMAGES) }));

    expect(MAX_PRODUCT_IMAGES).toBe(10);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.mediaIds).toEqual(ids.slice(0, MAX_PRODUCT_IMAGES));
    expect(parseProductForm(form({ mediaIds: ids })).success).toBe(false);
  });

  it("si hay envío nacional, exige costo y días coherentes", () => {
    expect(parseProductForm(form({ deliveryMinDays: "6", deliveryMaxDays: "3" })).success).toBe(
      false,
    );
    expect(parseProductForm(form({ shippingPrice: "" })).success).toBe(false);
    expect(parseProductForm(form({ shippingPrice: "0" })).success).toBe(true);
  });

  it("sin envío nacional ignora sus campos", () => {
    const data = form();
    data.delete("nationalShippingAvailable");
    data.set("shippingPrice", "");
    const result = parseProductForm(data);

    expect(result.success).toBe(true);
    if (result.success) expect(result.data.shippingPriceCents).toBeNull();
  });

  it("la garantía del vendedor requiere días", () => {
    expect(parseProductForm(form({ warrantyDays: "" })).success).toBe(false);
    expect(parseProductForm(form({ warrantyType: "NONE", warrantyDays: "" })).success).toBe(true);
  });
});

describe("productSlug", () => {
  it("genera URLs legibles sin acentos", () => {
    expect(productSlug("Maceta de barro pintada a mano", "k3j9x2")).toBe(
      "maceta-de-barro-pintada-a-mano-k3j9x2",
    );
    expect(productSlug("¡¡!!", "abc123")).toBe("producto-abc123");
  });
});
