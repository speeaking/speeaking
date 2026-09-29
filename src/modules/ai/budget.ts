import { z } from "zod";

/** Clave del ajuste en `PlatformSetting` (ADR-020). */
export const AI_BUDGET_KEY = "ai.budget";

/**
 * Presupuesto mensual de IA: semilla + un porcentaje de los ingresos de plataforma del mes
 * anterior, con un tope duro. Así la IA "se paga sola" conforme la plataforma genera ingresos.
 */
export const aiBudgetSchema = z.object({
  version: z.literal(1),
  seedMonthlyUsd: z.number().min(0).max(10_000),
  revenueSharePercent: z.number().min(0).max(50),
  hardCapMonthlyUsd: z.number().min(0).max(100_000),
  /** Tipo de cambio para comparar ingresos en MXN contra costos de IA en USD. */
  mxnPerUsd: z.number().min(5).max(50).default(18),
  /** Solicitudes de IA por persona por hora (protege costo y abuso). */
  maxRequestsPerUserPerHour: z.int().min(1).max(500).default(20),
  /**
   * Solicitudes por persona por día (SEC-19): una sola cuenta no puede agotar el presupuesto global
   * de todos los vendedores. Cuenta también las que fallan. ADR-033 #6: 10 al día.
   */
  maxRequestsPerUserPerDay: z.int().min(1).max(2_000).default(10),
  /**
   * Solicitudes por persona por mes calendario (UTC, como el presupuesto), sumando todas las
   * funciones de IA. ADR-033 #6: 30 al mes por vendedor. Cuentan las que llegaron al proveedor
   * (pendientes, respondidas y fallidas), no las bloqueadas por presupuesto.
   */
  maxRequestsPerUserPerMonth: z.int().min(1).max(10_000).default(30),
  /**
   * Tope diario del SUBSIDIO de Pruébatelo (ADR-044): lo que la plataforma paga en pruebas gratis
   * por día (UTC). Al agotarse, las gratis se pausan hasta mañana; las pagadas siguen.
   */
  tryOnDailyCapUsd: z.number().min(0).max(1_000).default(5),
});

export type AIBudget = z.infer<typeof aiBudgetSchema>;

export const DEFAULT_AI_BUDGET: AIBudget = {
  version: 1,
  seedMonthlyUsd: 50,
  revenueSharePercent: 20,
  hardCapMonthlyUsd: 500,
  mxnPerUsd: 18,
  maxRequestsPerUserPerHour: 20,
  maxRequestsPerUserPerDay: 10,
  maxRequestsPerUserPerMonth: 30,
  tryOnDailyCapUsd: 5,
};

const MICROS_PER_USD = 1_000_000;

/**
 * Límite de gasto del mes en micro-dólares (P2: cálculo determinista).
 * `lastMonthRevenueMicrosUsd` son los ingresos de plataforma del mes anterior.
 */
export function monthlyAiLimitMicros(budget: AIBudget, lastMonthRevenueMicrosUsd: number): number {
  const seed = budget.seedMonthlyUsd * MICROS_PER_USD;
  const share = Math.max(0, lastMonthRevenueMicrosUsd) * (budget.revenueSharePercent / 100);
  const cap = budget.hardCapMonthlyUsd * MICROS_PER_USD;
  return Math.floor(Math.min(seed + share, cap));
}

/** Cobertura = ingresos ÷ costo de IA. ≥ 1 significa que la IA ya se autofinancia. */
export function aiCoverageRatio(revenueMicrosUsd: number, aiCostMicrosUsd: number): number | null {
  if (aiCostMicrosUsd <= 0) return null;
  return revenueMicrosUsd / aiCostMicrosUsd;
}
