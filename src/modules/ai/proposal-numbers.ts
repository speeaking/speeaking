/**
 * Cifras de la propuesta de "Sube y vende" que decide el CÓDIGO, no la IA (P2, SEC-28): el rango de
 * precio de prueba y el presupuesto diario inicial. Lo que devuelva el proveedor en esos campos se
 * descarta y se reemplaza por estos cálculos; la IA solo redacta la explicación.
 */

/** Tope de cualquier monto (mismo que `catalog/pricing`): $10 M MXN. */
export const MAX_PROPOSAL_CENTS = 1_000_000_000;

/** Presupuesto diario de prueba: 30 % de lo que ganas por pieza, entre $50 y $300. */
export const DAILY_BUDGET_RULE = { share: 0.3, minCents: 5_000, maxCents: 30_000 } as const;

/** Rango de prueba alrededor de tu precio: 5 % abajo y 3 % arriba. */
export const PRICE_RANGE_RULE = { below: 0.95, above: 1.03 } as const;

/** Redondea a precio "de vitrina" terminado en 9 (p. ej. 3,324 → 3,329). */
export function charmPrice(cents: number) {
  const pesos = Math.max(9, Math.round(cents / 100));
  return Math.min((Math.floor(pesos / 10) * 10 + 9) * 100, MAX_PROPOSAL_CENTS);
}

export function suggestedPriceRange(priceCents: number) {
  return {
    minCents: charmPrice(priceCents * PRICE_RANGE_RULE.below),
    maxCents: charmPrice(priceCents * PRICE_RANGE_RULE.above),
  };
}

export function suggestedDailyBudgetCents({
  priceCents,
  costCents,
}: {
  priceCents: number;
  costCents: number;
}) {
  const share = Math.round((priceCents - costCents) * DAILY_BUDGET_RULE.share);
  return Math.min(Math.max(share, DAILY_BUDGET_RULE.minCents), DAILY_BUDGET_RULE.maxCents);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Pone las cifras del código sobre la salida cruda del proveedor, ANTES de validarla: un número
 * inventado (o absurdo) de la IA nunca llega a la interfaz ni tumba la propuesta.
 */
export function withCodeNumbers(
  output: unknown,
  request: { priceCents: number; costCents: number },
): unknown {
  if (!isRecord(output)) return output;
  const range = isRecord(output.suggestedPriceRange) ? output.suggestedPriceRange : {};
  return {
    ...output,
    suggestedPriceRange: { ...range, ...suggestedPriceRange(request.priceCents) },
    suggestedDailyBudgetCents: suggestedDailyBudgetCents(request),
  };
}
