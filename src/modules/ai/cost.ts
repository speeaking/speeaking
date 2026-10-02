/**
 * Costo de IA por solicitud (ADR-020, ADR-034): tokens × precio de lista. Precios en USD por millón
 * de tokens, con la fecha y la fuente en que se consultaron: revisarlos al contratar y cuando cambie
 * el proveedor. Micro-dólares = tokens × precio.
 *
 * - Claude: lista de Anthropic, consultada 2026-06 (referencia de calidad, ADR-033 #9).
 * - Modelos abiertos y de referencia vía OpenRouter: API pública de modelos
 *   (https://openrouter.ai/api/v1/models), consultada el 2026-09-27. Qwen3.5-9B subió de
 *   US$0.08/0.13 a US$0.10/0.15. Gemini 3.5 Flash Lite, consultado el 2026-10-01 (ADR-071):
 *   reemplaza a 2.5 Flash Lite, que OpenRouter retira el 2026-10-20 (su precio queda para lo ya
 *   registrado).
 *
 * Un modelo que no esté aquí NO tiene precio: el guardián no lo llama (ADR-031) y, si aun así llega
 * una respuesta, su costo se marca como desconocido en lugar de contarse como 0.
 */
export const MODEL_PRICES_USD_PER_MTOK: Record<string, { input: number; output: number }> = {
  "claude-opus-5": { input: 5, output: 25 },
  "claude-sonnet-5": { input: 2, output: 10 },
  "claude-haiku-4-5": { input: 1, output: 5 },
  "qwen3.5-9b": { input: 0.1, output: 0.15 },
  "qwen3.5-27b": { input: 0.195, output: 1.56 },
  "qwen3.5-flash-02-23": { input: 0.065, output: 0.26 },
  "mistral-small-2603": { input: 0.15, output: 0.6 },
  "gemini-2.5-flash-lite": { input: 0.1, output: 0.4 },
  "gemini-3.5-flash-lite": { input: 0.3, output: 2.5 },
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
  "mistralai/mistral-small-2603": "mistral-small-2603",
  "google/gemini-2.5-flash-lite": "gemini-2.5-flash-lite",
};

/**
 * Precio por IMAGEN generada, en dólares (ADR-043, ADR-044). Fuente: OpenRouter, consultado el
 * 2026-09-29 (salida de imagen a US$60 por millón de tokens; una imagen de 1024×1024 ≈ 1,120
 * tokens ≈ US$0.067). La «lite» a la mitad. `docs/modelo-de-ingresos.md` §6. Los ids finales (sin
 * «-preview», verificados el 2026-09-30 al mismo precio) son los que tienen endpoint con cero retención
 * en OpenRouter; los «-preview» no, y con `zdr: true` responden 404 «data policy».
 */
export const IMAGE_PRICES_USD_PER_IMAGE: Record<string, number> = {
  "gemini-3.1-flash-image": 0.0672,
  "gemini-3.1-flash-lite-image": 0.0336,
  "gemini-3.1-flash-image-preview": 0.0672,
  "gemini-3.1-flash-lite-image-preview": 0.0336,
  "mock-image": 0,
};

const IMAGE_MODEL_ALIASES: Record<string, string> = {
  "google/gemini-3.1-flash-image-preview": "gemini-3.1-flash-image-preview",
  "google/gemini-3.1-flash-lite-image-preview": "gemini-3.1-flash-lite-image-preview",
};

/** Id del modelo de imagen en la tabla, o `null` si no es un modelo de imagen con precio. */
export function pricedImageModelId(model: string): string | null {
  const id = model.trim().toLowerCase();
  if (id in IMAGE_PRICES_USD_PER_IMAGE) return id;
  const alias = IMAGE_MODEL_ALIASES[id];
  if (alias) return alias;
  const withoutVendor = id.includes("/") ? id.slice(id.lastIndexOf("/") + 1) : null;
  return withoutVendor && withoutVendor in IMAGE_PRICES_USD_PER_IMAGE ? withoutVendor : null;
}

/** Costo de UNA imagen en micro-dólares, o `null` si el modelo no tiene precio. */
export function imagePriceMicrosUsd(model: string): number | null {
  const id = pricedImageModelId(model);
  return id === null ? null : Math.ceil(IMAGE_PRICES_USD_PER_IMAGE[id]! * 1_000_000);
}

/** Costo que se REGISTRA de una generación de imágenes (por imagen; los tokens no se cobran aparte). */
export function recordedImageCost(
  model: string,
  images: number,
): { micros: number; known: boolean } {
  const perImage = imagePriceMicrosUsd(model);
  if (perImage !== null) return { micros: perImage * Math.max(1, images), known: true };
  const highest = Math.max(...Object.values(IMAGE_PRICES_USD_PER_IMAGE));
  return { micros: Math.ceil(highest * 1_000_000) * Math.max(1, images), known: false };
}

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
/**
 * Tokens con que se cuenta cada foto de entrada (ADR-061), de más: una foto reducida a 768 px son
 * ≈ 258 tokens en Gemini y ≈ 765 en otros modelos. Entra en el tope de entrada de arriba, así el
 * costo real nunca pasa del reservado.
 */
export const AI_IMAGE_INPUT_TOKENS = 1_100;
export const AI_MAX_OUTPUT_TOKENS = 4_000;
export const AI_CALL_TIMEOUT_MS = 45_000;

/**
 * Costo máximo de una llamada (tokens tope × precio; en un modelo de imagen, una imagen). `null` si
 * el modelo no tiene precio.
 */
export function maxCallCostMicrosUsd(model: string): number | null {
  const image = imagePriceMicrosUsd(model);
  if (image !== null) return image;
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
