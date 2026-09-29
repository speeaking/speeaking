import { describe, expect, it } from "vitest";
import { type FundingContext, fundingOptions } from "./funding";

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
  freeUsed: 0,
  freeLimit: 3,
  userBalanceCents: 1_000,
  userIsSponsor: false,
};

describe("orden de financiamiento de una prueba (ADR-044)", () => {
  it("patrocinio primero, luego gratis, luego saldo", () => {
    expect(fundingOptions(base).map((option) => option.funding)).toEqual([
      "SELLER_PAID",
      "PLATFORM",
      "USER_PAID",
    ]);
    expect(fundingOptions(base)[0]).toMatchObject({ sponsorSellerId: "s1", chargedCents: 350 });
  });

  it("el patrocinio se salta sin tope del día, sin saldo del vendedor o si vende quien prueba", () => {
    expect(
      fundingOptions({ ...base, sponsor: { ...base.sponsor!, spentTodayCents: 1_700 } })[0]
        ?.funding,
    ).toBe("PLATFORM");
    expect(
      fundingOptions({ ...base, sponsor: { ...base.sponsor!, balanceCents: 100 } })[0]?.funding,
    ).toBe("PLATFORM");
    expect(fundingOptions({ ...base, userIsSponsor: true })[0]?.funding).toBe("PLATFORM");
    expect(fundingOptions({ ...base, sponsor: null })[0]?.funding).toBe("PLATFORM");
  });

  it("sin gratis ni saldo no hay opciones (la interfaz ofrece recargar)", () => {
    expect(fundingOptions({ ...base, sponsor: null, freeUsed: 3, userBalanceCents: 300 })).toEqual(
      [],
    );
    expect(fundingOptions({ ...base, sponsor: null, freeUsed: 3, userBalanceCents: 350 })).toEqual([
      { funding: "USER_PAID", chargedCents: 350 },
    ]);
  });
});
