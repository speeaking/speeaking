import type { AIUsage } from "./types";

export type AIProviderErrorKind =
  /** Pasó el plazo total de la llamada (incluidos los reintentos). */
  | "timeout"
  /** 429 del proveedor, aun después de reintentar. */
  | "rate_limited"
  /** 5xx del proveedor, aun después de reintentar. */
  | "unavailable"
  /** 401/403: llave inválida o sin permisos. */
  | "auth"
  /** 402: la cuenta del proveedor no tiene saldo (o la llave llegó a su límite de crédito). */
  | "no_credit"
  /** Otro 4xx: modelo inexistente, parámetros no soportados… */
  | "bad_request"
  /** Sin respuesta (DNS, conexión cortada). No se reintenta: pudo haberse cobrado. */
  | "network"
  /** La respuesta no es JSON válido, no cumple el esquema, se cortó o el modelo se negó. */
  | "invalid_output"
  /** La entrada supera `AI_MAX_INPUT_TOKENS` (se revisa ANTES de llamar). */
  | "input_too_large";

/**
 * Error de un proveedor de IA. El mensaje es para registros internos: nunca lleva la llave, el
 * cuerpo de la petición ni el de la respuesta (podrían traer el texto del vendedor).
 */
export class AIProviderError extends Error {
  override name = "AIProviderError";
  constructor(
    readonly kind: AIProviderErrorKind,
    message: string,
    /** Uso informado por el proveedor, si alcanzó a responder (p. ej. salida inválida). */
    readonly usage?: AIUsage,
    readonly status?: number,
    /**
     * Campos de la salida que no cumplieron el esquema y por qué («ctas.3 (too_big)»): solo la ruta y
     * el código del error, nunca el contenido.
     */
    readonly fields?: readonly string[],
  ) {
    super(message);
  }
}
