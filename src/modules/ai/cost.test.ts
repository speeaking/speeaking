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

  it("Qwen3.5-9B por uso: US$0.10 / US$0.15 por millón (OpenRouter, 2026-09-27), redondeado hacia arriba", () => {
    // 3,000 × 0.10 + 2,000 × 0.15 = 300 + 300 = 600 micro-dólares (US$0.0006).
    expect(costMicrosUsd("qwen/qwen3.5-9b", { inputTokens: 3_000, outputTokens: 2_000 })).toBe(600);
    // 1 × 0.10 + 1 × 0.15 = 0.25 → 1 (nunca 0 si hubo tokens).
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
    expect(pricedModelId("qwen/qwen3.5-122b-a10b")).toBeNull();
    expect(pricedModelId("google/gemini-3.5-flash-lite:batch")).toBeNull();
  });

  it("Gemini 3.5 Flash Lite tiene precio (reemplaza a 2.5, que se retira; ADR-071)", () => {
    expect(modelPrice("google/gemini-3.5-flash-lite")).toEqual({ input: 0.3, output: 2.5 });
  });
});

describe("recordedCost", () => {
  it("con precio, registra el costo real", () => {
    expect(recordedCost("qwen3.5-9b", { inputTokens: 3_000, outputTokens: 2_000 })).toEqual({
      micros: 600,
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

describe("precios por imagen (ADR-043)", async () => {
  const { imagePriceMicrosUsd, maxCallCostMicrosUsd, recordedImageCost } = await import("./cost");

  it("un modelo de imagen conocido tiene precio por imagen y ese es su costo máximo por llamada", () => {
    expect(imagePriceMicrosUsd("google/gemini-3.1-flash-image")).toBe(67_200);
    expect(imagePriceMicrosUsd("google/gemini-3.1-flash-lite-image")).toBe(33_600);
    expect(imagePriceMicrosUsd("google/gemini-3.1-flash-image-preview")).toBe(67_200);
    expect(imagePriceMicrosUsd("GOOGLE/gemini-3.1-flash-lite-image-preview")).toBe(33_600);
    expect(maxCallCostMicrosUsd("google/gemini-3.1-flash-image-preview")).toBe(67_200);
    expect(imagePriceMicrosUsd("mock-image")).toBe(0);
    expect(imagePriceMicrosUsd("qwen/qwen3.5-9b")).toBeNull();
  });

  it("sin precio se registra una cota superior marcada como desconocida, nunca 0", () => {
    expect(recordedImageCost("google/gemini-3.1-flash-image-preview", 1)).toEqual({
      micros: 67_200,
      known: true,
    });
    const unknown = recordedImageCost("vendor/modelo-nuevo", 2);
    expect(unknown.known).toBe(false);
    expect(unknown.micros).toBeGreaterThan(0);
  });
});
