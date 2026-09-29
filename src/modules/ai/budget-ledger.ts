import type { Prisma } from "@/generated/prisma/client";
import type { AIFeature, AIFunding } from "@/generated/prisma/enums";
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
 * Presupuesto global de IA contra la base (ADR-020, ADR-031, ADR-044), con el cliente de Prisma
 * INYECTADO: lo usan el guardián de la app (`reservation.ts`) y el script de evaluación
 * (`scripts/ai-eval.ts`), que no corre dentro de Next. Sin `server-only` a propósito; nada aquí
 * llega al navegador.
 *
 * Solo lo SUBSIDIADO (`funding` PLATFORM o SYSTEM) consume el presupuesto del mes; lo pagado con
 * saldo (USER_PAID, SELLER_PAID) ya está financiado y solo se registra para medir la cobertura.
 */

export type BudgetClient = Prisma.TransactionClient | Database;

export type AiCallTarget = { id: string; model: string; promptVersion: string };

/** Solicitudes que cuentan en el presupuesto de subsidio. */
export const SUBSIDIZED_FUNDING: readonly AIFunding[] = ["PLATFORM", "SYSTEM"];

export function isSubsidized(funding: AIFunding) {
  return SUBSIDIZED_FUNDING.includes(funding);
}

export function monthStart(date: Date, offsetMonths = 0) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + offsetMonths, 1));
}

export function dayStart(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

/**
 * Gasto comprometido en micro-dólares desde `since`: costo real de lo que respondió + costo MÁXIMO
 * (`maxCallCostMicrosUsd`) de cada solicitud pendiente o fallida (una salida inválida, un error o
 * un timeout ya pudieron facturar tokens). Solo lo subsidiado; opcionalmente una sola función.
 */
async function committedSince(
  client: BudgetClient,
  since: Date,
  fallbackEstimate: number,
  feature?: AIFeature,
): Promise<number> {
  const request = {
    funding: { in: [...SUBSIDIZED_FUNDING] },
    ...(feature ? { feature } : {}),
  };
  const [answered, open] = await Promise.all([
    client.aIResponse.aggregate({
      _sum: { costMicrosUsd: true },
      where: { createdAt: { gte: since }, request },
    }),
    client.aIRequest.groupBy({
      by: ["model"],
      where: { createdAt: { gte: since }, status: { in: ["PENDING", "FAILED"] }, ...request },
      _count: { _all: true },
    }),
  ]);
  const reserved = open.reduce(
    (sum, row) => sum + row._count._all * (maxCallCostMicrosUsd(row.model) ?? fallbackEstimate),
    0,
  );
  return (answered._sum.costMicrosUsd ?? 0) + reserved;
}

/** Gasto subsidiado comprometido del mes (UTC). */
export function committedSpendMicros(client: BudgetClient, now: Date, fallbackEstimate: number) {
  return committedSince(client, monthStart(now), fallbackEstimate);
}

/** Gasto subsidiado de una función en lo que va del día (UTC): el tope diario de Pruébatelo. */
export function featureSpendTodayMicros(
  client: BudgetClient,
  feature: AIFeature,
  now: Date,
  fallbackEstimate: number,
) {
  return committedSince(client, dayStart(now), fallbackEstimate, feature);
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
  /** El tope diario de subsidio de la función se agotó (Pruébatelo gratis). */
  | { ok: false; reason: "daily_cap" }
  | { ok: false; reason: "month_quota"; retryAfterSeconds: number };

/**
 * Reserva una llamada: dentro de una transacción con candado (`pg_advisory_xact_lock`, todas las
 * reservas en serie) revisa la cuota mensual de la persona (si hay persona y la llamada es
 * subsidiada), el tope diario de la función (si se pide) y el presupuesto global, y crea la
 * `AIRequest` PENDING. Si no cabe el costo MÁXIMO de esta llamada, registra BLOCKED_BUDGET. Lanza si
 * el modelo no tiene precio: no se llama a ciegas. Lo PAGADO con saldo no pasa por el presupuesto ni
 * por la cuota mensual (la cuota por hora y por día sigue en `reservation.ts`); `reserve` es un
 * paso más que se ejecuta dentro de la misma transacción (p. ej. cobrar el saldo).
 */
export async function reserveBudget(
  client: Database,
  {
    userId,
    feature,
    target,
    input,
    budget,
    funding = "PLATFORM",
    featureDailyCapMicros = null,
    now = new Date(),
    reserve,
  }: {
    userId: string | null;
    feature: AIFeature;
    target: AiCallTarget;
    input: Prisma.InputJsonValue;
    budget: AIBudget;
    funding?: AIFunding;
    featureDailyCapMicros?: number | null;
    now?: Date;
    /** Se corre en la misma transacción después de crear la solicitud; si falla, nada se guarda. */
    reserve?: (tx: Prisma.TransactionClient, requestId: string) => Promise<void>;
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
    funding,
  };
  const subsidized = isSubsidized(funding);
  return client.$transaction(async (tx) => {
    // Un solo candado para el presupuesto global: reservas en serie (una consulta corta cada una).
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${"ai:budget"}, 0))`;
    if (userId && subsidized) {
      const used = await tx.aIRequest.count({
        where: {
          userId,
          createdAt: { gte: monthStart(now) },
          status: { in: ["PENDING", "SUCCEEDED", "FAILED"] },
          funding: { in: [...SUBSIDIZED_FUNDING] },
        },
      });
      if (used >= budget.maxRequestsPerUserPerMonth) {
        const retryAfterSeconds = Math.ceil((monthStart(now, 1).getTime() - now.getTime()) / 1000);
        return { ok: false as const, reason: "month_quota" as const, retryAfterSeconds };
      }
    }
    if (subsidized) {
      if (featureDailyCapMicros !== null) {
        const today = await featureSpendTodayMicros(tx, feature, now, estimate);
        if (today + estimate > featureDailyCapMicros) {
          await tx.aIRequest.create({ data: { ...request, input: {}, status: "BLOCKED_BUDGET" } });
          return { ok: false as const, reason: "daily_cap" as const };
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
    }
    const created = await tx.aIRequest.create({
      data: { ...request, input },
      select: { id: true },
    });
    if (reserve) await reserve(tx, created.id);
    return { ok: true as const, requestId: created.id };
  });
}
