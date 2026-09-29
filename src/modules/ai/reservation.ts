import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import type { AIFeature, AIFunding } from "@/generated/prisma/enums";
import { getAiBudget } from "@/modules/platform/settings";
import { db } from "@/server/db";
import { rateLimit, rateLimitKey } from "@/server/rate-limit";
import type { AIBudget } from "./budget";
import { type AiCallTarget, reserveBudget } from "./budget-ledger";
import { AIError } from "./errors";

export { committedSpendMicros, monthStart } from "./budget-ledger";
export type { AiCallTarget } from "./budget-ledger";

/**
 * Guardián de presupuesto de IA (ADR-020, SEC-19, ADR-033 #6, ADR-044). Reserva ANTES de llamar al
 * proveedor:
 *
 * 1. Cuotas por persona con el limitador atómico (`rateLimit`): por hora (ráfagas) y por día. Cada
 *    intento cuenta, también los que después fallan, y N llamadas simultáneas no pasan todas. Una
 *    función puede traer su propio límite (`limits`), además del general.
 * 2. Dentro de una transacción con candado (`budget-ledger.ts`): la cuota mensual de la persona
 *    (solo lo subsidiado), el tope diario de la función (si aplica) y el presupuesto global del mes.
 *    Lo comprometido = costo real de lo que respondió + costo MÁXIMO de cada solicitud pendiente o
 *    fallida. Si no cabe el costo máximo de esta llamada, se registra BLOCKED_BUDGET y no se llama.
 *    Lo pagado con saldo (`funding` USER_PAID / SELLER_PAID) no consume presupuesto: `reserve`
 *    cobra el saldo en la misma transacción.
 *
 * Las tareas del sistema (analista, evaluaciones) reservan con `userId: null`: sin cuotas por
 * persona, pero dentro del mismo presupuesto global. Un modelo sin precio no se llama (fallaría
 * DESPUÉS de gastar).
 */

const HOUR_SECONDS = 60 * 60;
const DAY_SECONDS = 24 * HOUR_SECONDS;

export type FeatureLimits = {
  /** Clave corta de la función para el limitador («tryon», «need»). */
  key: string;
  perHour: number;
  perDay: number;
};

/**
 * Reserva una llamada de IA. Devuelve el id de la `AIRequest` PENDING, o lanza `AIError`
 * RATE_LIMITED (ráfaga por hora), QUOTA_EXCEEDED (cuota del día o del mes), BUDGET_EXCEEDED,
 * DAILY_CAP (tope diario del subsidio de la función) o PROVIDER_ERROR (modelo sin precio).
 */
export async function reserveAiRequest({
  userId,
  feature,
  provider,
  input,
  now = new Date(),
  budget,
  funding = "PLATFORM",
  limits,
  featureDailyCapMicros = null,
  reserve,
}: {
  userId: string | null;
  feature: AIFeature;
  provider: AiCallTarget;
  input: Prisma.InputJsonValue;
  now?: Date;
  /** Para pruebas; por omisión, el ajuste `ai.budget`. */
  budget?: AIBudget;
  funding?: AIFunding;
  /** Límite propio de la función, además del general de IA. */
  limits?: FeatureLimits;
  featureDailyCapMicros?: number | null;
  /** Paso extra dentro de la transacción de la reserva (p. ej. cobrar el saldo). */
  reserve?: (tx: Prisma.TransactionClient, requestId: string) => Promise<void>;
}): Promise<{ requestId: string }> {
  const limitSetting = budget ?? (await getAiBudget());

  if (userId) {
    const rules = [
      {
        key: rateLimitKey("ai", "user", userId)!,
        limit: limitSetting.maxRequestsPerUserPerHour,
        windowSeconds: HOUR_SECONDS,
        code: "RATE_LIMITED" as const,
        scope: undefined,
      },
      {
        key: rateLimitKey("ai.day", "user", userId)!,
        limit: limitSetting.maxRequestsPerUserPerDay,
        windowSeconds: DAY_SECONDS,
        code: "QUOTA_EXCEEDED" as const,
        scope: "day" as const,
      },
      ...(limits
        ? [
            {
              key: rateLimitKey(`ai.${limits.key}`, "user", userId)!,
              limit: limits.perHour,
              windowSeconds: HOUR_SECONDS,
              code: "RATE_LIMITED" as const,
              scope: undefined,
            },
            {
              key: rateLimitKey(`ai.${limits.key}.day`, "user", userId)!,
              limit: limits.perDay,
              windowSeconds: DAY_SECONDS,
              code: "QUOTA_EXCEEDED" as const,
              scope: "day" as const,
            },
          ]
        : []),
    ];
    for (const rule of rules) {
      const result = await rateLimit(rule);
      if (!result.ok) throw new AIError(rule.code, result.retryAfterSeconds, rule.scope);
    }
  }

  let reserved;
  try {
    reserved = await reserveBudget(db, {
      userId,
      feature,
      target: provider,
      input,
      budget: limitSetting,
      funding,
      featureDailyCapMicros,
      now,
      reserve,
    });
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("[ai] modelo sin precio")) {
      console.error(error.message);
      throw new AIError("PROVIDER_ERROR");
    }
    throw error;
  }
  if (reserved.ok) return { requestId: reserved.requestId };
  if (reserved.reason === "month_quota") {
    throw new AIError("QUOTA_EXCEEDED", reserved.retryAfterSeconds, "month");
  }
  if (reserved.reason === "daily_cap") throw new AIError("DAILY_CAP");
  throw new AIError("BUDGET_EXCEEDED");
}
