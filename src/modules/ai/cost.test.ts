import { describe, expect, it } from "vitest";
import { costMicrosUsd, mxnCentsToMicrosUsd } from "./cost";

describe("costMicrosUsd", () => {
  it("una propuesta típica (3k de entrada, 2k de salida) cuesta US$0.065 con Claude Opus 5", () => {
    expect(costMicrosUsd("claude-opus-5", { inputTokens: 3_000, outputTokens: 2_000 })).toBe(
      65_000,
    );
  });

  it("el proveedor simulado no cuesta nada", () => {
    expect(costMicrosUsd("mock", { inputTokens: 3_000, outputTokens: 2_000 })).toBe(0);
  });

  it("un modelo sin precio configurado es un error (no se usa a ciegas)", () => {
    expect(() =>
      costMicrosUsd("modelo-desconocido", { inputTokens: 1, outputTokens: 1 }),
    ).toThrow();
  });
});

describe("mxnCentsToMicrosUsd", () => {
  it("convierte ingresos en pesos a micro-dólares", () => {
    expect(mxnCentsToMicrosUsd(18_000, 18)).toBe(10_000_000);
  });
});
