import { describe, expect, it } from "vitest";
import { describeFunding, type FundingContext, fundingOptions, fundingStatus } from "./funding";

const base: FundingContext = {
  priceCents: 350,
  sponsor: {
    sellerId: "s1",
    userId: "u-seller",
    enabled: true,
    dailyCapCents: 2_000,
    spentTodayCents: 0,
    balanceCents: 5_000,
  },
  trialUsed: 0,
  trialLimit: 10,
};

describe("quién paga una prueba (ADR-046): la tienda, nunca quien compra", () => {
  it("primero la tienda con saldo y tope; después las pruebas de cortesía de Estreno", () => {
    expect(fundingOptions(base).map((option) => option.funding)).toEqual([
      "SELLER_PAID",
      "PLATFORM",
    ]);
    expect(fundingOptions(base)[0]).toMatchObject({ sponsorSellerId: "s1", chargedCents: 350 });
    expect(fundingStatus(base)).toBe("sponsored");
  });

  it("sin tope del día, sin saldo o sin activar, quedan las pruebas de cortesía de la tienda", () => {
    expect(
      fundingOptions({ ...base, sponsor: { ...base.sponsor!, spentTodayCents: 1_700 } }),
    ).toEqual([{ funding: "PLATFORM", chargedCents: 0 }]);
    expect(fundingOptions({ ...base, sponsor: { ...base.sponsor!, balanceCents: 100 } })).toEqual([
      { funding: "PLATFORM", chargedCents: 0 },
    ]);
    expect(fundingStatus({ ...base, sponsor: { ...base.sponsor!, enabled: false } })).toBe("trial");
    expect(fundingStatus({ ...base, sponsor: null })).toBe("trial");
  });

  it("con la cortesía agotada y sin tienda que pague, no hay opciones: la demanda se registra", () => {
    expect(fundingOptions({ ...base, sponsor: null, trialUsed: 10 })).toEqual([]);
    expect(fundingStatus({ ...base, sponsor: null, trialUsed: 10 })).toBe("none");
    // Quien compra nunca aparece como quien paga.
    expect(
      fundingOptions(base)
        .map((option) => option.funding)
        .includes("USER_PAID" as never),
    ).toBe(false);
  });

  it("describe cada financiamiento para la persona", () => {
    expect(describeFunding("SELLER_PAID")).toBe("Cortesía de la tienda");
    expect(describeFunding("PLATFORM")).toBe("Cortesía de Estreno");
    expect(describeFunding("USER_PAID")).toBe("Pagada con saldo");
  });
});
