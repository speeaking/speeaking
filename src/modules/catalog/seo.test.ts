import { describe, expect, it } from "vitest";
import { type PublicProductRow, toPublicProduct } from "./dto";
import { placeSeo, productSeoDescription, productSeoTitle, productStructuredData } from "./seo";

const row: PublicProductRow = {
  id: "0199a000-0000-7000-8000-000000000001",
  slug: "vela-personalizada-demo",
  title: "Vela personalizada",
  description: "Velas de soya con aroma y nombre a tu gusto, hechas en casa.",
  priceCents: 11_000,
  currency: "MXN",
  condition: "NEW",
  tags: ["velas"],
  status: "ACTIVE",
  stock: 100,
  city: "Guadalajara",
  state: "Jalisco",
  pickupAvailable: true,
  localDeliveryAvailable: false,
  localDeliveryZones: [],
  nationalShippingAvailable: true,
  shippingPriceCents: 2_500,
  deliveryMinDays: 2,
  deliveryMaxDays: 5,
  warrantyType: "NONE",
  warrantyDays: null,
  returnWindowDays: 7,
  authenticity: "NOT_APPLICABLE",
  saveCount: 0,
  category: { slug: "decoracion", name: "Decoración y plantas" },
  seller: {
    id: "0199a000-0000-7000-8000-0000000000e2",
    userId: "0199a000-0000-7000-8000-000000000002",
    displayName: "Velas Demo",
    acceptedPaymentMethods: ["CARD"],
    user: { profile: { username: "velas.demo" } },
  },
  authenticityCheck: null,
};

const product = (changes: Partial<PublicProductRow> = {}) =>
  toPublicProduct({ ...row, ...changes }, []);

describe("productStructuredData: lo que lee Google, solo con datos que declaró el vendedor (P4)", () => {
  it("el envío a todo México va en la oferta: costo, destino y días de entrega", () => {
    expect(productStructuredData(product()).offers.shippingDetails).toEqual({
      "@type": "OfferShippingDetails",
      shippingRate: { "@type": "MonetaryAmount", value: "25.00", currency: "MXN" },
      shippingDestination: { "@type": "DefinedRegion", addressCountry: "MX" },
      deliveryTime: {
        "@type": "ShippingDeliveryTime",
        transitTime: { "@type": "QuantitativeValue", minValue: 2, maxValue: 5, unitCode: "DAY" },
      },
    });
  });

  it("envío gratis cuesta 0 y, sin días declarados, no se inventa el tiempo de entrega", () => {
    const shipping = productStructuredData(
      product({ shippingPriceCents: 0, deliveryMinDays: null, deliveryMaxDays: null }),
    ).offers.shippingDetails;

    expect(shipping?.shippingRate.value).toBe("0.00");
    expect(shipping).not.toHaveProperty("deliveryTime");
  });

  it("sin envío nacional (o sin tarifa, como en el checkout) no hay datos de envío", () => {
    for (const changes of [
      { nationalShippingAvailable: false },
      { nationalShippingAvailable: true, shippingPriceCents: null },
    ]) {
      expect(productStructuredData(product(changes)).offers).not.toHaveProperty("shippingDetails");
    }
  });

  it("las devoluciones dicen lo mismo que la ficha: N días o no acepta", () => {
    expect(productStructuredData(product()).offers.hasMerchantReturnPolicy).toEqual({
      "@type": "MerchantReturnPolicy",
      applicableCountry: "MX",
      returnPolicyCategory: "https://schema.org/MerchantReturnFiniteReturnWindow",
      merchantReturnDays: 7,
    });
    expect(
      productStructuredData(product({ returnWindowDays: 0 })).offers.hasMerchantReturnPolicy,
    ).toEqual({
      "@type": "MerchantReturnPolicy",
      applicableCountry: "MX",
      returnPolicyCategory: "https://schema.org/MerchantReturnNotPermitted",
    });
  });

  it("dice desde dónde se vende (ciudad y estado públicos, nunca la dirección)", () => {
    expect(productStructuredData(product()).offers.availableAtOrFrom).toEqual({
      "@type": "Place",
      address: {
        "@type": "PostalAddress",
        addressLocality: "Guadalajara",
        addressRegion: "Jalisco",
        addressCountry: "MX",
      },
    });
  });
});

describe("título y descripción de la ficha para buscadores", () => {
  it("con envío nacional, el título lo dice", () => {
    expect(productSeoTitle(product())).toBe("Vela personalizada · $110 · Envío a todo México");
    expect(productSeoTitle(product({ nationalShippingAvailable: false }))).toBe(
      "Vela personalizada · $110",
    );
  });

  it("la descripción empieza con el envío y el lugar, y sigue con la del vendedor", () => {
    expect(productSeoDescription(product())).toBe(
      "Envío a todo México por $25 (2 a 5 días). Se vende desde Guadalajara, Jalisco. Velas de soya con aroma y nombre a tu gusto, hechas en casa.",
    );
    expect(productSeoDescription(product({ shippingPriceCents: 0, deliveryMinDays: null }))).toBe(
      "Envío gratis a todo México. Se vende desde Guadalajara, Jalisco. Velas de soya con aroma y nombre a tu gusto, hechas en casa.",
    );
  });

  it("sin envío nacional solo dice el lugar; la ciudad no se repite si es igual al estado", () => {
    expect(
      productSeoDescription(
        product({ nationalShippingAvailable: false, city: "CDMX", state: "cdmx" }),
      ),
    ).toBe("Se vende desde CDMX. Velas de soya con aroma y nombre a tu gusto, hechas en casa.");
  });
});

describe("placeSeo: título y descripción de «Comprar en …» (las búsquedas «… en Jalisco»)", () => {
  it("por estado: dice el lugar y cuántos productos hay (cifra del código)", () => {
    expect(placeSeo({ stateName: "Jalisco", count: 12 })).toEqual({
      title: "Compra en Jalisco: productos de vendedores de Jalisco",
      description:
        "12 productos de vendedores de Jalisco en speeaking. Revisa fotos, precio y envío de cada tienda, y pregunta antes de comprar.",
      heading: "Compra en Jalisco",
    });
  });

  it("por categoría y estado", () => {
    expect(
      placeSeo({ stateName: "Nuevo León", categoryName: "Decoración y plantas", count: 7 }),
    ).toEqual({
      title: "Decoración y plantas en Nuevo León",
      description:
        "7 productos de decoración y plantas de vendedores de Nuevo León en speeaking. Revisa fotos, precio y envío de cada tienda, y pregunta antes de comprar.",
      heading: "Decoración y plantas en Nuevo León",
    });
  });
});
