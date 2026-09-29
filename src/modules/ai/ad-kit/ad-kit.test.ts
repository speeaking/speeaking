import { describe, expect, it } from "vitest";
import type { AdCopy } from "../tasks/ad-copy";
import { adCopyTask } from "../tasks/ad-copy";
import { composeAdKit, productShareUrl } from "./compose";
import {
  type AdKitProduct,
  adCopyInput,
  allowedClaimsFor,
  factLines,
  factsFingerprint,
  PRICE_TOKEN,
} from "./facts";
import { guardAdCopy } from "./guard";

const product: AdKitProduct = {
  id: "0199a000-0000-7000-8000-000000000001",
  slug: "audifonos-anc-abc123",
  title: "Audífonos inalámbricos",
  description: "Audífonos con cancelación de ruido. Llámame al 55 1234 5678.",
  priceCents: 89_900,
  currency: "MXN",
  categoryName: "Audio y audífonos",
  condition: "NEW",
  tags: ["audifonos", "bluetooth"],
  facts: {
    status: "ACTIVE",
    stock: 4,
    city: "Ciudad de México",
    state: "CDMX",
    pickupAvailable: false,
    localDeliveryAvailable: false,
    localDeliveryZones: [],
    nationalShippingAvailable: true,
    shippingPriceCents: 9_900,
    currency: "MXN",
    deliveryMinDays: 3,
    deliveryMaxDays: 5,
    warrantyType: "SELLER",
    warrantyDays: 30,
    returnWindowDays: 0,
    authenticity: "NOT_APPLICABLE",
    acceptedPaymentMethods: ["CASH_ON_DELIVERY"],
  },
};

const honest: AdCopy = {
  whatsapp: `¡Hola! Tengo Audífonos inalámbricos a ${PRICE_TOKEN}.\nTienen garantía del vendedor y envío a todo México.`,
  facebook: "Audífonos inalámbricos a $899. Ideales para el transporte público.",
  instagram: {
    caption: "Silencio para tu trayecto diario.",
    hashtags: ["#Audífonos", "bluetooth", "envíogratis", "original", "cdmx", "cdmx"],
  },
  headline: "Audífonos a $899",
};

describe("datos del producto (P4)", () => {
  it("las frases de datos salen de las columnas, con las cifras del checkout", () => {
    expect(factLines(product)).toEqual([
      "Nuevo",
      "+ $99 de envío a todo México · 3 a 5 días",
      "Garantía del vendedor por 30 días",
    ]);
  });

  it("solo se permiten las afirmaciones que respaldan los datos", () => {
    expect([...allowedClaimsFor(product)].sort()).toEqual([
      "delivery_days",
      "national_shipping",
      "warranty",
    ]);
  });

  it("lo que recibe la IA no lleva el costo ni datos de contacto", () => {
    const { system, user } = adCopyTask.messages(adCopyInput(product));
    expect(`${system}${user}`).not.toMatch(/1234|cost|unitCost/i);
    expect(user).toContain("[teléfono]");
    expect(user).toContain("$899");
  });

  it("la huella cambia si cambian el precio o un dato verificable", () => {
    const base = factsFingerprint(product);
    expect(factsFingerprint({ ...product, priceCents: 99_900 })).not.toBe(base);
    expect(
      factsFingerprint({ ...product, facts: { ...product.facts, warrantyType: "NONE" } }),
    ).not.toBe(base);
    expect(factsFingerprint({ ...product, facts: { ...product.facts, stock: 1 } })).toBe(base);
  });
});

describe("guardAdCopy", () => {
  it("conserva lo que respaldan los datos y pone [PRECIO] en lugar del precio escrito", () => {
    const { copy, removed } = guardAdCopy(honest, product);

    expect(copy.whatsapp).toBe(honest.whatsapp);
    expect(copy.facebook).toBe(
      `Audífonos inalámbricos a ${PRICE_TOKEN}. Ideales para el transporte público.`,
    );
    expect(copy.headline).toBe(`Audífonos a ${PRICE_TOKEN}`);
    // Etiquetas sin #, sin repetir y sin afirmaciones que el producto no tiene.
    expect(copy.instagram.hashtags).toEqual(["audifonos", "bluetooth", "cdmx"]);
    expect(removed).toBe(2);
  });

  it("quita afirmaciones sin respaldo, urgencia, contacto y otras cifras", () => {
    const { copy, findings } = guardAdCopy(
      {
        ...honest,
        whatsapp:
          "¡Últimas 2 piezas! Son originales. Llegan en 24 horas. Antes $1,299. Escríbeme a mitienda.com. Suenan increíble.",
        facebook: "Te llegan en 10 días con devolución gratis.",
      },
      product,
    );

    expect(copy.whatsapp).toBe("Suenan increíble.");
    // Si no queda nada, un texto determinista con el nombre y el precio.
    expect(copy.facebook).toBe(
      `Audífonos inalámbricos a ${PRICE_TOKEN}. Pregúntame lo que quieras.`,
    );
    expect(findings).toEqual(expect.arrayContaining(["urgency", "claim", "number", "contact"]));
  });

  it("con los datos que sí tiene, «original» y «envío gratis» se quedan", () => {
    const original: AdKitProduct = {
      ...product,
      facts: {
        ...product.facts,
        authenticity: "DECLARED_ORIGINAL",
        authenticityClaim: "declared",
        shippingPriceCents: 0,
      },
    };
    const { copy } = guardAdCopy(
      {
        ...honest,
        facebook: "Son originales y con envío gratis a todo México.",
        instagram: { caption: "Originales.", hashtags: ["original", "envíogratis"] },
      },
      original,
    );

    expect(copy.facebook).toBe("Son originales y con envío gratis a todo México.");
    expect(copy.instagram.hashtags).toEqual(["original", "enviogratis"]);
  });
});

describe("composeAdKit", () => {
  it("arma las 4 variantes con el precio VIGENTE, los datos y la liga con atribución", () => {
    const { copy } = guardAdCopy(honest, product);
    const current = { ...product, priceCents: 79_900 };
    const variants = composeAdKit(copy, current, "https://vendeia.mx");

    expect(variants.map((variant) => variant.channel)).toEqual([
      "whatsapp",
      "facebook",
      "instagram",
      "headline",
    ]);
    const [whatsapp, facebook, instagram, headline] = variants;
    expect(whatsapp!.text).toContain("$799");
    expect(whatsapp!.text).not.toContain("$899");
    expect(whatsapp!.text).not.toContain(PRICE_TOKEN);
    expect(whatsapp!.text).toContain("+ $99 de envío a todo México · 3 a 5 días");
    expect(
      whatsapp!.text.endsWith(
        "https://vendeia.mx/producto/audifonos-anc-abc123?ref=compartir&canal=whatsapp",
      ),
    ).toBe(true);
    expect(facebook!.shareUrl).toContain("canal=facebook");
    // Instagram no abre ligas en el pie de foto: lleva etiquetas y la liga va aparte.
    expect(instagram!.text).toContain("#audifonos #bluetooth #cdmx");
    expect(instagram!.text).not.toContain("https://");
    expect(headline!.text).toBe("Audífonos a $799");
  });

  it("si el modelo no dejó dónde va el precio, el precio encabeza los datos (P4)", () => {
    const { copy } = guardAdCopy(
      {
        ...honest,
        whatsapp: "¡Hola! Tengo estos audífonos con cancelación de ruido. Escríbeme por aquí.",
        instagram: { caption: "Silencio para tu trayecto diario.", hashtags: ["audifonos"] },
      },
      product,
    );
    const [whatsapp, , instagram] = composeAdKit(copy, product, "https://vendeia.mx");
    expect(whatsapp!.text).toContain("\n\n$899 · Nuevo · + $99 de envío a todo México");
    expect(instagram!.text).toContain("\n\n$899 · Nuevo · ");
    expect(whatsapp!.text.match(/\$899/g)).toHaveLength(1);
  });

  it("la liga escapa el slug", () => {
    expect(productShareUrl("https://vendeia.mx", "a b", "headline")).toBe(
      "https://vendeia.mx/producto/a%20b?ref=compartir&canal=headline",
    );
  });
});
