import { describe, expect, it } from "vitest";
import { addDays } from "@/modules/platform/calendar";
import {
  assessTrafficThreshold,
  minSampleFor,
  NOT_VISIBLE_REASON,
  windowClusterSize,
} from "./threshold";

function series(lastDay: string, perDay: (offset: number) => number | undefined, days = 14) {
  const map = new Map<string, number>();
  for (let offset = 0; offset < days; offset++) {
    const value = perDay(offset);
    if (value !== undefined) map.set(addDays(lastDay, -offset), value);
  }
  return map;
}

describe("muestra mínima", () => {
  it("con los supuestos del plan da ≈ 41,000 por variante", () => {
    const assumptions = minSampleFor({});
    expect(assumptions.baselineRateSource).toBe("assumed");
    expect(assumptions.designEffect).toBeCloseTo(1.95);
    expect(assumptions.minSamplePerVariant).toBeGreaterThan(40_500);
    expect(assumptions.minSamplePerVariant).toBeLessThan(41_500);
  });

  it("usa lo medido solo con muestra suficiente, y ρ nunca por debajo de 0.05", () => {
    const measured = minSampleFor({
      baselineRate: 0.05,
      baselineSample: 5_000,
      impressionsPerPerson: 10,
      viewers: 200,
      icc: 0.01,
    });
    expect(measured.baselineRateSource).toBe("measured");
    expect(measured.impressionsPerPersonSource).toBe("measured");
    expect(measured.icc).toBe(0.05);
    const tooSmall = minSampleFor({ baselineRate: 0.05, baselineSample: 100 });
    expect(tooSmall.baselineRate).toBe(0.02);
  });
});

describe("tamaño del clúster por ventana (efecto de diseño)", () => {
  it("es lo que junta una persona en toda la ventana, no el promedio diario", () => {
    // 100 personas que regresan 7 días con 10 impresiones diarias: m = 70, no 10.
    expect(windowClusterSize({ viewers: 100, personalImpressions: 7_000 })).toEqual({
      m: 70,
      source: "measured",
    });
  });

  it("con pocas personas usa el supuesto del plan (m = 20)", () => {
    expect(windowClusterSize({ viewers: 5, personalImpressions: 400 })).toEqual({
      m: 20,
      source: "assumed",
    });
  });
});

describe("umbral de tráfico (2 × muestra en ≤ 14 días, 2 semanas seguidas)", () => {
  const lastDay = "2026-10-20";
  const minSamplePerVariant = 41_000;

  it("≈ 5,900 impresiones al día", () => {
    const result = assessTrafficThreshold({
      lastDay,
      dailyImpressions: new Map(),
      minSamplePerVariant,
      impressionsVisible: true,
    });
    expect(result.requiredPerDay).toBe(5_858);
    expect(result.met).toBe(false);
  });

  it("se cumple con dos semanas completas por encima del mínimo", () => {
    const result = assessTrafficThreshold({
      lastDay,
      dailyImpressions: series(lastDay, () => 6_000),
      minSamplePerVariant,
      impressionsVisible: true,
    });
    expect(result.met).toBe(true);
    expect(result.daysWithData).toBe(14);
  });

  it("no se cumple si una de las dos semanas no alcanza (o faltan días)", () => {
    const weak = assessTrafficThreshold({
      lastDay,
      dailyImpressions: series(lastDay, (offset) => (offset < 7 ? 9_000 : 3_000)),
      minSamplePerVariant,
      impressionsVisible: true,
    });
    expect(weak.met).toBe(false);
    const missing = assessTrafficThreshold({
      lastDay,
      dailyImpressions: series(lastDay, (offset) => (offset < 7 ? 12_000 : undefined)),
      minSamplePerVariant,
      impressionsVisible: true,
    });
    expect(missing.met).toBe(false);
    expect(missing.reason).toMatch(/^Tráfico insuficiente/);
  });

  it("con piezas servidas (sin impresiones visibles) nunca se da por cumplido", () => {
    const served = assessTrafficThreshold({
      lastDay,
      dailyImpressions: series(lastDay, () => 60_000),
      minSamplePerVariant,
      impressionsVisible: false,
    });
    expect(served).toMatchObject({ met: false, enoughTraffic: true, impressionsVisible: false });
    expect(served.reason.startsWith(NOT_VISIBLE_REASON)).toBe(true);
  });
});
