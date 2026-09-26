import { describe, expect, it } from "vitest";
import { aiBudgetSchema, aiCoverageRatio, DEFAULT_AI_BUDGET, monthlyAiLimitMicros } from "./budget";

const USD = 1_000_000;

describe("monthlyAiLimitMicros", () => {
  it("sin ingresos, el límite es el presupuesto semilla", () => {
    expect(monthlyAiLimitMicros(DEFAULT_AI_BUDGET, 0)).toBe(50 * USD);
  });

  it("crece con un porcentaje de los ingresos del mes anterior", () => {
    // 50 USD semilla + 20 % de 1,000 USD = 250 USD
    expect(monthlyAiLimitMicros(DEFAULT_AI_BUDGET, 1_000 * USD)).toBe(250 * USD);
  });

  it("nunca supera el tope duro", () => {
    expect(monthlyAiLimitMicros(DEFAULT_AI_BUDGET, 1_000_000 * USD)).toBe(500 * USD);
  });

  it("ignora ingresos negativos (devoluciones que superan ventas)", () => {
    expect(monthlyAiLimitMicros(DEFAULT_AI_BUDGET, -100 * USD)).toBe(50 * USD);
  });
});

describe("aiCoverageRatio", () => {
  it("es null mientras no haya costo de IA", () => {
    expect(aiCoverageRatio(10 * USD, 0)).toBeNull();
  });

  it("mayor o igual a 1 significa que la IA se autofinancia", () => {
    expect(aiCoverageRatio(120 * USD, 100 * USD)).toBeCloseTo(1.2);
    expect(aiCoverageRatio(50 * USD, 100 * USD)).toBeCloseTo(0.5);
  });
});

describe("aiBudgetSchema", () => {
  it("rechaza valores fuera de los límites duros", () => {
    expect(
      aiBudgetSchema.safeParse({ ...DEFAULT_AI_BUDGET, revenueSharePercent: 80 }).success,
    ).toBe(false);
    expect(aiBudgetSchema.safeParse({ ...DEFAULT_AI_BUDGET, seedMonthlyUsd: -1 }).success).toBe(
      false,
    );
  });
});
