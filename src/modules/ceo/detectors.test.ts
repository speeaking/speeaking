import { describe, expect, it } from "vitest";
import { DEFAULT_FEED_POLICY } from "@/modules/feed/policy";
import { type AnalystInput, runDetectors } from "./detectors";
import type { WindowValue } from "./windows";

function rate(value: number, sample: number, days = 7): WindowValue {
  return { value, sample, numerator: value * sample, days };
}

function per1k(value: number, sample: number, days = 7): WindowValue {
  return { value, sample, numerator: value * sample, days };
}

/** Semana reciente y línea base de 28 días idénticas y sanas: ninguna señal. */
function steady(): Map<string, WindowValue> {
  return new Map(
    Object.entries({
      "feed.commerce.ctr": rate(0.02, 20_000),
      "feed.commerce.share": rate(0.24, 80_000),
      "feed.engagement.rate": rate(0.08, 80_000),
      "not_interested.per_1k_impressions": per1k(5, 80_000),
      "reports.per_1k_impressions": per1k(1, 80_000),
    }),
  );
}

function input(recent: Record<string, WindowValue>, baseline = steady()): AnalystInput {
  return {
    day: "2026-10-20",
    recent: new Map([...steady(), ...Object.entries(recent)]),
    baseline,
    policy: DEFAULT_FEED_POLICY,
    designEffect: 1.95,
  };
}

describe("detectores del analista", () => {
  it("sin señales no propone nada", () => {
    expect(runDetectors(input({}))).toEqual([]);
  });

  it("una caída significativa del CTR comercial propone espaciar el comercio (riesgo medio, un paso)", () => {
    const [proposal, ...rest] = runDetectors(input({ "feed.commerce.ctr": rate(0.015, 20_000) }));
    expect(rest).toEqual([]);
    expect(proposal).toMatchObject({
      detector: "commerce_ctr_drop",
      settingKey: "feed.policy.commerceSlotEvery",
      previousValue: 4,
      newValue: 5,
      risk: "MEDIUM",
    });
    expect(proposal!.hypothesis).toMatch(/bajó 25 %/);
    expect(proposal!.facts.pValue).toBeLessThan(0.05);
  });

  it("no decide con ruido: una caída pequeña o con poca muestra no propone nada", () => {
    expect(runDetectors(input({ "feed.commerce.ctr": rate(0.019, 20_000) }))).toEqual([]);
    expect(runDetectors(input({ "feed.commerce.ctr": rate(0.01, 300) }))).toEqual([]);
    expect(runDetectors(input({ "feed.commerce.ctr": rate(0.015, 20_000, 3) }))).toEqual([]);
  });

  it("interacción a la baja: más peso a lo reciente (riesgo bajo, −20 %)", () => {
    const [proposal] = runDetectors(input({ "feed.engagement.rate": rate(0.06, 80_000) }));
    expect(proposal).toMatchObject({
      detector: "engagement_drop",
      settingKey: "feed.policy.recencyHalfLifeHours",
      previousValue: 36,
      newValue: 28.8,
      risk: "LOW",
    });
  });

  it("con el efecto de diseño de cada ventana (personas que regresan varios días) no decide con ruido", () => {
    const drop = { "feed.engagement.rate": rate(0.07, 80_000) };
    // Con m diario (1.95 en ambos lados) la caída de 12.5 % parece clarísima…
    expect(runDetectors(input(drop))).toHaveLength(1);
    // …pero si cada persona junta ≈ 140 impresiones en 7 días y ≈ 580 en 28, no es significativa.
    expect(runDetectors({ ...input(drop), designEffect: 8, baselineDesignEffect: 30 })).toEqual([]);
  });

  it("si los días varían mucho entre sí (sobredispersión medida), tampoco decide con ruido", () => {
    const drop = { "feed.engagement.rate": rate(0.07, 80_000) };
    expect(runDetectors(input(drop))).toHaveLength(1);
    // Los 28 días de la línea base varían ~40 veces más de lo que explica el azar (χ²/gl = 40).
    const noisyBaseline = steady();
    noisyBaseline.set("feed.engagement.rate", {
      ...rate(0.08, 80_000, 28),
      dispersion: { chi2: 1_080, df: 27 },
    });
    expect(runDetectors(input(drop, noisyBaseline))).toEqual([]);
  });

  it("«No me interesa» al alza: menos exploración (riesgo bajo, −0.05)", () => {
    const [proposal] = runDetectors(
      input({ "not_interested.per_1k_impressions": per1k(7, 80_000) }),
    );
    expect(proposal).toMatchObject({
      settingKey: "feed.policy.explorationShare",
      previousValue: 0.2,
      newValue: 0.15,
      risk: "LOW",
    });
  });

  it("contenido comercial cerca de 30 %: espaciar el comercio", () => {
    const [proposal] = runDetectors(input({ "feed.commerce.share": rate(0.3, 80_000) }));
    expect(proposal).toMatchObject({ detector: "commerce_share_high", newValue: 5 });
  });

  it("reportes al alza: solo propuesta de riesgo alto, sin tocar ningún ajuste", () => {
    const [proposal] = runDetectors(input({ "reports.per_1k_impressions": per1k(1.6, 80_000) }));
    expect(proposal).toMatchObject({
      detector: "reports_rise",
      settingKey: null,
      newValue: null,
      risk: "HIGH",
    });
  });

  it("a lo más una propuesta por ajuste (gana la de mayor prioridad)", () => {
    const proposals = runDetectors(
      input({
        "feed.commerce.share": rate(0.3, 80_000),
        "feed.commerce.ctr": rate(0.015, 20_000),
      }),
    );
    expect(proposals.map((proposal) => proposal.detector)).toEqual(["commerce_share_high"]);
  });

  it("no propone pasar del límite", () => {
    const atLimit = { ...input({ "feed.commerce.ctr": rate(0.015, 20_000) }) };
    atLimit.policy = { ...DEFAULT_FEED_POLICY, commerceSlotEvery: 12 };
    expect(runDetectors(atLimit)).toEqual([]);
  });
});
