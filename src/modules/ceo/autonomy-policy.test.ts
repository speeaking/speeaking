import { describe, expect, it } from "vitest";
import {
  decideAutomaticAction,
  INSUFFICIENT_TRAFFIC_REASON,
  NOT_VISIBLE_HOLD_REASON,
} from "./autonomy-policy";

const base = {
  mode: "low_risk" as const,
  freeze: null,
  thresholdMet: true,
  conflict: null,
};

describe("qué hace el sistema solo con una propuesta", () => {
  it("riesgo bajo, modo riesgo bajo y umbral cumplido: se aplica", () => {
    expect(decideAutomaticAction({ ...base, risk: "LOW" }).action).toBe("apply");
  });

  it("riesgo medio: experimento al 10 %, nunca se aplica directo", () => {
    const decision = decideAutomaticAction({ ...base, risk: "MEDIUM" });
    expect(decision).toMatchObject({ action: "experiment", allocation: 0.1 });
  });

  it("riesgo alto: nunca automático, en ningún modo", () => {
    for (const mode of ["observer", "low_risk"] as const) {
      expect(decideAutomaticAction({ ...base, mode, risk: "HIGH" }).action).toBe("hold");
    }
  });

  it("modo observador: nada se aplica solo", () => {
    for (const risk of ["LOW", "MEDIUM"] as const) {
      const decision = decideAutomaticAction({ ...base, mode: "observer", risk });
      expect(decision).toEqual({ action: "hold", reason: "Modo observador: la IA solo propone." });
    }
  });

  it("sin umbral de tráfico: se queda propuesta con el motivo exacto", () => {
    expect(decideAutomaticAction({ ...base, risk: "LOW", thresholdMet: false })).toEqual({
      action: "hold",
      reason: INSUFFICIENT_TRAFFIC_REASON,
    });
    expect(INSUFFICIENT_TRAFFIC_REASON).toBe("Tráfico insuficiente para decidirlo con datos");
  });

  it("con tráfico pero sin impresiones visibles: se queda propuesta y lo dice", () => {
    expect(
      decideAutomaticAction({ ...base, risk: "MEDIUM", thresholdMet: false, enoughTraffic: true }),
    ).toEqual({ action: "hold", reason: NOT_VISIBLE_HOLD_REASON });
  });

  it("congelamiento: nada cambia solo aunque se cumpla todo lo demás", () => {
    const decision = decideAutomaticAction({
      ...base,
      risk: "LOW",
      freeze: { name: "Buen Fin", from: "2026-11-13", to: "2026-11-17" },
    });
    expect(decision.action).toBe("hold");
    expect(decision.reason).toMatch(/Buen Fin/);
  });

  it("un conflicto (experimento en curso, enfriamiento) lo detiene", () => {
    const decision = decideAutomaticAction({
      ...base,
      risk: "LOW",
      conflict: "Hay un experimento en curso sobre este ajuste (x).",
    });
    expect(decision).toEqual({
      action: "hold",
      reason: "Hay un experimento en curso sobre este ajuste (x).",
    });
  });
});
