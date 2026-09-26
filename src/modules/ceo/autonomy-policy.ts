import type { RiskLevel } from "@/generated/prisma/enums";
import type { AutonomyMode } from "@/modules/platform/autonomy";
import type { FreezePeriod } from "@/modules/platform/calendar";

/**
 * Qué hace el sistema SOLO con una propuesta nueva (plan-90-dias.md §2.3–2.4, ADR-019, ADR-033). Es
 * una función pura: el riesgo viene del catálogo (código), nunca de la IA.
 *
 * - ALTO: nunca automático («Solo propuesta»).
 * - Modo observador: la IA solo propone.
 * - Congelamiento (Buen Fin, 12–25 de diciembre): nada cambia solo.
 * - Conflicto (experimento en curso, enfriamiento, otra decisión abierta): se queda propuesta.
 * - Sin umbral de tráfico: se queda propuesta con «Tráfico insuficiente para decidirlo con datos» (o,
 *   si hay tráfico pero las impresiones aún no son visibles, con ese motivo).
 * - BAJO: se aplica con reversión automática. MEDIO: experimento al 10 %; adoptar requiere aprobación.
 */

export const INSUFFICIENT_TRAFFIC_REASON = "Tráfico insuficiente para decidirlo con datos";
/** Hay tráfico, pero el umbral se mide en impresiones visibles y aún no se registran (T5). */
export const NOT_VISIBLE_HOLD_REASON =
  "Aún no se miden impresiones visibles: nada se aplica ni se prueba solo";
export const MEDIUM_RISK_ALLOCATION = 0.1;

export type AutomaticAction =
  | { action: "apply"; reason: string }
  | { action: "experiment"; allocation: number; reason: string }
  | { action: "hold"; reason: string };

export function decideAutomaticAction(input: {
  risk: RiskLevel;
  mode: AutonomyMode;
  freeze: FreezePeriod | null;
  thresholdMet: boolean;
  /** Si hay tráfico suficiente aunque el umbral no se cumpla (solo cambia el motivo). */
  enoughTraffic?: boolean;
  /** Motivo por el que no se puede tocar el parámetro ahora, o `null`. */
  conflict: string | null;
}): AutomaticAction {
  if (input.risk === "HIGH") {
    return { action: "hold", reason: "Riesgo alto: solo propuesta; la decides tú." };
  }
  if (input.mode === "observer") {
    return { action: "hold", reason: "Modo observador: la IA solo propone." };
  }
  if (input.freeze) {
    return {
      action: "hold",
      reason: `Congelamiento (${input.freeze.name}): nada cambia solo en estas fechas.`,
    };
  }
  if (input.conflict) return { action: "hold", reason: input.conflict };
  if (!input.thresholdMet) {
    return {
      action: "hold",
      reason: input.enoughTraffic ? NOT_VISIBLE_HOLD_REASON : INSUFFICIENT_TRAFFIC_REASON,
    };
  }
  if (input.risk === "LOW") {
    return {
      action: "apply",
      reason: "Riesgo bajo con umbral de tráfico cumplido: aplicado con reversión automática.",
    };
  }
  return {
    action: "experiment",
    allocation: MEDIUM_RISK_ALLOCATION,
    reason:
      "Riesgo medio: se prueba con el 10 % de las personas; adoptarlo requiere tu aprobación.",
  };
}
