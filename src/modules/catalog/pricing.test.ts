import { describe, expect, it } from "vitest";
import { breakEvenUnits, centsToPesosInput, parsePesosToCents, unitEconomics } from "./pricing";

describe("unitEconomics (P2: el código calcula)", () => {
  it("calcula el margen del ejemplo de los AirPods", () => {
    const result = unitEconomics({ priceCents: 349_900, unitCostCents: 240_000 });

    expect(result.grossMarginCents).toBe(109_900);
    expect(result.grossMarginPercent).toBeCloseTo(31.41, 2);
    expect(result.netMarginCents).toBe(109_900);
  });

  it("descuenta comisión de plataforma y del procesador de pago", () => {
    const result = unitEconomics({
      priceCents: 349_900,
      unitCostCents: 240_000,
      platformFeeBps: 500, // 5 %
      paymentFeeBps: 350, // 3.5 %
    });

    expect(result.platformFeeCents).toBe(17_495);
    expect(result.paymentFeeCents).toBe(12_247);
    expect(result.netMarginCents).toBe(109_900 - 17_495 - 12_247);
  });

  it("detecta cuando se vende con pérdida", () => {
    const result = unitEconomics({ priceCents: 100_000, unitCostCents: 120_000 });

    expect(result.netMarginCents).toBe(-20_000);
    expect(result.isLoss).toBe(true);
  });

  it("rechaza montos no enteros o negativos (el dinero siempre va en centavos enteros)", () => {
    expect(() => unitEconomics({ priceCents: 10.5, unitCostCents: 0 })).toThrow();
    expect(() => unitEconomics({ priceCents: -1, unitCostCents: 0 })).toThrow();
  });
});

describe("breakEvenUnits", () => {
  it("con $300 diarios por 30 días y $1,099 de margen se necesitan 9 ventas para cubrir la publicidad", () => {
    expect(breakEvenUnits({ spendCents: 30_000 * 30, netMarginCents: 109_900 })).toBe(9);
  });

  it("sin margen positivo no hay punto de equilibrio", () => {
    expect(breakEvenUnits({ spendCents: 1_000, netMarginCents: 0 })).toBeNull();
    expect(breakEvenUnits({ spendCents: 1_000, netMarginCents: -5 })).toBeNull();
  });

  it("sin gasto no se necesitan ventas para cubrirlo", () => {
    expect(breakEvenUnits({ spendCents: 0, netMarginCents: 100 })).toBe(0);
  });
});

describe("parsePesosToCents", () => {
  it.each([
    ["3499", 349_900],
    ["3,499", 349_900],
    ["$3,499.50", 349_950],
    [" 2 400 ", 240_000],
    ["0", 0],
  ])("convierte %j a centavos", (input, expected) => {
    expect(parsePesosToCents(input)).toBe(expected);
  });

  it.each(["", "abc", "-5", "1.234", "99999999999"])("rechaza %j", (input) => {
    expect(parsePesosToCents(input)).toBeNull();
  });
});

describe("centsToPesosInput", () => {
  it.each([
    [349_900, "3499"],
    [349_950, "3499.50"],
    [81_347, "813.47"],
    [5, "0.05"],
    [0, "0"],
  ])("convierte %j centavos a %j", (cents, expected) => {
    expect(centsToPesosInput(cents)).toBe(expected);
    expect(parsePesosToCents(centsToPesosInput(cents))).toBe(cents);
  });

  it("rechaza montos que no son centavos enteros", () => {
    expect(() => centsToPesosInput(10.5)).toThrow();
    expect(() => centsToPesosInput(-1)).toThrow();
  });
});
