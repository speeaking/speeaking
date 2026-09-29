import { describe, expect, it } from "vitest";
import {
  communityTier,
  FEATURED_DAY_PRICE_CENTS,
  FEATURED_MAX_DAYS,
  FEATURED_MIN_DAYS,
  featuredCostCents,
  microsUsdToMxnCents,
  nextTier,
  STORE_TRIAL_TRY_ONS,
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

  it("recargas de la tienda: ids estables, montos positivos y bonos crecientes (ADR-046)", () => {
    expect(TOPUP_PACKS.map((pack) => pack.id)).toEqual(["tienda-99", "tienda-299", "tienda-799"]);
    expect(TOPUP_PACKS.map((pack) => pack.name)).toEqual(["Arranque", "Impulso", "Tienda pro"]);
    expect(topUpPack("tienda-299")).toMatchObject({ amountCents: 29_900, bonusCents: 2_990 });
    // El bono sube con la recarga (10 % y 15 %), nunca al revés.
    expect(topUpPack("tienda-799")!.bonusCents / 79_900).toBeCloseTo(0.15, 2);
    for (let index = 1; index < TOPUP_PACKS.length; index += 1) {
      expect(TOPUP_PACKS[index]!.amountCents).toBeGreaterThan(TOPUP_PACKS[index - 1]!.amountCents);
      expect(TOPUP_PACKS[index]!.bonusCents).toBeGreaterThan(TOPUP_PACKS[index - 1]!.bonusCents);
    }
    expect(topUpPack("recarga-39")).toBeNull();
    expect(STORE_TRIAL_TRY_ONS).toBe(10);
    expect(tryOnsAffordable(9_900, 350)).toBe(28);
    expect(tryOnsAffordable(100, 350)).toBe(0);
    expect(tryOnsAffordable(500, 0)).toBe(0);
  });

  it("destacar: por día, entre 3 y 30 días, siempre desde el saldo de la tienda", () => {
    expect(FEATURED_DAY_PRICE_CENTS).toBe(1_500);
    expect(featuredCostCents(FEATURED_MIN_DAYS)).toBe(4_500);
    expect(featuredCostCents(7)).toBe(10_500);
    expect(featuredCostCents(FEATURED_MAX_DAYS)).toBe(45_000);
    expect(featuredCostCents(2)).toBeNull();
    expect(featuredCostCents(31)).toBeNull();
    expect(featuredCostCents(2.5)).toBeNull();
  });
});
