import { describe, expect, it } from "vitest";
import { DEFAULT_FEED_POLICY } from "@/modules/feed/policy";
import {
  checkBounds,
  checkChange,
  classifyRisk,
  formatTunableValue,
  getTunable,
  isForbiddenSetting,
  stepValue,
  TUNABLES,
  withTunable,
} from "./tunables";

const tunable = (key: string) => getTunable(key)!;

describe("catálogo de parámetros (plan §2.4)", () => {
  it("tiene los límites, pasos y riesgos de la tabla del plan", () => {
    expect(
      TUNABLES.map(({ key, min, max, step, risk }) => ({ key, min, max, step, risk })),
    ).toEqual([
      {
        key: "feed.policy.recencyHalfLifeHours",
        min: 6,
        max: 168,
        step: { type: "relative", max: 0.2 },
        risk: "LOW",
      },
      {
        key: "feed.policy.explorationShare",
        min: 0,
        max: 0.5,
        step: { type: "absolute", max: 0.05 },
        risk: "LOW",
      },
      {
        key: "feed.policy.authorWindow",
        min: 2,
        max: 10,
        step: { type: "absolute", max: 1 },
        risk: "LOW",
      },
      {
        key: "feed.policy.commerceSlotEvery",
        min: 3,
        max: 12,
        step: { type: "absolute", max: 1 },
        risk: "MEDIUM",
      },
      {
        key: "feed.policy.minGapBetweenCommerce",
        min: 2,
        max: 12,
        step: { type: "absolute", max: 1 },
        risk: "MEDIUM",
      },
    ]);
  });

  it("los límites del catálogo nunca son más amplios que los del esquema de la política", () => {
    for (const item of TUNABLES) {
      expect(withTunable(DEFAULT_FEED_POLICY, item, item.min)).not.toBeNull();
      expect(withTunable(DEFAULT_FEED_POLICY, item, item.max)).not.toBeNull();
    }
  });
});

describe("clasificación de riesgo (código, nunca la IA)", () => {
  it("comercio en cualquier dirección es riesgo medio; pesos del feed, bajo", () => {
    expect(classifyRisk("feed.policy.commerceSlotEvery")).toBe("MEDIUM");
    expect(classifyRisk("feed.policy.recencyHalfLifeHours")).toBe("LOW");
  });

  it("dinero, autonomía, ajustes desconocidos o sin ajuste: ALTO", () => {
    for (const key of [
      "commerce.fees.platformFeeBps",
      "ai.budget",
      "ai.budget.seedMonthlyUsd",
      "payments.provider",
      "platform.autonomy",
      "feed.policy.version",
      "otro.ajuste",
      null,
    ]) {
      expect(classifyRisk(key)).toBe("HIGH");
    }
  });

  it("pagos, precios, comisiones y gasto están fuera del alcance del motor", () => {
    expect(isForbiddenSetting("commerce.fees")).toBe(true);
    expect(isForbiddenSetting("ai.budget")).toBe(true);
    expect(isForbiddenSetting("pricing.anything")).toBe(true);
    expect(isForbiddenSetting("feed.policy.authorWindow")).toBe(false);
  });
});

describe("límites y paso máximo", () => {
  it("respeta el ±20 % relativo de la vida media", () => {
    const recency = tunable("feed.policy.recencyHalfLifeHours");
    expect(checkChange(recency, 36, 43.2).ok).toBe(true);
    expect(checkChange(recency, 36, 43.3).ok).toBe(false);
    expect(checkChange(recency, 36, 28.8).ok).toBe(true);
    expect(checkChange(recency, 36, 28.7).ok).toBe(false);
  });

  it("respeta los pasos absolutos y los enteros", () => {
    const slot = tunable("feed.policy.commerceSlotEvery");
    expect(checkChange(slot, 4, 5).ok).toBe(true);
    expect(checkChange(slot, 4, 6).ok).toBe(false);
    expect(checkChange(slot, 4, 4.5).ok).toBe(false);
    expect(checkChange(slot, 4, 4).ok).toBe(false);
    const exploration = tunable("feed.policy.explorationShare");
    expect(checkChange(exploration, 0.2, 0.25).ok).toBe(true);
    expect(checkChange(exploration, 0.2, 0.26).ok).toBe(false);
  });

  it("nunca sale de los límites", () => {
    const slot = tunable("feed.policy.commerceSlotEvery");
    expect(checkBounds(slot, 2).ok).toBe(false);
    expect(checkBounds(slot, 13).ok).toBe(false);
    expect(checkBounds(slot, Number.NaN).ok).toBe(false);
    expect(checkBounds(slot, "5").ok).toBe(false);
  });

  it("propone un paso redondeado hacia el valor actual y se detiene en el límite", () => {
    expect(stepValue(tunable("feed.policy.recencyHalfLifeHours"), 36, -1)).toBe(28.8);
    expect(stepValue(tunable("feed.policy.recencyHalfLifeHours"), 37, 1)).toBe(44.4);
    expect(stepValue(tunable("feed.policy.explorationShare"), 0.2, -1)).toBe(0.15);
    expect(stepValue(tunable("feed.policy.explorationShare"), 0.2, 1)).toBe(0.25);
    expect(stepValue(tunable("feed.policy.explorationShare"), 0.02, -1)).toBe(0);
    expect(stepValue(tunable("feed.policy.commerceSlotEvery"), 12, 1)).toBeNull();
    expect(stepValue(tunable("feed.policy.commerceSlotEvery"), 3, -1)).toBeNull();
    expect(stepValue(tunable("feed.policy.recencyHalfLifeHours"), 168, 1)).toBeNull();
  });

  it("muestra los valores en su unidad", () => {
    expect(formatTunableValue(tunable("feed.policy.recencyHalfLifeHours"), 28.8)).toBe("28.8 h");
    expect(formatTunableValue(tunable("feed.policy.explorationShare"), 0.15)).toBe("15 %");
    expect(formatTunableValue(tunable("feed.policy.commerceSlotEvery"), 5)).toBe("5 posiciones");
  });
});
