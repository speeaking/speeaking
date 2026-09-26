/**
 * Costo de IA por solicitud (ADR-020): tokens × precio de lista. Precios en USD por millón de
 * tokens (Anthropic, consultados 2026-06; revisar al contratar). Micro-dólares = tokens × precio.
 */
export const MODEL_PRICES_USD_PER_MTOK: Record<string, { input: number; output: number }> = {
  "claude-opus-5": { input: 5, output: 25 },
  "claude-sonnet-5": { input: 2, output: 10 },
  "claude-haiku-4-5": { input: 1, output: 5 },
  mock: { input: 0, output: 0 },
};

/**
 * Tope de tokens por llamada (SEC-19). El adaptador real DEBE mandarlos al proveedor (`max_tokens`)
 * junto con `AI_CALL_TIMEOUT_MS`: con ellos, el costo de una llamada nunca pasa de
 * `maxCallCostMicrosUsd`, que es lo que se reserva del presupuesto ANTES de llamar.
 */
export const AI_MAX_INPUT_TOKENS = 4_000;
export const AI_MAX_OUTPUT_TOKENS = 4_000;
export const AI_CALL_TIMEOUT_MS = 45_000;

/** Costo máximo de una llamada al modelo (tokens tope × precio). `null` si el modelo no tiene precio. */
export function maxCallCostMicrosUsd(model: string): number | null {
  const price = MODEL_PRICES_USD_PER_MTOK[model];
  if (!price) return null;
  return AI_MAX_INPUT_TOKENS * price.input + AI_MAX_OUTPUT_TOKENS * price.output;
}

export function costMicrosUsd(model: string, usage: { inputTokens: number; outputTokens: number }) {
  const price = MODEL_PRICES_USD_PER_MTOK[model];
  if (!price) throw new Error(`Modelo sin precio configurado: ${model}`);
  return usage.inputTokens * price.input + usage.outputTokens * price.output;
}

/** Ingresos en centavos MXN → micro-dólares (para comparar contra el costo de IA). */
export function mxnCentsToMicrosUsd(cents: number, mxnPerUsd: number) {
  return Math.round((cents / 100 / mxnPerUsd) * 1_000_000);
}
