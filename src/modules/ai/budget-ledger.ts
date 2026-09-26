import type { Prisma } from "@/generated/prisma/client";
import type { AIFeature } from "@/generated/prisma/enums";
import type { Database } from "@/server/db-client";
import {
  AI_BUDGET_KEY,
  type AIBudget,
  aiBudgetSchema,
  DEFAULT_AI_BUDGET,
  monthlyAiLimitMicros,
} from "./budget";
import { maxCallCostMicrosUsd, mxnCentsToMicrosUsd } from "./cost";

/**
 * Presupuesto global de IA contra la base (ADR-020, ADR-031), con el cliente de Prisma INYECTADO:
 * lo usan el guardián de la app (`reservation.ts`) y el script de evaluación (`scripts/ai-eval.ts`),
 * que no corre dentro de Next. Sin `server-only` a propósito; nada aquí llega al navegador.
 */

export type BudgetClient = Prisma.TransactionClient | Database;

export type AiCallTarget = { id: string; model: string; promptVersion: string };

export function monthStart(date: Date, offsetMonths = 0) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + offsetMonths, 1));
}

/**
 * Gasto comprometido del mes en micro-dólares: costo real de lo que respondió + costo MÁXIMO
 * (`maxCallCostMicrosUsd`) de cada solicitud pendiente o fallida (una salida inválida, un error o
 * un timeout ya pudieron facturar tokens).
 */
export async function committedSpendMicros(
  client: BudgetClient,
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
export async function monthlyLimitMicros(client: BudgetClient, budget: AIBudget, now: Date) {
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

/** El ajuste `ai.budget` validado (o el valor por defecto), sin la caché de React. */
export async function readAiBudget(client: BudgetClient): Promise<AIBudget> {
  const row = await client.platformSetting.findUnique({
    where: { key: AI_BUDGET_KEY },
    select: { value: true },
  });
  const parsed = row ? aiBudgetSchema.safeParse(row.value) : null;
  return parsed?.success ? parsed.data : DEFAULT_AI_BUDGET;
}

export type BudgetReservation =
  | { ok: true; requestId: string }
  | { ok: false; reason: "budget" }
  | { ok: false; reason: "month_quota"; retryAfterSeconds: number };

/**
 * Reserva una llamada: dentro de una transacción con candado (`pg_advisory_xact_lock`, todas las
 * reservas en serie) revisa la cuota mensual de la persona (si hay persona) y el presupuesto global,
 * y crea la `AIRequest` PENDING. Si no cabe el costo MÁXIMO de esta llamada, registra
 * BLOCKED_BUDGET. Lanza si el modelo no tiene precio: no se llama a ciegas.
 */
export async function reserveBudget(
  client: Database,
  {
    userId,
    feature,
    target,
    input,
    budget,
    now = new Date(),
  }: {
    userId: string | null;
    feature: AIFeature;
    target: AiCallTarget;
    input: Prisma.InputJsonValue;
    budget: AIBudget;
    now?: Date;
  },
): Promise<BudgetReservation> {
  const estimate = maxCallCostMicrosUsd(target.model);
  if (estimate === null) throw new Error(`[ai] modelo sin precio configurado: ${target.model}`);
  const request = {
    userId,
    feature,
    provider: target.id,
    model: target.model,
    promptVersion: target.promptVersion,
  };
  return client.$transaction(async (tx) => {
    // Un solo candado para el presupuesto global: reservas en serie (una consulta corta cada una).
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${"ai:budget"}, 0))`;
    if (userId) {
      const used = await tx.aIRequest.count({
        where: {
          userId,
          createdAt: { gte: monthStart(now) },
          status: { in: ["PENDING", "SUCCEEDED", "FAILED"] },
        },
      });
      if (used >= budget.maxRequestsPerUserPerMonth) {
        const retryAfterSeconds = Math.ceil((monthStart(now, 1).getTime() - now.getTime()) / 1000);
        return { ok: false as const, reason: "month_quota" as const, retryAfterSeconds };
      }
    }
    const [committed, limit] = await Promise.all([
      committedSpendMicros(tx, now, estimate),
      monthlyLimitMicros(tx, budget, now),
    ]);
    if (committed >= limit || committed + estimate > limit) {
      await tx.aIRequest.create({ data: { ...request, input: {}, status: "BLOCKED_BUDGET" } });
      return { ok: false as const, reason: "budget" as const };
    }
    const created = await tx.aIRequest.create({
      data: { ...request, input },
      select: { id: true },
    });
    return { ok: true as const, requestId: created.id };
  });
}
