import { describe, expect, it } from "vitest";
import {
  costMicrosUsd,
  maxCallCostMicrosUsd,
  modelPrice,
  mxnCentsToMicrosUsd,
  pricedModelId,
  recordedCost,
} from "./cost";

describe("costMicrosUsd", () => {
  it("una propuesta típica (3k de entrada, 2k de salida) cuesta US$0.065 con Claude Opus 5", () => {
    expect(costMicrosUsd("claude-opus-5", { inputTokens: 3_000, outputTokens: 2_000 })).toBe(
      65_000,
    );
  });

  it("Qwen3.5-9B por uso: US$0.08 / US$0.13 por millón (ADR-033), redondeado hacia arriba", () => {
    // 3,000 × 0.08 + 2,000 × 0.13 = 240 + 260 = 500 micro-dólares (US$0.0005).
    expect(costMicrosUsd("qwen/qwen3.5-9b", { inputTokens: 3_000, outputTokens: 2_000 })).toBe(500);
    // 1 × 0.08 + 1 × 0.13 = 0.21 → 1 (nunca 0 si hubo tokens).
    expect(costMicrosUsd("qwen3.5-9b", { inputTokens: 1, outputTokens: 1 })).toBe(1);
  });

  it("el proveedor simulado no cuesta nada", () => {
    expect(costMicrosUsd("mock", { inputTokens: 3_000, outputTokens: 2_000 })).toBe(0);
  });

  it("un modelo sin precio da null, nunca 0", () => {
    expect(costMicrosUsd("modelo-desconocido", { inputTokens: 1, outputTokens: 1 })).toBeNull();
    expect(maxCallCostMicrosUsd("modelo-desconocido")).toBeNull();
  });
});

describe("pricedModelId", () => {
  it("reconoce el id del proveedor (con prefijo y mayúsculas) y los alias", () => {
    expect(pricedModelId("qwen/qwen3.5-9b")).toBe("qwen3.5-9b");
    expect(pricedModelId("Qwen/Qwen3.5-9B")).toBe("qwen3.5-9b");
    expect(pricedModelId("anthropic/claude-haiku-4.5")).toBe("claude-haiku-4-5");
    expect(modelPrice("claude-haiku-4-5")).toEqual({ input: 1, output: 5 });
  });

  it("no iguala variantes con otro precio", () => {
    expect(pricedModelId("qwen/qwen3.5-9b:free")).toBeNull();
    expect(pricedModelId("qwen/qwen3.5-27b")).toBeNull();
  });
});

describe("recordedCost", () => {
  it("con precio, registra el costo real", () => {
    expect(recordedCost("qwen3.5-9b", { inputTokens: 3_000, outputTokens: 2_000 })).toEqual({
      micros: 500,
      known: true,
    });
  });

  it("sin precio, registra una cota superior marcada como desconocida (no 0)", () => {
    const cost = recordedCost("otro-modelo", { inputTokens: 1_000, outputTokens: 1_000 });
    expect(cost.known).toBe(false);
    // Precio más alto de la tabla: 5 de entrada y 25 de salida.
    expect(cost.micros).toBe(30_000);
  });
});

describe("mxnCentsToMicrosUsd", () => {
  it("convierte ingresos en pesos a micro-dólares", () => {
    expect(mxnCentsToMicrosUsd(18_000, 18)).toBe(10_000_000);
  });
});
