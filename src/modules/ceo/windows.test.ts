import { describe, expect, it } from "vitest";
import { aggregateWindow, successesOf } from "./windows";

const rows = [
  { day: "2026-10-01", key: "feed.commerce.ctr", value: 0.02, sampleSize: 1_000 },
  { day: "2026-10-02", key: "feed.commerce.ctr", value: 0.04, sampleSize: 3_000 },
  { day: "2026-10-01", key: "feed.impressions.visible", value: 4_000, sampleSize: 4_000 },
  { day: "2026-10-02", key: "feed.impressions.visible", value: 6_000, sampleSize: 6_000 },
  { day: "2026-10-02", key: "reports.per_1k_impressions", value: 2, sampleSize: 6_000 },
];

describe("ventanas de métricas", () => {
  it("las tasas se ponderan por su denominador (Σ numeradores ÷ Σ denominadores)", () => {
    const window = aggregateWindow(rows, "feed.commerce.ctr", ["2026-10-01", "2026-10-02"]);
    expect(window.value).toBeCloseTo(0.035);
    expect(window.sample).toBe(4_000);
    expect(successesOf("feed.commerce.ctr", window)).toBeCloseTo(140);
  });

  it("los conteos se suman", () => {
    expect(
      aggregateWindow(rows, "feed.impressions.visible", ["2026-10-01", "2026-10-02"]).value,
    ).toBe(10_000);
  });

  it("las tasas por mil regresan a conteos para las pruebas", () => {
    const window = aggregateWindow(rows, "reports.per_1k_impressions", ["2026-10-02"]);
    expect(successesOf("reports.per_1k_impressions", window)).toBeCloseTo(12);
  });

  it("sin filas no hay valor (nunca un 0 inventado)", () => {
    expect(aggregateWindow(rows, "feed.commerce.ctr", ["2026-10-05"])).toMatchObject({
      value: null,
      sample: 0,
      days: 0,
    });
  });

  it("las tasas traen cuánto varían sus días (los conteos no)", () => {
    const days = ["2026-10-01", "2026-10-02", "2026-10-03"];
    const perDay = days.map((day, index) => ({
      day,
      key: "reports.per_1k_impressions",
      value: [1, 1, 4][index]!,
      sampleSize: 10_000,
    }));
    const window = aggregateWindow(perDay, "reports.per_1k_impressions", days);
    // Reportes por día: 10, 10 y 40 (la tasa común es 2 por mil).
    expect(window.dispersion?.df).toBe(2);
    expect(window.dispersion!.chi2).toBeCloseTo((100 + 100 + 400) / (10_000 * 0.002 * 0.998), 5);
    expect(aggregateWindow(rows, "feed.impressions.visible", days).dispersion).toBeUndefined();
  });
});
