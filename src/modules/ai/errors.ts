export type AIErrorCode =
  | "RATE_LIMITED"
  | "QUOTA_EXCEEDED"
  | "BUDGET_EXCEEDED"
  | "INVALID_OUTPUT"
  | "PROVIDER_ERROR"
  | "NOT_ALLOWED"
  /** Sin IA disponible (ADR-038): se detecta ANTES de reservar, sin gastar la cuota. */
  | "UNAVAILABLE";

export class AIError extends Error {
  override name = "AIError";
  constructor(
    readonly code: AIErrorCode,
    /** En RATE_LIMITED y QUOTA_EXCEEDED: cuánto falta para que se libere la cuota. */
    readonly retryAfterSeconds?: number,
    /** En QUOTA_EXCEEDED: qué cuota se agotó. */
    readonly scope?: "day" | "month",
  ) {
    super(code);
  }
}
