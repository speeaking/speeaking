import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import type { AIFeature } from "@/generated/prisma/enums";
import { getAiBudget } from "@/modules/platform/settings";
import { db } from "@/server/db";
import { rateLimitKey, rateLimitMany } from "@/server/rate-limit";
import { type AIBudget, monthlyAiLimitMicros } from "./budget";
import { maxCallCostMicrosUsd, mxnCentsToMicrosUsd } from "./cost";
import { AIError } from "./errors";

/**
 * Guardián de presupuesto de IA (ADR-020, SEC-19). Reserva ANTES de llamar al proveedor:
 *
 * 1. Cuotas por persona, por hora y por día, con el limitador atómico (`rateLimit`): cada intento
 *    cuenta, también los que después fallan, y N llamadas simultáneas no pasan todas.
 * 2. Presupuesto global del mes: dentro de una transacción con candado (`pg_advisory_xact_lock`) se
 *    suma lo comprometido y se crea la `AIRequest` PENDING. Lo comprometido = costo real de lo que
 *    respondió + costo MÁXIMO (`maxCallCostMicrosUsd`) de cada solicitud pendiente o fallida: una
 *    salida inválida, un error o un timeout ya facturaron tokens y cuentan. Si no cabe el costo
 *    máximo de esta llamada, se registra BLOCKED_BUDGET y no se llama.
 *
 * Un modelo sin precio no se llama (fallaría DESPUÉS de gastar).
 */

type Client = Prisma.TransactionClient | typeof db;

export type AiCallTarget = { id: string; model: string; promptVersion: string };

const HOUR_SECONDS = 60 * 60;
const DAY_SECONDS = 24 * HOUR_SECONDS;

export function monthStart(date: Date, offsetMonths = 0) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + offsetMonths, 1));
}

/** Gasto comprometido del mes en micro-dólares (ver arriba). */
export async function committedSpendMicros(
  client: Client,
  now: Date,
  fallbackEstimate: number,
): Promise<number> {
  const since = monthStart(now);
  const [answered, open] = await Promise.all([
    client.aIResponse.aggregate({
      _sum: { costMicrosUsd: true },
      where: { createdAt: { gte: since } },
    }),
    client.aIRequest.groupBy({
      by: ["model"],
      where: { createdAt: { gte: since }, status: { in: ["PENDING", "FAILED"] } },
      _count: { _all: true },
    }),
  ]);
  const reserved = open.reduce(
    (sum, row) => sum + row._count._all * (maxCallCostMicrosUsd(row.model) ?? fallbackEstimate),
    0,
  );
  return (answered._sum.costMicrosUsd ?? 0) + reserved;
}

/** Límite del mes: semilla + % de los ingresos de plataforma del mes anterior, con tope. */
async function monthlyLimitMicros(client: Client, budget: AIBudget, now: Date) {
  const revenue = await client.platformLedgerEntry.aggregate({
    _sum: { amountCents: true },
    where: {
      amountCents: { gt: 0 },
      occurredAt: { gte: monthStart(now, -1), lt: monthStart(now) },
    },
  });
  return monthlyAiLimitMicros(
    budget,
    mxnCentsToMicrosUsd(revenue._sum.amountCents ?? 0, budget.mxnPerUsd),
  );
}

/**
 * Reserva una llamada de IA para `userId`. Devuelve el id de la `AIRequest` PENDING, o lanza
 * `AIError` RATE_LIMITED / BUDGET_EXCEEDED / PROVIDER_ERROR (modelo sin precio).
 */
export async function reserveAiRequest({
  userId,
  feature,
  provider,
  input,
  now = new Date(),
  budget,
}: {
  userId: string;
  feature: AIFeature;
  provider: AiCallTarget;
  input: Prisma.InputJsonValue;
  now?: Date;
  /** Para pruebas; por omisión, el ajuste `ai.budget`. */
  budget?: AIBudget;
}): Promise<{ requestId: string }> {
  const limits = budget ?? (await getAiBudget());

  const perUser = await rateLimitMany([
    {
      key: rateLimitKey("ai", "user", userId),
      limit: limits.maxRequestsPerUserPerHour,
      windowSeconds: HOUR_SECONDS,
    },
    {
      key: rateLimitKey("ai.day", "user", userId),
      limit: limits.maxRequestsPerUserPerDay,
      windowSeconds: DAY_SECONDS,
    },
  ]);
  if (!perUser.ok) throw new AIError("RATE_LIMITED", perUser.retryAfterSeconds);

  const estimate = maxCallCostMicrosUsd(provider.model);
  if (estimate === null) {
    console.error(`[ai] modelo sin precio configurado: ${provider.model}`);
    throw new AIError("PROVIDER_ERROR");
  }

  const request = {
    userId,
    feature,
    provider: provider.id,
    model: provider.model,
    promptVersion: provider.promptVersion,
  };
  const reserved = await db.$transaction(async (tx) => {
    // Un solo candado para el presupuesto global: reservas en serie (una consulta corta cada una).
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${"ai:budget"}, 0))`;
    const [committed, limit] = await Promise.all([
      committedSpendMicros(tx, now, estimate),
      monthlyLimitMicros(tx, limits, now),
    ]);
    if (committed >= limit || committed + estimate > limit) {
      await tx.aIRequest.create({ data: { ...request, input: {}, status: "BLOCKED_BUDGET" } });
      return null;
    }
    return tx.aIRequest.create({ data: { ...request, input }, select: { id: true } });
  });
  if (!reserved) throw new AIError("BUDGET_EXCEEDED");
  return { requestId: reserved.id };
}
