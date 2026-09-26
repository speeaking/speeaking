import type { DecisionStatus, RiskLevel } from "@/generated/prisma/enums";

/** Filtros de /admin/decisiones (`?estado=…&riesgo=…`), en español como las URLs. */

export const DECISION_STATUS_FILTERS = {
  pendientes: ["PROPOSED"],
  aprobadas: ["APPROVED"],
  aplicadas: ["APPLIED"],
  revertidas: ["REVERTED"],
  rechazadas: ["REJECTED"],
  todas: ["PROPOSED", "APPROVED", "APPLIED", "REVERTED", "REJECTED"],
} as const satisfies Record<string, readonly DecisionStatus[]>;

export type DecisionStatusFilter = keyof typeof DECISION_STATUS_FILTERS;

export const DECISION_RISK_FILTERS = {
  bajo: "LOW",
  medio: "MEDIUM",
  alto: "HIGH",
} as const satisfies Record<string, RiskLevel>;

export type DecisionRiskFilter = keyof typeof DECISION_RISK_FILTERS;

function one(value: string | string[] | undefined) {
  return typeof value === "string" ? value : undefined;
}

/**
 * Lee los filtros de la URL. Solo acepta llaves PROPIAS de cada catálogo (`Object.hasOwn`): con `in`,
 * `?estado=toString` o `?estado=__proto__` pasarían por válidos y romperían la consulta.
 */
export function parseDecisionFilters(params: Record<string, string | string[] | undefined>): {
  status: DecisionStatusFilter;
  risk: DecisionRiskFilter | null;
} {
  const status = one(params.estado);
  const risk = one(params.riesgo);
  return {
    status:
      status && Object.hasOwn(DECISION_STATUS_FILTERS, status)
        ? (status as DecisionStatusFilter)
        : "pendientes",
    risk: risk && Object.hasOwn(DECISION_RISK_FILTERS, risk) ? (risk as DecisionRiskFilter) : null,
  };
}
