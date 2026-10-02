import { describe, expect, it } from "vitest";
import type { AuthenticityStatus } from "@/generated/prisma/enums";
import { buyerAuthenticityView } from "@/modules/trust/status";
import type { AdCopy } from "../tasks/ad-copy";
import { composeAdKit } from "./compose";
import {
  type AdKitProduct,
  adKitAuthenticityClaim,
  allowedClaimsFor,
  factLines,
  factsFingerprint,
  mayClaimOriginal,
  PRICE_TOKEN,
} from "./facts";
import { guardAdCopy } from "./guard";

/**
 * P14 en el kit de anuncios: «original» solo con lo que dice la ficha. Con el comprobante pedido,
 * enviado sin revisar o rechazado, la ficha dice «Autenticidad sin verificar» y el anuncio no puede
 * decir «original» (ni en los textos de la IA, ni en las etiquetas, ni en las frases de datos).
 */
const base: AdKitProduct = {
  id: "0199a000-0000-7000-8000-000000000001",
  slug: "tenis-jordan-abc123",
  title: "Tenis Jordan 1",
  description: "Nuevos en caja.",
  priceCents: 250_000,
  currency: "MXN",
  categoryName: "Tenis",
  condition: "NEW",
  tags: ["jordan", "tenis"],
  facts: {
    status: "ACTIVE",
    stock: 2,
    city: "Guadalajara",
    state: "Jalisco",
    pickupAvailable: true,
    localDeliveryAvailable: false,
    localDeliveryZones: [],
    nationalShippingAvailable: false,
    shippingPriceCents: null,
    currency: "MXN",
    deliveryMinDays: null,
    deliveryMaxDays: null,
    warrantyType: "NONE",
    warrantyDays: null,
    returnWindowDays: 0,
    authenticity: "DECLARED_ORIGINAL",
    acceptedPaymentMethods: ["TRANSFER"],
  },
};

/** El producto con la revisión en `status`, con el mismo `claim` que calcula la ficha. */
function withReview(status: AuthenticityStatus | null, product: AdKitProduct = base) {
  const view = buyerAuthenticityView(
    product.facts.authenticity,
    status ? { status, riskLevel: status === "AUTO_CLEAR" ? "LOW" : "HIGH", signals: [] } : null,
  );
  return { ...product, facts: { ...product.facts, authenticityClaim: view.claim } };
}

const ORIGINAL_LINE = "Original (lo declara el vendedor)";

const originalCopy: AdCopy = {
  whatsapp: `¡Hola! Tengo Tenis Jordan 1 a ${PRICE_TOKEN}. Son originales.\nPuedes recogerlos en Guadalajara.`,
  facebook: `Tenis Jordan 1 a ${PRICE_TOKEN}. Son originales.`,
  instagram: { caption: "Originales y en caja.", hashtags: ["original", "jordan"] },
  headline: `Jordan 1 originales a ${PRICE_TOKEN}`,
};

describe("«original» en el kit de anuncios según la revisión de autenticidad (P14)", () => {
  it("comprobante pedido, enviado sin revisar o rechazado: no se permite «original»", () => {
    for (const status of ["NEEDS_PROOF", "PROOF_SUBMITTED", "REJECTED"] as const) {
      const product = withReview(status);
      expect(product.facts.authenticityClaim).toBe("unverified");
      expect(mayClaimOriginal(product.facts)).toBe(false);
      expect(allowedClaimsFor(product).has("authenticity")).toBe(false);
      expect(factLines(product)).not.toContain(ORIGINAL_LINE);
    }
  });

  it("sin riesgo, sin revisión o con el comprobante revisado: sí (lo declara el vendedor)", () => {
    for (const status of ["AUTO_CLEAR", null, "VERIFIED_BY_ADMIN"] as const) {
      const product = withReview(status);
      expect(mayClaimOriginal(product.facts)).toBe(true);
      expect(allowedClaimsFor(product).has("authenticity")).toBe(true);
      // Nunca una certificación: la frase es la declaración del vendedor, sin sello de speeaking.
      expect(factLines(product)).toContain(ORIGINAL_LINE);
      expect(factLines(product).join(" ")).not.toMatch(/speeaking|revisad|certific|garant/i);
    }
  });

  it("sin la revisión (el llamador no mandó `authenticityClaim`): no se afirma (falla cerrada)", () => {
    expect(base.facts.authenticityClaim).toBeUndefined();
    expect(mayClaimOriginal(base.facts)).toBe(false);
    expect(allowedClaimsFor(base).has("authenticity")).toBe(false);
    expect(factLines(base)).not.toContain(ORIGINAL_LINE);
  });

  it("un genérico nunca dice «original», aunque la revisión esté limpia", () => {
    const generic = withReview("AUTO_CLEAR", {
      ...base,
      facts: { ...base.facts, authenticity: "GENERIC" },
    });
    expect(allowedClaimsFor(generic).has("authenticity")).toBe(false);
    expect(factLines(generic)).toContain("Genérico o compatible, no de la marca original");
  });

  it("un kit guardado cuando se podía decir «original» se revisa al mostrarse y deja de decirlo", () => {
    // Se generó con la revisión limpia: el guardián dejó «originales» (estaba respaldado).
    const before = withReview("AUTO_CLEAR");
    const stored = guardAdCopy(originalCopy, before).copy;
    expect(stored.facebook).toContain("originales");
    expect(stored.instagram.hashtags).toContain("original");

    // Después un reporte o una edición subió el riesgo y se pidió comprobante. `viewOf`
    // (ad-kit/service.ts) vuelve a pasar los textos guardados por el guardián con los datos de hoy.
    for (const status of ["NEEDS_PROOF", "PROOF_SUBMITTED"] as const) {
      const now = withReview(status);
      const current = guardAdCopy(stored, now);
      const texts = composeAdKit(current.copy, now, "https://speeaking.com").map((v) => v.text);

      expect(texts.join("\n")).not.toMatch(/original/i);
      expect(current.copy.instagram.hashtags).toEqual(["jordan"]);
      expect(current.findings).toContain("claim");
      // Y el kit se marca para generar uno nuevo: los datos con que se hizo ya no son los de hoy.
      expect(factsFingerprint(now)).not.toBe(factsFingerprint(before));
    }

    // Con el comprobante revisado vuelve a poder decirse (sigue siendo lo que declara el vendedor).
    const reviewed = withReview("VERIFIED_BY_ADMIN");
    expect(guardAdCopy(stored, reviewed).copy.facebook).toContain("originales");
  });
});

describe("adKitAuthenticityClaim: el anuncio sale sin la nota de riesgo de la ficha", () => {
  const view = (status: AuthenticityStatus, riskLevel: "LOW" | "MEDIUM" | "HIGH") =>
    buyerAuthenticityView("DECLARED_ORIGINAL", {
      status,
      riskLevel,
      signals: [{ rule: "price_below_reference", weight: 0.3 }],
    });

  it("declarado de riesgo bajo o sin revisión: lo mismo que la ficha", () => {
    expect(adKitAuthenticityClaim(view("AUTO_CLEAR", "LOW"))).toBe("declared");
    expect(adKitAuthenticityClaim(buyerAuthenticityView("DECLARED_ORIGINAL", null))).toBe(
      "declared",
    );
  });

  it("comprobante revisado: «reviewed»; pedido o rechazado: «unverified»", () => {
    expect(adKitAuthenticityClaim(view("VERIFIED_BY_ADMIN", "LOW"))).toBe("reviewed");
    expect(adKitAuthenticityClaim(view("NEEDS_PROOF", "HIGH"))).toBe("unverified");
    expect(adKitAuthenticityClaim(view("REJECTED", "HIGH"))).toBe("unverified");
  });

  it("declarado con riesgo medio («Revisa: …» en la ficha): no se anuncia como original", () => {
    const medium = view("AUTO_CLEAR", "MEDIUM");
    expect(medium.claim).toBe("declared");
    expect(medium.note).not.toBeNull();
    const claim = adKitAuthenticityClaim(medium);
    expect(claim).toBe("unverified");
    const product = {
      ...base,
      facts: {
        ...base.facts,
        authenticity: "DECLARED_ORIGINAL" as const,
        authenticityClaim: claim,
      },
    };
    expect(mayClaimOriginal(product.facts)).toBe(false);
    expect(factLines(product)).not.toContain("Original (lo declara el vendedor)");
  });
});
