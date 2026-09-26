import {
  activeSellers,
  aiUsage,
  feedTotals,
  newSellerFirstSales,
  type PersonFeedActivity,
  personFeedActivity,
  platformRevenueCents,
  reportsCreated,
  retainedUsers,
  signedInFeedTotals,
} from "@/modules/analytics/platform-aggregates";
import {
  AI_BUDGET_KEY,
  aiBudgetSchema,
  DEFAULT_AI_BUDGET,
  monthlyAiLimitMicros,
} from "@/modules/ai/budget";
import { mxnCentsToMicrosUsd } from "@/modules/ai/cost";
import { addDays, type Day, dayEnd, dayStart, dayToDbDate } from "@/modules/platform/calendar";
import { type Client, inTransaction, parallel } from "@/modules/platform/client";
import { assignVariant, type Variant } from "@/modules/platform/experiments";
import { type MetricKey, variantDimension } from "./metric-catalog";

/**
 * `aggregateDailyMetrics(day)`: calcula las filas de `DailyMetric` de un día de México a partir de
 * eventos y tablas del dominio (P2: código, nunca IA). Idempotente: upsert por (día, llave,
 * dimensión), así que se puede volver a correr (eventos tardíos, reintentos). Las definiciones de cada
 * métrica están en `metric-catalog.ts` y las consultas en `analytics/platform-aggregates.ts`.
 *
 * Las filas del feed (totales y por variante) cuentan SOLO a personas con sesión
 * (`signedInFeedTotals`): el tráfico anónimo queda en métricas descriptivas
 * (`feed.impressions.visible.anonymous`, `feed.impressions.served`, `product.visits`) con las que
 * nada se decide.
 */

type Row = { key: MetricKey; dimension: string; value: number; sampleSize: number };

function count(key: MetricKey, value: number, dimension = ""): Row {
  return { key, dimension, value, sampleSize: Math.max(0, Math.round(value)) };
}

/** Tasa = numerador ÷ denominador (× escala); la muestra es el denominador. Sin denominador: 0 y 0. */
function rate(
  key: MetricKey,
  numerator: number,
  denominator: number,
  scale = 1,
  dimension = "",
): Row {
  return {
    key,
    dimension,
    value: denominator > 0 ? (scale * numerator) / denominator : 0,
    sampleSize: Math.max(0, Math.round(denominator)),
  };
}

export function utcMonthStart(date: Date, offsetMonths = 0) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + offsetMonths, 1));
}

type FeedCounts = {
  impressions: number;
  commerceImpressions: number;
  productVisitsFromFeed: number;
  engagements: number;
  notInterested: number;
  reports: number;
  viewers: number;
};

/** Filas de feed (totales o de una variante) a partir de conteos. */
function feedRows(counts: FeedCounts, dimension = ""): Row[] {
  return [
    count("feed.impressions.visible", counts.impressions, dimension),
    count("feed.impressions.commerce", counts.commerceImpressions, dimension),
    count("feed.product_visits", counts.productVisitsFromFeed, dimension),
    count("feed.viewers", counts.viewers, dimension),
    rate("feed.commerce.share", counts.commerceImpressions, counts.impressions, 1, dimension),
    rate(
      "feed.commerce.ctr",
      counts.productVisitsFromFeed,
      counts.commerceImpressions,
      1,
      dimension,
    ),
    rate(
      "feed.product_visits.rate",
      counts.productVisitsFromFeed,
      counts.impressions,
      1,
      dimension,
    ),
    rate("feed.engagement.rate", counts.engagements, counts.impressions, 1, dimension),
    rate(
      "not_interested.per_1k_impressions",
      counts.notInterested,
      counts.impressions,
      1000,
      dimension,
    ),
    rate("reports.per_1k_impressions", counts.reports, counts.impressions, 1000, dimension),
  ];
}

/** Suma la actividad por persona de cada variante (la persona es la unidad de asignación). */
export function sumByVariant(
  people: readonly PersonFeedActivity[],
  experiment: { key: string; allocation: number },
): Record<Variant, FeedCounts> {
  const empty = (): FeedCounts => ({
    impressions: 0,
    commerceImpressions: 0,
    productVisitsFromFeed: 0,
    engagements: 0,
    notInterested: 0,
    reports: 0,
    viewers: 0,
  });
  const totals: Record<Variant, FeedCounts> = { control: empty(), treatment: empty() };
  for (const person of people) {
    const bucket = totals[assignVariant(experiment.key, person.userId, experiment.allocation)];
    bucket.impressions += person.impressions;
    bucket.commerceImpressions += person.commerceImpressions;
    bucket.productVisitsFromFeed += person.productVisitsFromFeed;
    bucket.engagements += person.engagements;
    bucket.notInterested += person.notInterested;
    bucket.reports += person.reports;
    bucket.viewers += 1;
  }
  return totals;
}

/** Tope de IA del mes que empieza en `monthStart` (UTC), como el guardián de presupuesto. */
export async function aiBudgetLimitMicros(client: Client, monthStart: Date): Promise<number> {
  const setting = await client.platformSetting.findUnique({
    where: { key: AI_BUDGET_KEY },
    select: { value: true },
  });
  const parsed = aiBudgetSchema.safeParse(setting?.value);
  const budget = parsed.success ? parsed.data : DEFAULT_AI_BUDGET;
  const revenueCents = await platformRevenueCents(
    client,
    utcMonthStart(monthStart, -1),
    monthStart,
  );
  return monthlyAiLimitMicros(budget, mxnCentsToMicrosUsd(revenueCents, budget.mxnPerUsd));
}

export type AggregationSummary = { day: Day; rows: number; experiments: number };

export async function aggregateDailyMetrics(
  client: Client,
  day: Day,
  now: Date = new Date(),
): Promise<AggregationSummary> {
  const start = dayStart(day);
  const end = dayEnd(day);
  if (start.getTime() > now.getTime()) throw new RangeError(`El día ${day} todavía no empieza.`);
  const lastInstant = new Date(end.getTime() - 1);
  const monthStart = utcMonthStart(lastInstant);

  const [signedIn, feed, sellers, firstSales, reports, d1, d7, aiDay, aiMonth, limitMicros] =
    await parallel(client, [
      () => signedInFeedTotals(client, start, end),
      () => feedTotals(client, start, end),
      () => activeSellers(client, end),
      () => newSellerFirstSales(client, end),
      () => reportsCreated(client, start, end),
      () =>
        retainedUsers(client, { start: dayStart(addDays(day, -1)), end: start }, { start, end }),
      () =>
        retainedUsers(
          client,
          { start: dayStart(addDays(day, -7)), end: dayStart(addDays(day, -6)) },
          { start, end },
        ),
      () => aiUsage(client, start, end),
      () => aiUsage(client, monthStart, end),
      () => aiBudgetLimitMicros(client, monthStart),
    ]);

  const rows: Row[] = [
    // Personas con sesión: lo único con lo que se decide.
    ...feedRows(signedIn),
    rate("feed.impressions.per_viewer", signedIn.impressions, signedIn.viewers),
    // Descriptivas (T5): las visibles anónimas y la pieza servida, para comparar, nunca para decidir.
    count("feed.impressions.visible.anonymous", feed.anonymousImpressions),
    count("feed.impressions.served", feed.servedImpressions),
    count("sellers.active", sellers),
    count("product.visits", feed.productVisits),
    rate("product.visits.per_active_seller", feed.signedInProductVisits, sellers),
    rate("sellers.first_sale.rate_30d", firstSales.withSale, firstSales.newSellers),
    count("reports.count", reports),
    count("not_interested.count", feed.notInterested),
    rate("retention.d1", d1.retained, d1.cohort),
    rate("retention.d7", d7.retained, d7.cohort),
    count("ai.requests", aiDay.requests),
    count("ai.requests.simulated", aiDay.simulatedRequests),
    {
      key: "ai.cost.micros_usd",
      dimension: "",
      value: aiDay.costMicrosUsd,
      sampleSize: aiDay.requests,
    },
    {
      key: "ai.cost.mtd.micros_usd",
      dimension: "",
      value: aiMonth.costMicrosUsd,
      sampleSize: aiMonth.requests,
    },
    { key: "ai.budget.limit.micros_usd", dimension: "", value: limitMicros, sampleSize: 1 },
    {
      key: "ai.budget.used.share",
      dimension: "",
      value: limitMicros > 0 ? aiMonth.costMicrosUsd / limitMicros : 0,
      sampleSize: limitMicros > 0 ? 1 : 0,
    },
  ];

  // Cortes por variante de los experimentos que corrieron en algún momento del día.
  const experiments = await client.experiment.findMany({
    where: {
      status: { in: ["RUNNING", "STOPPED", "CONCLUDED"] },
      startedAt: { lt: end },
      OR: [{ endedAt: null }, { endedAt: { gt: start } }],
    },
    select: { key: true, allocation: true, startedAt: true, endedAt: true },
  });
  for (const experiment of experiments) {
    const from =
      experiment.startedAt && experiment.startedAt > start ? experiment.startedAt : start;
    const to = experiment.endedAt && experiment.endedAt < end ? experiment.endedAt : end;
    const people = await personFeedActivity(client, from, to);
    const byVariant = sumByVariant(people, experiment);
    for (const variant of ["control", "treatment"] as const) {
      rows.push(...feedRows(byVariant[variant], variantDimension(experiment.key, variant)));
    }
  }

  const date = dayToDbDate(day);
  await inTransaction(client, async (tx) => {
    for (const row of rows) {
      await tx.dailyMetric.upsert({
        where: { day_key_dimension: { day: date, key: row.key, dimension: row.dimension } },
        create: { day: date, ...row },
        update: { value: row.value, sampleSize: row.sampleSize },
      });
    }
  });
  return { day, rows: rows.length, experiments: experiments.length };
}
