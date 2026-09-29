import { describe, expect, it } from "vitest";
import type { AuthenticityStatus, RiskLevel } from "@/generated/prisma/enums";
import { type PublicProductRow, toPublicProduct } from "./dto";
import { answerQuickQuestion } from "./quick-answers";

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
    id: "0199a000-0000-7000-8000-0000000000e2",
    userId: "0199a000-0000-7000-8000-000000000002",
    displayName: "Electro Demo",
    acceptedPaymentMethods: ["CARD"],
    user: { profile: { username: "demo.electro" } },
  },
  // Sin revisión todavía: se muestra lo que declaró el vendedor.
  authenticityCheck: null,
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

  it("autenticidad (P14): con comprobante pedido oculta «original» y nunca expone las señales", () => {
    const dto = toPublicProduct(
      {
        ...row,
        authenticityCheck: {
          status: "NEEDS_PROOF",
          riskLevel: "HIGH",
          signals: [
            {
              rule: "price_below_reference",
              weight: 0.4,
              message: "El precio ($300) está muy por debajo de la referencia aproximada.",
            },
            { rule: "buyer_reports", weight: 0.15, message: "1 reporte de compradores." },
          ],
        },
      },
      [],
    );
    expect(dto.authenticityReview).toMatchObject({
      claim: "unverified",
      label: "Autenticidad sin verificar",
      note: "Revisa: el precio es muy inferior al de productos similares.",
    });
    const serialized = JSON.stringify(dto);
    expect(serialized).not.toMatch(/referencia aproximada|reporte|weight|riskLevel|signals/);

    // Sin revisión (productos anteriores a P14): lo que declaró el vendedor, como antes.
    expect(toPublicProduct(row, []).authenticityReview.claim).toBe("declared");
  });

  describe("«¿Es original?» sale de la misma revisión que la etiqueta de la ficha (P14)", () => {
    const withCheck = (
      status: AuthenticityStatus | null,
      authenticity: PublicProductRow["authenticity"] = "DECLARED_ORIGINAL",
      riskLevel: RiskLevel = status === "AUTO_CLEAR" ? "LOW" : "HIGH",
    ) => {
      const dto = toPublicProduct(
        {
          ...row,
          authenticity,
          authenticityCheck: status ? { status, riskLevel, signals: [] } : null,
        },
        [],
      );
      return { dto, answer: answerQuickQuestion("authenticity", dto.facts) };
    };
    const DECLARED =
      "El vendedor declara que es original. No es una verificación de la plataforma.";

    it("comprobante pedido o enviado sin revisar: «sin verificar» en la ficha y en la respuesta", () => {
      for (const status of ["NEEDS_PROOF", "PROOF_SUBMITTED"] as const) {
        const { dto, answer } = withCheck(status);
        expect(dto.facts.authenticityClaim).toBe("unverified");
        expect(dto.authenticityReview.label).toBe("Autenticidad sin verificar");
        expect(answer).toBe(`${dto.authenticityReview.label}. ${dto.authenticityReview.detail}`);
        expect(answer).not.toMatch(/declara que es original/);
      }
    });

    it("declarado original otra vez tras un rechazo: también «sin verificar»", () => {
      const { dto, answer } = withCheck("REJECTED");
      expect(dto.facts.authenticityClaim).toBe("unverified");
      expect(answer.startsWith("Autenticidad sin verificar.")).toBe(true);
    });

    it("comprobante revisado: el texto aprobado (no es garantía), igual que el detalle de la ficha", () => {
      const { dto, answer } = withCheck("VERIFIED_BY_ADMIN");
      expect(dto.facts.authenticityClaim).toBe("reviewed");
      expect(dto.authenticityReview.label).toBe("Comprobante revisado por Estreno");
      expect(answer).toBe(dto.authenticityReview.detail);
      expect(answer).toMatch(/No es una certificación ni una garantía/);
    });

    it("sin riesgo, riesgo medio o sin revisión: lo declarado (la ficha no pone etiqueta)", () => {
      for (const [status, level] of [
        ["AUTO_CLEAR", "LOW"],
        ["AUTO_CLEAR", "MEDIUM"],
        [null, "LOW"],
      ] as const) {
        const { dto, answer } = withCheck(status, "DECLARED_ORIGINAL", level);
        expect(dto.facts.authenticityClaim).toBe("declared");
        expect(dto.authenticityReview.label).toBeNull();
        expect(answer).toBe(DECLARED);
      }
    });

    it("genérico: siempre «genérico o compatible», sin etiqueta de autenticidad", () => {
      for (const status of ["AUTO_CLEAR", "NEEDS_PROOF", "REJECTED"] as const) {
        const { dto, answer } = withCheck(status, "GENERIC");
        expect(dto.facts.authenticityClaim).toBe("declared");
        expect(dto.authenticityReview.label).toBeNull();
        expect(answer).toBe("Es un producto genérico o compatible, no de la marca original.");
      }
    });
  });
});
