/**
 * Costo de IA por solicitud (ADR-020, ADR-034): tokens × precio de lista. Precios en USD por millón
 * de tokens, con la fecha y la fuente en que se consultaron: revisarlos al contratar y cuando cambie
 * el proveedor. Micro-dólares = tokens × precio.
 *
 * - Claude: lista de Anthropic, consultada 2026-06 (referencia de calidad, ADR-033 #9).
 * - Qwen3.5-9B: OpenRouter, US$0.08 de entrada y US$0.13 de salida (ADR-033 #6), 2026-09.
 *
 * Un modelo que no esté aquí NO tiene precio: el guardián no lo llama (ADR-031) y, si aun así llega
 * una respuesta, su costo se marca como desconocido en lugar de contarse como 0.
 */
export const MODEL_PRICES_USD_PER_MTOK: Record<string, { input: number; output: number }> = {
  "claude-opus-5": { input: 5, output: 25 },
  "claude-sonnet-5": { input: 2, output: 10 },
  "claude-haiku-4-5": { input: 1, output: 5 },
  "qwen3.5-9b": { input: 0.08, output: 0.13 },
  mock: { input: 0, output: 0 },
};

/**
 * Ids con los que cada proveedor sirve un modelo con precio (en minúsculas). Sin prefijo de
 * proveedor, un id se busca también tal cual (`qwen/qwen3.5-9b` → `qwen3.5-9b`). Las variantes con
 * otro precio (`:free`, `:nitro`) NO se igualan: necesitan su propia fila.
 */
const MODEL_ALIASES: Record<string, string> = {
  "anthropic/claude-opus-5": "claude-opus-5",
  "anthropic/claude-sonnet-5": "claude-sonnet-5",
  "anthropic/claude-haiku-4.5": "claude-haiku-4-5",
  "anthropic/claude-haiku-4-5": "claude-haiku-4-5",
};

/** Id del modelo en la tabla de precios, o `null` si no tiene precio. */
export function pricedModelId(model: string): string | null {
  const id = model.trim().toLowerCase();
  if (id in MODEL_PRICES_USD_PER_MTOK) return id;
  const alias = MODEL_ALIASES[id];
  if (alias) return alias;
  const withoutVendor = id.includes("/") ? id.slice(id.lastIndexOf("/") + 1) : null;
  return withoutVendor && withoutVendor in MODEL_PRICES_USD_PER_MTOK ? withoutVendor : null;
}

/** Precio por millón de tokens, o `null` si el modelo no tiene precio. */
export function modelPrice(model: string) {
  const id = pricedModelId(model);
  return id ? MODEL_PRICES_USD_PER_MTOK[id]! : null;
}

/**
 * Tope de tokens por llamada (SEC-19). El adaptador real los manda al proveedor (`max_tokens`) y
 * revisa la entrada antes de llamar, junto con `AI_CALL_TIMEOUT_MS`: con ellos, el costo de una
 * llamada nunca pasa de `maxCallCostMicrosUsd`, que es lo que se reserva ANTES de llamar.
 */
export const AI_MAX_INPUT_TOKENS = 4_000;
export const AI_MAX_OUTPUT_TOKENS = 4_000;
export const AI_CALL_TIMEOUT_MS = 45_000;

/** Costo máximo de una llamada (tokens tope × precio). `null` si el modelo no tiene precio. */
export function maxCallCostMicrosUsd(model: string): number | null {
  const price = modelPrice(model);
  if (!price) return null;
  return Math.ceil(AI_MAX_INPUT_TOKENS * price.input + AI_MAX_OUTPUT_TOKENS * price.output);
}

/**
 * Costo en micro-dólares (entero, redondeado hacia arriba). `null` si el modelo no tiene precio:
 * nunca 0 en silencio.
 */
export function costMicrosUsd(
  model: string,
  usage: { inputTokens: number; outputTokens: number },
): number | null {
  const price = modelPrice(model);
  if (!price) return null;
  return Math.ceil(usage.inputTokens * price.input + usage.outputTokens * price.output);
}

/** El precio más alto de la tabla: cota superior para una respuesta de un modelo sin precio. */
function highestPrice() {
  return Object.values(MODEL_PRICES_USD_PER_MTOK).reduce(
    (max, price) => ({
      input: Math.max(max.input, price.input),
      output: Math.max(max.output, price.output),
    }),
    { input: 0, output: 0 },
  );
}

/**
 * Costo que se REGISTRA de una respuesta. Con precio, el real. Sin precio (no debería pasar: el
 * guardián no llama a un modelo sin precio), se registra una cota superior con el precio más alto
 * de la tabla y `known: false`, para que el presupuesto nunca lo cuente como gratis.
 */
export function recordedCost(
  model: string,
  usage: { inputTokens: number; outputTokens: number },
): { micros: number; known: boolean } {
  const exact = costMicrosUsd(model, usage);
  if (exact !== null) return { micros: exact, known: true };
  const price = highestPrice();
  return {
    micros: Math.ceil(usage.inputTokens * price.input + usage.outputTokens * price.output),
    known: false,
  };
}

/** Ingresos en centavos MXN → micro-dólares (para comparar contra el costo de IA). */
export function mxnCentsToMicrosUsd(cents: number, mxnPerUsd: number) {
  return Math.round((cents / 100 / mxnPerUsd) * 1_000_000);
}
