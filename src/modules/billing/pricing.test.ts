import { describe, expect, it } from "vitest";
import {
  communityTier,
  FREE_TRY_ONS_PER_MONTH,
  microsUsdToMxnCents,
  nextTier,
  TOPUP_PACKS,
  topUpPack,
  TRY_ON_TIERS,
  tryOnPrice,
  tryOnsAffordable,
} from "./pricing";

/** US$0.07 por imagen (Nano Banana 2 en OpenRouter, 2026-09-29) a 18 pesos por dólar. */
const COST = { unitCostMicrosUsd: 70_000, mxnPerUsd: 18 };

describe("precio comunitario de Pruébatelo (ADR-044)", () => {
  it("la tabla baja de precio conforme sube el volumen y los umbrales van en orden", () => {
    for (let index = 1; index < TRY_ON_TIERS.length; index += 1) {
      expect(TRY_ON_TIERS[index]!.minMonthlyTryOns).toBeGreaterThan(
        TRY_ON_TIERS[index - 1]!.minMonthlyTryOns,
      );
      expect(TRY_ON_TIERS[index]!.priceCents).toBeLessThan(TRY_ON_TIERS[index - 1]!.priceCents);
    }
  });

  it("elige el nivel por el volumen del mes anterior", () => {
    expect(communityTier(0).level).toBe(1);
    expect(communityTier(4_999).level).toBe(1);
    expect(communityTier(5_000).level).toBe(2);
    expect(communityTier(49_999).level).toBe(2);
    expect(communityTier(50_000).level).toBe(3);
    expect(communityTier(500_000).level).toBe(4);
    expect(communityTier(9_999_999).level).toBe(4);
    expect(communityTier(-5).level).toBe(1);
    expect(nextTier(communityTier(500_000))).toBeNull();
  });

  it("el precio del nivel 1 es $3.50 y dice cuándo baja a $3.00", () => {
    const price = tryOnPrice({ monthlyTryOns: 120, ...COST });
    expect(price).toMatchObject({
      level: 1,
      levels: 4,
      priceCents: 350,
      floored: false,
      nextLevelAt: 5_000,
      nextPriceCents: 300,
      monthlyTryOns: 120,
    });
  });

  it("nunca vende por debajo de 1.5 veces el costo: con un proveedor caro se cobra el piso", () => {
    // US$0.25 por imagen → $4.50 MXN de costo → piso $6.75, por encima de toda la tabla.
    const price = tryOnPrice({ monthlyTryOns: 600_000, unitCostMicrosUsd: 250_000, mxnPerUsd: 18 });
    expect(price.floored).toBe(true);
    expect(price.priceCents).toBe(675);
    expect(price.nextPriceCents).toBeNull();
    expect(price.level).toBe(4);
  });

  it("con el costo de referencia el piso queda debajo de todos los niveles (margen positivo)", () => {
    const floor = tryOnPrice({ monthlyTryOns: 0, ...COST }).floorCents;
    expect(floor).toBe(189);
    for (const tier of TRY_ON_TIERS) expect(tier.priceCents).toBeGreaterThan(floor);
  });

  it("convierte micro-dólares a centavos redondeando hacia arriba", () => {
    expect(microsUsdToMxnCents(70_000, 18)).toBe(126);
    expect(microsUsdToMxnCents(1, 18)).toBe(1);
    expect(microsUsdToMxnCents(0, 18)).toBe(0);
  });

  it("recargas: ids estables, montos positivos y bonos crecientes; 3 pruebas gratis al mes", () => {
    expect(TOPUP_PACKS.map((pack) => pack.id)).toEqual(["recarga-39", "recarga-99", "recarga-199"]);
    expect(topUpPack("recarga-99")).toMatchObject({ amountCents: 9_900, bonusCents: 495 });
    expect(topUpPack("recarga-1")).toBeNull();
    expect(FREE_TRY_ONS_PER_MONTH).toBe(3);
    expect(tryOnsAffordable(3_900, 350)).toBe(11);
    expect(tryOnsAffordable(100, 350)).toBe(0);
    expect(tryOnsAffordable(500, 0)).toBe(0);
  });
});
