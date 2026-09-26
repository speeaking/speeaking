import { describe, expect, it } from "vitest";
import {
  clusteredRatio,
  compareClusteredRatios,
  designEffect,
  dispersionFactor,
  estimateIcc,
  normalCdf,
  pearsonDispersion,
  normalQuantile,
  proportionInterval,
  requiredSamplePerVariant,
  twoProportionZTest,
} from "./stats";

describe("normal estándar", () => {
  it("Φ y Φ⁻¹ con valores de tabla", () => {
    expect(normalCdf(0)).toBeCloseTo(0.5, 7);
    expect(normalCdf(1.959963984540054)).toBeCloseTo(0.975, 6);
    expect(normalCdf(-1.644853626951)).toBeCloseTo(0.05, 6);
    expect(normalQuantile(0.975)).toBeCloseTo(1.959964, 5);
    expect(normalQuantile(0.8)).toBeCloseTo(0.841621, 5);
    expect(normalQuantile(0.01)).toBeCloseTo(-2.326348, 5);
  });
});

describe("tamaño de muestra del plan (§2.4)", () => {
  it("efecto de diseño con 20 impresiones por persona y ρ = 0.05: 1.95", () => {
    expect(designEffect(20, 0.05)).toBeCloseTo(1.95, 10);
    expect(designEffect(1, 0.05)).toBe(1);
  });

  it("2.0 % → 2.4 % con α = 0.05 y 80 % de potencia: ≈ 21,100 si fueran independientes", () => {
    const n = requiredSamplePerVariant({ baselineRate: 0.02, relativeLift: 0.2 });
    expect(n).toBeGreaterThan(21_000);
    expect(n).toBeLessThan(21_200);
  });

  it("con el efecto de diseño: ≈ 41,000 impresiones visibles por variante", () => {
    const n = requiredSamplePerVariant({
      baselineRate: 0.02,
      relativeLift: 0.2,
      designEffect: designEffect(20, 0.05),
    });
    expect(n).toBeGreaterThan(40_500);
    expect(n).toBeLessThan(41_500);
  });
});

describe("prueba z de dos proporciones", () => {
  it("detecta una diferencia real y calcula p bilateral", () => {
    const test = twoProportionZTest({
      successesA: 200,
      trialsA: 10_000,
      successesB: 260,
      trialsB: 10_000,
    })!;
    expect(test.rateA).toBeCloseTo(0.02);
    expect(test.relativeChange).toBeCloseTo(0.3);
    expect(test.z).toBeCloseTo(2.82, 1);
    expect(test.pValue).toBeLessThan(0.01);
    expect(test.ci95[0]).toBeGreaterThan(0);
  });

  it("el efecto de diseño hace la prueba más conservadora", () => {
    const input = { successesA: 200, trialsA: 10_000, successesB: 245, trialsB: 10_000 };
    const plain = twoProportionZTest(input)!;
    const clustered = twoProportionZTest({ ...input, designEffect: 1.95 })!;
    expect(plain.pValue).toBeLessThan(0.05);
    expect(clustered.pValue).toBeGreaterThan(0.05);
    expect(clustered.standardError / plain.standardError).toBeCloseTo(Math.sqrt(1.95), 6);
  });

  it("cada lado con su efecto de diseño (ventanas de distinto largo)", () => {
    const input = { successesA: 800, trialsA: 40_000, successesB: 245, trialsB: 10_000 };
    const same = twoProportionZTest({ ...input, designEffect: 1.95 })!;
    const perArm = twoProportionZTest({ ...input, designEffectA: 8, designEffectB: 1.95 })!;
    expect(perArm.standardError).toBeGreaterThan(same.standardError);
    expect(perArm.pValue).toBeGreaterThan(same.pValue);
    expect(perArm.designEffect).toBe(8);
    const expected = Math.sqrt(
      ((800 + 245) / 50_000) * (1 - (800 + 245) / 50_000) * (8 / 40_000 + 1.95 / 10_000),
    );
    expect(perArm.standardError).toBeCloseTo(expected, 12);
  });

  it("sin muestra no hay prueba", () => {
    expect(
      twoProportionZTest({ successesA: 0, trialsA: 0, successesB: 1, trialsB: 10 }),
    ).toBeNull();
  });
});

describe("análisis por persona (clústeres)", () => {
  it("cociente y varianza robusta", () => {
    const ratio = clusteredRatio([
      { x: 1, n: 10 },
      { x: 3, n: 10 },
      { x: 0, n: 20 },
    ])!;
    expect(ratio.ratio).toBeCloseTo(0.1);
    expect(ratio.clusters).toBe(3);
    expect(ratio.variance).toBeGreaterThan(0);
    expect(clusteredRatio([{ x: 1, n: 10 }])).toBeNull();
  });

  it("ρ ≈ 0 si todas las personas se parecen y alto si cada una es de todo o nada", () => {
    const similar = Array.from({ length: 50 }, () => ({ x: 2, n: 20 }));
    expect(estimateIcc(similar)).toBe(0);
    const allOrNothing = Array.from({ length: 50 }, (_, i) => ({ x: i % 2 === 0 ? 20 : 0, n: 20 }));
    expect(estimateIcc(allOrNothing)!).toBeGreaterThan(0.9);
  });

  it("usa el error estándar más grande entre el robusto y el del efecto de diseño", () => {
    const control = Array.from({ length: 200 }, (_, i) => ({ x: i % 10 === 0 ? 3 : 0, n: 15 }));
    const treatment = Array.from({ length: 200 }, (_, i) => ({ x: i % 8 === 0 ? 3 : 0, n: 15 }));
    const comparison = compareClusteredRatios(control, treatment)!;
    expect(comparison.icc).toBeGreaterThanOrEqual(0.05);
    expect(comparison.standardError).toBeGreaterThanOrEqual(comparison.clusterStandardError);
    expect(comparison.relativeChange).toBeGreaterThan(0);
  });

  it("intervalo de una proporción", () => {
    const interval = proportionInterval(300, 1000)!;
    expect(interval.rate).toBeCloseTo(0.3);
    expect(interval.low).toBeCloseTo(0.2716, 3);
    expect(interval.high).toBeCloseTo(0.3284, 3);
  });
});

describe("sobredispersión entre unidades (cuasi-verosimilitud)", () => {
  it("días parecidos: cerca de lo que supone la prueba; un día atípico la dispara", () => {
    const steady = Array.from({ length: 7 }, () => ({ x: 20, n: 10_000 }));
    expect(dispersionFactor(pearsonDispersion(steady, "proportion"))).toBe(0);
    const spike = [...steady.slice(0, 6), { x: 80, n: 10_000 }];
    expect(dispersionFactor(pearsonDispersion(spike, "proportion"))!).toBeGreaterThan(15);
  });

  it("conteos por exposición (Poisson): varianza entre días ÷ media", () => {
    // Visitas por vendedor-día de 100 vendedores: 1,000 un día y 1,400 al siguiente.
    const days = [
      { x: 1_000, n: 100 },
      { x: 1_400, n: 100 },
      { x: 1_000, n: 100 },
      { x: 1_400, n: 100 },
    ];
    const dispersion = pearsonDispersion(days, "rate")!;
    expect(dispersion.df).toBe(3);
    // λ = 12 por vendedor-día; χ² = 4 × 200² ÷ 1,200.
    expect(dispersionFactor(dispersion)!).toBeCloseTo(400 / 9, 5);
  });

  it("una persona con todo en su cuenta infla la varianza de su grupo", () => {
    const people = Array.from({ length: 200 }, (_, i) => ({ x: i % 20 === 0 ? 1 : 0, n: 25 }));
    const quiet = dispersionFactor(pearsonDispersion(people, "proportion"))!;
    const withSpammer = dispersionFactor(
      pearsonDispersion([...people, { x: 25, n: 25 }], "proportion"),
    )!;
    expect(quiet).toBeLessThan(1.5);
    expect(withSpammer).toBeGreaterThan(10);
  });

  it("sin eventos, con una sola unidad o con muy pocos grados de libertad no hay medida", () => {
    expect(
      pearsonDispersion(
        [
          { x: 0, n: 10 },
          { x: 0, n: 20 },
        ],
        "proportion",
      ),
    ).toBeNull();
    expect(pearsonDispersion([{ x: 3, n: 10 }], "rate")).toBeNull();
    expect(
      pearsonDispersion(
        [
          { x: 3, n: 0 },
          { x: 1, n: 10 },
        ],
        "rate",
      ),
    ).toBeNull();
    const twoDays = pearsonDispersion(
      [
        { x: 1, n: 10 },
        { x: 5, n: 10 },
      ],
      "rate",
    );
    expect(twoDays?.df).toBe(1);
    expect(dispersionFactor(twoDays)).toBeNull();
  });
});
