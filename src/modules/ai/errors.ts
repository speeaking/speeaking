export class AIError extends Error {
  override name = "AIError";
  constructor(
    readonly code: "RATE_LIMITED" | "BUDGET_EXCEEDED" | "INVALID_OUTPUT" | "PROVIDER_ERROR",
    /** Solo en RATE_LIMITED: cuánto falta para que se libere la cuota. */
    readonly retryAfterSeconds?: number,
  ) {
    super(code);
  }
}
