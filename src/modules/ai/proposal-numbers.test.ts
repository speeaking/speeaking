import { describe, expect, it } from "vitest";
import {
  charmPrice,
  MAX_PROPOSAL_CENTS,
  suggestedDailyBudgetCents,
  suggestedPriceRange,
  withCodeNumbers,
} from "./proposal-numbers";
import { saleProposalSchema } from "./sale-proposal";

describe("cifras de la propuesta calculadas por código (P2, SEC-28)", () => {
  it("rango de prueba: 5 % abajo y 3 % arriba, terminado en 9", () => {
    expect(charmPrice(332_400)).toBe(332_900);
    expect(suggestedPriceRange(349_900)).toEqual({ minCents: 332_900, maxCents: 360_900 });
  });

  it("el rango nunca pasa del tope de montos", () => {
    const range = suggestedPriceRange(MAX_PROPOSAL_CENTS);
    expect(range.maxCents).toBe(MAX_PROPOSAL_CENTS);
    expect(range.minCents).toBeLessThanOrEqual(range.maxCents);
  });

  it("presupuesto diario: 30 % de lo que ganas por pieza, entre $50 y $300", () => {
    expect(suggestedDailyBudgetCents({ priceCents: 349_900, costCents: 240_000 })).toBe(30_000);
    expect(suggestedDailyBudgetCents({ priceCents: 45_000, costCents: 18_000 })).toBe(8_100);
    // Con pérdida no baja del mínimo de prueba (la tarjeta de números ya la marca en rojo).
    expect(suggestedDailyBudgetCents({ priceCents: 10_000, costCents: 20_000 })).toBe(5_000);
  });

  it("reemplaza las cifras inventadas por la IA antes de validar (el PoC de la auditoría)", () => {
    const hostile = {
      suggestedPriceRange: { minCents: 9_999_999_900, maxCents: 100, rationale: "Confía" },
      suggestedDailyBudgetCents: Number.MAX_SAFE_INTEGER,
    };
    expect(withCodeNumbers(hostile, { priceCents: 2_000_000, costCents: 1_500_000 })).toEqual({
      suggestedPriceRange: { minCents: 1_900_900, maxCents: 2_060_900, rationale: "Confía" },
      suggestedDailyBudgetCents: 30_000,
    });
  });

  it("deja pasar lo que no es un objeto (el esquema lo rechaza después)", () => {
    expect(withCodeNumbers("texto", { priceCents: 1, costCents: 0 })).toBe("texto");
  });
});

describe("saleProposalSchema rechaza cifras imposibles (defensa en profundidad)", () => {
  const range = (minCents: number, maxCents: number) =>
    saleProposalSchema.shape.suggestedPriceRange.safeParse({ minCents, maxCents, rationale: "" })
      .success;

  it("mínimo mayor que el máximo o fuera del tope", () => {
    expect(range(100, 200)).toBe(true);
    expect(range(200, 100)).toBe(false);
    expect(range(100, MAX_PROPOSAL_CENTS + 1)).toBe(false);
    expect(
      saleProposalSchema.shape.suggestedDailyBudgetCents.safeParse(Number.MAX_SAFE_INTEGER).success,
    ).toBe(false);
  });
});
