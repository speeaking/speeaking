import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import type { AIFeature } from "@/generated/prisma/enums";
import { getAiBudget } from "@/modules/platform/settings";
import { db } from "@/server/db";
import { rateLimit, rateLimitKey } from "@/server/rate-limit";
import type { AIBudget } from "./budget";
import { type AiCallTarget, reserveBudget } from "./budget-ledger";
import { AIError } from "./errors";

export { committedSpendMicros, monthStart } from "./budget-ledger";
export type { AiCallTarget } from "./budget-ledger";

/**
 * Guardián de presupuesto de IA (ADR-020, SEC-19, ADR-033 #6). Reserva ANTES de llamar al proveedor:
 *
 * 1. Cuotas por persona con el limitador atómico (`rateLimit`): por hora (ráfagas) y por día. Cada
 *    intento cuenta, también los que después fallan, y N llamadas simultáneas no pasan todas.
 * 2. Dentro de una transacción con candado (`budget-ledger.ts`): la cuota mensual de la persona
 *    (todas las funciones de IA) y el presupuesto global del mes. Lo comprometido = costo real de lo
 *    que respondió + costo MÁXIMO de cada solicitud pendiente o fallida. Si no cabe el costo máximo
 *    de esta llamada, se registra BLOCKED_BUDGET y no se llama.
 *
 * Las tareas del sistema (analista, evaluaciones) reservan con `userId: null`: sin cuotas por
 * persona, pero dentro del mismo presupuesto global. Un modelo sin precio no se llama (fallaría
 * DESPUÉS de gastar).
 */

const HOUR_SECONDS = 60 * 60;
const DAY_SECONDS = 24 * HOUR_SECONDS;

/**
 * Reserva una llamada de IA. Devuelve el id de la `AIRequest` PENDING, o lanza `AIError`
 * RATE_LIMITED (ráfaga por hora), QUOTA_EXCEEDED (cuota del día o del mes), BUDGET_EXCEEDED o
 * PROVIDER_ERROR (modelo sin precio).
 */
export async function reserveAiRequest({
  userId,
  feature,
  provider,
  input,
  now = new Date(),
  budget,
}: {
  userId: string | null;
  feature: AIFeature;
  provider: AiCallTarget;
  input: Prisma.InputJsonValue;
  now?: Date;
  /** Para pruebas; por omisión, el ajuste `ai.budget`. */
  budget?: AIBudget;
}): Promise<{ requestId: string }> {
  const limits = budget ?? (await getAiBudget());

  if (userId) {
    const hour = await rateLimit({
      key: rateLimitKey("ai", "user", userId)!,
      limit: limits.maxRequestsPerUserPerHour,
      windowSeconds: HOUR_SECONDS,
    });
    if (!hour.ok) throw new AIError("RATE_LIMITED", hour.retryAfterSeconds);
    const day = await rateLimit({
      key: rateLimitKey("ai.day", "user", userId)!,
      limit: limits.maxRequestsPerUserPerDay,
      windowSeconds: DAY_SECONDS,
    });
    if (!day.ok) throw new AIError("QUOTA_EXCEEDED", day.retryAfterSeconds, "day");
  }

  let reserved;
  try {
    reserved = await reserveBudget(db, {
      userId,
      feature,
      target: provider,
      input,
      budget: limits,
      now,
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
  throw new AIError("BUDGET_EXCEEDED");
}
