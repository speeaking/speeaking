import { describe, expect, it } from "vitest";
import { type EditableProductRow, editFormDefaults } from "./form-defaults";
import { parseProductForm } from "./schemas";

const row: EditableProductRow = {
  title: "AirPods Pro 2",
  description: "Audífonos con cancelación de ruido, nuevos y sellados.",
  priceCents: 349_950,
  stock: 12,
  categoryId: "0199a000-0000-7000-8000-000000000001",
  condition: "NEW",
  tags: ["audífonos", "apple"],
  city: "Ciudad de México",
  state: "CDMX",
  pickupAvailable: true,
  localDeliveryZones: ["Coyoacán", "Benito Juárez"],
  nationalShippingAvailable: true,
  shippingPriceCents: 9_900,
  deliveryMinDays: 2,
  deliveryMaxDays: 5,
  warrantyType: "SELLER",
  warrantyDays: 90,
  returnWindowDays: 15,
  authenticity: "DECLARED_ORIGINAL",
  cost: { unitCostCents: 240_000 },
};

const media = [
  { id: "0199a000-0000-7000-8000-000000000009", url: "/m/1.webp", width: 4, height: 5 },
];

/** Lo que enviaría el formulario tal como se abrió, sin que el vendedor toque nada. */
function submitUnchanged(defaults: ReturnType<typeof editFormDefaults>) {
  const data = new FormData();
  const fields: Record<string, string | boolean | undefined> = {
    title: defaults.title,
    description: defaults.description,
    price: defaults.price,
    cost: defaults.cost,
    stock: defaults.stock,
    tags: defaults.tags,
    categoryId: defaults.categoryId,
    condition: defaults.condition,
    city: defaults.city,
    state: defaults.state,
    localDeliveryZones: defaults.localDeliveryZones,
    shippingPrice: defaults.shippingPrice,
    deliveryMinDays: defaults.deliveryMinDays,
    deliveryMaxDays: defaults.deliveryMaxDays,
    warrantyType: defaults.warrantyType,
    warrantyDays: defaults.warrantyDays,
    returnWindowDays: defaults.returnWindowDays,
    authenticity: defaults.authenticity,
  };
  for (const [key, value] of Object.entries(fields)) {
    if (typeof value === "string") data.append(key, value);
  }
  if (defaults.pickupAvailable) data.append("pickupAvailable", "on");
  if (defaults.nationalShippingAvailable) data.append("nationalShippingAvailable", "on");
  for (const item of defaults.initialMedia ?? []) data.append("mediaIds", item.id);
  return parseProductForm(data);
}

describe("editFormDefaults", () => {
  it("prellena con los mismos textos que escribe el vendedor, incluido su costo privado", () => {
    expect(editFormDefaults(row, media)).toMatchObject({
      price: "3499.50",
      cost: "2400",
      stock: "12",
      tags: "audífonos, apple",
      localDeliveryZones: "Coyoacán, Benito Juárez",
      shippingPrice: "99",
      warrantyDays: "90",
      returnWindowDays: "15",
      initialMedia: media,
    });
  });

  it("guardar sin cambios conserva exactamente los mismos datos", () => {
    const result = submitUnchanged(editFormDefaults(row, media));

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data).toMatchObject({
      priceCents: row.priceCents,
      unitCostCents: 240_000,
      stock: row.stock,
      tags: row.tags,
      localDeliveryZones: row.localDeliveryZones,
      shippingPriceCents: row.shippingPriceCents,
      deliveryMinDays: 2,
      deliveryMaxDays: 5,
      warrantyType: "SELLER",
      warrantyDays: 90,
      returnWindowDays: 15,
      mediaIds: [media[0]!.id],
    });
  });

  it("sin envío nacional ni días de garantía no inventa datos al guardar", () => {
    const defaults = editFormDefaults(
      {
        ...row,
        nationalShippingAvailable: false,
        shippingPriceCents: null,
        deliveryMinDays: null,
        deliveryMaxDays: null,
        warrantyType: "MANUFACTURER",
        warrantyDays: null,
        cost: null,
      },
      media,
    );
    expect(defaults).toMatchObject({ shippingPrice: "", warrantyDays: "", cost: "0" });

    const result = submitUnchanged(defaults);
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data).toMatchObject({
      nationalShippingAvailable: false,
      shippingPriceCents: null,
      deliveryMinDays: null,
      deliveryMaxDays: null,
      warrantyDays: null,
    });
  });
});
