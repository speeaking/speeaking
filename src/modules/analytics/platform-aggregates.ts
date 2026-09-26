import { Prisma } from "@/generated/prisma/client";
import { SIMULATED_PROVIDER_ID } from "@/modules/ai/tasks/simulation";
import type { Database } from "@/server/db-client";

/**
 * Agregados de solo lectura para las métricas diarias del motor de automejora (`ceo/metrics.ts`).
 * Sin `server-only` ni `@/server/db`: reciben la base como parámetro para correr también en
 * `scripts/ops-daily.ts` y en pruebas dentro de una transacción. No cambian cómo se registran los
 * eventos (`track`, `integrity.ts`); solo los cuentan.
 *
 * Definiciones (ver también `ceo/metric-catalog.ts`):
 * - Impresión del feed: impresión VISIBLE (T5, ADR-037), evento VISIBLE_IMPRESSION en las
 *   superficies FEED o COMMUNITY: al menos la mitad de la pieza en pantalla durante 1 segundo
 *   continuo, solo de piezas servidas a quien la reporta, una por persona (o IP), publicación y día
 *   (`visible-impressions.ts`).
 * - **Población que decide: personas con sesión** (y personalización: quien la desactiva queda
 *   anónimo en los eventos y no se distingue de un visitante sin cuenta). Todo lo que usa el motor
 *   para decidir (umbral de tráfico, salvaguardas, tasas del analista, exposición del monitor,
 *   experimentos) cuenta SOLO a quienes tuvieron al menos una impresión visible con persona ese
 *   día, y sus numeradores (reportes, «No me interesa», interacciones, visitas desde el feed) solo
 *   de esas mismas personas (`signedInFeedTotals`, `personFeedActivity`). Un robot sin cuenta que
 *   inunde impresiones o visitas anónimas no mueve ninguna de esas tasas: no fuerza ni esconde una
 *   reversión.
 * - Impresiones visibles anónimas (`anonymousImpressions`) y piezas servidas (`servedImpressions`,
 *   una por persona o IP, publicación y hora): solo descriptivas; ninguna decisión se toma con ellas.
 * - Comercial: `metadata.slot = 'commerce'` (el espacio que ocupó en la mezcla; sobrevive a la
 *   anonimización).
 * - Visita a producto desde el feed: PRODUCT_VIEW con superficie FEED y publicación de origen
 *   verificada (`sourcePostId`, integrity.ts), sin las del dueño del producto.
 * - Interacción: LIKE, SAVE, COMMENT y SHARE sobre publicaciones, más las visitas desde el feed.
 */

export type AggregateClient = Database | Prisma.TransactionClient;

/**
 * ¿Las impresiones del feed son VISIBLES (T5, plan-90-dias.md §2.1) o solo piezas servidas? El
 * umbral de tráfico del motor de automejora se mide en impresiones visibles (§2.4, «no en piezas
 * servidas»). Desde T5 las consultas de abajo cuentan `VISIBLE_IMPRESSION`, así que es `true`; si
 * alguna vez volvieran a contar piezas servidas, debe regresar a `false` (el umbral no se cumple).
 */
export const FEED_IMPRESSIONS_ARE_VISIBLE = true;

/**
 * Primer día COMPLETO (de México) cuyas filas de `DailyMetric` por impresión cuentan impresiones
 * VISIBLES de personas con sesión. Las de días anteriores se calcularon con piezas servidas (muchas
 * más por persona) y con el tráfico anónimo: compararlas con las nuevas inventaría cambios, así que
 * el motor no las usa (`ceo/metric-rows.ts`).
 * El día en que se instaló T5 tampoco: las visibles empezaron a media tarde (2026-09-26, 13:09 de
 * México, en la base de desarrollo) y sus tasas dividirían reportes o interacciones de TODO el día
 * entre las impresiones de unas horas. Al instalar T5 en otro entorno con filas anteriores, este
 * valor debe ser el primer día completo después de instalarlo.
 */
export const VISIBLE_IMPRESSIONS_SINCE = "2026-09-27";

const FEED_SURFACES = ["FEED", "COMMUNITY"];
const POST_ENGAGEMENT_TYPES = ["LIKE", "SAVE", "COMMENT", "SHARE"];

/** Conteos descriptivos de TODO el tráfico (con y sin sesión). Ninguna decisión se toma con ellos. */
export type FeedTotals = {
  /** Impresiones visibles SIN persona (sin sesión o sin personalización). */
  anonymousImpressions: number;
  /** Piezas servidas (IMPRESSION), con y sin persona. */
  servedImpressions: number;
  /** Todas las visitas a producto (cualquier origen, con y sin sesión), sin las del dueño. */
  productVisits: number;
  /** Visitas a producto con persona (cualquier origen), sin las del dueño. */
  signedInProductVisits: number;
  /** Todos los «No me interesa» del día (con y sin persona). */
  notInterested: number;
};

export async function feedTotals(
  client: AggregateClient,
  start: Date,
  end: Date,
): Promise<FeedTotals> {
  // Una tras otra: dentro de una transacción no se pueden encimar consultas en la misma conexión.
  const events = await client.$queryRaw<
    { anonymousImpressions: number; servedImpressions: number; notInterested: number }[]
  >`
      SELECT
        count(*) FILTER (WHERE e."type" = 'VISIBLE_IMPRESSION' AND e."userId" IS NULL
          AND e."surface"::text = ANY(${FEED_SURFACES}::text[]))::int AS "anonymousImpressions",
        count(*) FILTER (WHERE e."type" = 'IMPRESSION' AND e."surface"::text = ANY(${FEED_SURFACES}::text[]))::int AS "servedImpressions",
        count(*) FILTER (WHERE e."type" = 'NOT_INTERESTED')::int AS "notInterested"
      FROM "analytics_events" e
      WHERE e."createdAt" >= ${start} AND e."createdAt" < ${end}
        AND e."type" IN ('VISIBLE_IMPRESSION', 'IMPRESSION', 'NOT_INTERESTED')`;
  const visits = await client.$queryRaw<{ productVisits: number; signedIn: number }[]>`
      SELECT
        count(*)::int AS "productVisits",
        count(*) FILTER (WHERE e."userId" IS NOT NULL)::int AS "signedIn"
      FROM "analytics_events" e
      LEFT JOIN "products" p ON p."id" = e."entityId"
      LEFT JOIN "seller_profiles" s ON s."id" = p."sellerId"
      WHERE e."type" = 'PRODUCT_VIEW'
        AND e."createdAt" >= ${start} AND e."createdAt" < ${end}
        AND (e."userId" IS NULL OR s."userId" IS NULL OR e."userId" <> s."userId")`;
  const row = events[0];
  const visit = visits[0];
  return {
    anonymousImpressions: row?.anonymousImpressions ?? 0,
    servedImpressions: row?.servedImpressions ?? 0,
    productVisits: visit?.productVisits ?? 0,
    signedInProductVisits: visit?.signedIn ?? 0,
    notInterested: row?.notInterested ?? 0,
  };
}

/**
 * Personas distintas (con sesión) con impresiones VISIBLES del feed en todo el periodo, y sus
 * impresiones.
 * Con esto se calcula cuántas impresiones junta una persona en una VENTANA de varios días (el tamaño
 * del clúster del efecto de diseño), que es mayor que el promedio por persona y día.
 */
export async function feedViewersInPeriod(
  client: AggregateClient,
  start: Date,
  end: Date,
): Promise<{ viewers: number; personalImpressions: number }> {
  const [row] = await client.$queryRaw<{ viewers: number; personalImpressions: number }[]>`
    SELECT count(DISTINCT e."userId")::int AS "viewers", count(*)::int AS "personalImpressions"
    FROM "analytics_events" e
    WHERE e."type" = 'VISIBLE_IMPRESSION' AND e."surface"::text = ANY(${FEED_SURFACES}::text[])
      AND e."userId" IS NOT NULL
      AND e."createdAt" >= ${start} AND e."createdAt" < ${end}`;
  return { viewers: row?.viewers ?? 0, personalImpressions: row?.personalImpressions ?? 0 };
}

/** Actividad del feed de una persona en un periodo (unidad de análisis de los experimentos). */
export type PersonFeedActivity = {
  userId: string;
  impressions: number;
  commerceImpressions: number;
  productVisitsFromFeed: number;
  engagements: number;
  notInterested: number;
  reports: number;
};

/**
 * Una fila por persona con al menos una impresión VISIBLE del feed en el periodo (solo cuentas con
 * personalización: la actividad anónima no se puede atribuir a nadie, a propósito). Cada numerador
 * cuenta solo lo de esa persona en el mismo periodo.
 */
function personActivitySql(start: Date, end: Date): Prisma.Sql {
  return Prisma.sql`
    WITH imp AS (
      SELECT e."userId",
        count(*)::int AS "impressions",
        count(*) FILTER (WHERE e."metadata"->>'slot' = 'commerce')::int AS "commerceImpressions"
      FROM "analytics_events" e
      WHERE e."type" = 'VISIBLE_IMPRESSION' AND e."surface"::text = ANY(${FEED_SURFACES}::text[])
        AND e."userId" IS NOT NULL
        AND e."createdAt" >= ${start} AND e."createdAt" < ${end}
      GROUP BY e."userId"
    ), act AS (
      SELECT e."userId",
        count(*) FILTER (WHERE e."type" = 'PRODUCT_VIEW' AND e."surface" = 'FEED'
          AND e."sourcePostId" IS NOT NULL
          AND (s."userId" IS NULL OR s."userId" <> e."userId"))::int AS "visits",
        count(*) FILTER (WHERE e."type"::text = ANY(${POST_ENGAGEMENT_TYPES}::text[])
          AND e."entityType" = 'POST')::int AS "postEngagements",
        count(*) FILTER (WHERE e."type" = 'NOT_INTERESTED')::int AS "notInterested"
      FROM "analytics_events" e
      LEFT JOIN "products" p ON e."type" = 'PRODUCT_VIEW' AND p."id" = e."entityId"
      LEFT JOIN "seller_profiles" s ON s."id" = p."sellerId"
      WHERE e."userId" IN (SELECT "userId" FROM imp)
        AND e."createdAt" >= ${start} AND e."createdAt" < ${end}
        AND e."type" IN ('PRODUCT_VIEW', 'LIKE', 'SAVE', 'COMMENT', 'SHARE', 'NOT_INTERESTED')
      GROUP BY e."userId"
    ), rep AS (
      SELECT r."reporterId" AS "userId", count(*)::int AS "reports"
      FROM "reports" r
      WHERE r."reporterId" IN (SELECT "userId" FROM imp)
        AND r."createdAt" >= ${start} AND r."createdAt" < ${end}
      GROUP BY r."reporterId"
    )
    SELECT imp."userId"::text AS "userId",
      imp."impressions",
      imp."commerceImpressions",
      COALESCE(act."visits", 0)::int AS "productVisitsFromFeed",
      (COALESCE(act."postEngagements", 0) + COALESCE(act."visits", 0))::int AS "engagements",
      COALESCE(act."notInterested", 0)::int AS "notInterested",
      COALESCE(rep."reports", 0)::int AS "reports"
    FROM imp
    LEFT JOIN act ON act."userId" = imp."userId"
    LEFT JOIN rep ON rep."userId" = imp."userId"`;
}

export async function personFeedActivity(
  client: AggregateClient,
  start: Date,
  end: Date,
): Promise<PersonFeedActivity[]> {
  return client.$queryRaw<PersonFeedActivity[]>(personActivitySql(start, end));
}

/** Totales del feed de la población que decide: personas con sesión e impresiones visibles. */
export type SignedInFeedTotals = Omit<PersonFeedActivity, "userId"> & {
  /** Personas distintas con al menos una impresión visible con persona. */
  viewers: number;
};

/**
 * Suma de `personFeedActivity` hecha en la base (sin traer una fila por persona): lo único con lo que
 * el motor decide. Es exactamente la suma de las dos variantes de un experimento que cubra todo el
 * periodo. Lo anónimo (sin sesión o sin personalización) no entra ni en el denominador ni en los
 * numeradores.
 */
export async function signedInFeedTotals(
  client: AggregateClient,
  start: Date,
  end: Date,
): Promise<SignedInFeedTotals> {
  const [row] = await client.$queryRaw<SignedInFeedTotals[]>`
    SELECT count(*)::int AS "viewers",
      COALESCE(sum(a."impressions"), 0)::int AS "impressions",
      COALESCE(sum(a."commerceImpressions"), 0)::int AS "commerceImpressions",
      COALESCE(sum(a."productVisitsFromFeed"), 0)::int AS "productVisitsFromFeed",
      COALESCE(sum(a."engagements"), 0)::int AS "engagements",
      COALESCE(sum(a."notInterested"), 0)::int AS "notInterested",
      COALESCE(sum(a."reports"), 0)::int AS "reports"
    FROM (${personActivitySql(start, end)}) a`;
  return {
    viewers: row?.viewers ?? 0,
    impressions: row?.impressions ?? 0,
    commerceImpressions: row?.commerceImpressions ?? 0,
    productVisitsFromFeed: row?.productVisitsFromFeed ?? 0,
    engagements: row?.engagements ?? 0,
    notInterested: row?.notInterested ?? 0,
    reports: row?.reports ?? 0,
  };
}

/**
 * Vendedores activos: perfil de vendedor ACTIVE con al menos un producto ACTIVE, visible (no oculto
 * por moderación), con existencias y publicado antes de `end`. Es una foto del estado al calcular.
 */
export async function activeSellers(client: AggregateClient, end: Date): Promise<number> {
  const [row] = await client.$queryRaw<{ count: number }[]>`
    SELECT count(DISTINCT s."id")::int AS "count"
    FROM "seller_profiles" s
    JOIN "products" p ON p."sellerId" = s."id"
    WHERE s."status" = 'ACTIVE' AND p."status" = 'ACTIVE' AND p."moderationStatus" = 'VISIBLE'
      AND p."stock" > 0 AND COALESCE(p."publishedAt", p."createdAt") < ${end}`;
  return row?.count ?? 0;
}

/** Vendedores dados de alta en [end − 30 días, end) y cuántos tienen un pedido pagado antes de `end`. */
export async function newSellerFirstSales(
  client: AggregateClient,
  end: Date,
): Promise<{ newSellers: number; withSale: number }> {
  const since = new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000);
  const [row] = await client.$queryRaw<{ newSellers: number; withSale: number }[]>`
    SELECT count(*)::int AS "newSellers",
      count(*) FILTER (WHERE EXISTS (
        SELECT 1 FROM "orders" o
        WHERE o."sellerId" = s."id" AND o."paidAt" IS NOT NULL AND o."paidAt" < ${end}
      ))::int AS "withSale"
    FROM "seller_profiles" s
    WHERE s."createdAt" >= ${since} AND s."createdAt" < ${end}`;
  return { newSellers: row?.newSellers ?? 0, withSale: row?.withSale ?? 0 };
}

export async function reportsCreated(
  client: AggregateClient,
  start: Date,
  end: Date,
): Promise<number> {
  return client.report.count({ where: { createdAt: { gte: start, lt: end } } });
}

/**
 * Retención aproximada: de las cuentas creadas en [cohortStart, cohortEnd), cuántas tuvieron
 * actividad en [activeStart, activeEnd) (un evento con persona o una sesión creada o renovada). Es una
 * cota inferior: quien desactiva la personalización deja eventos anónimos.
 */
export async function retainedUsers(
  client: AggregateClient,
  cohort: { start: Date; end: Date },
  active: { start: Date; end: Date },
): Promise<{ cohort: number; retained: number }> {
  const [row] = await client.$queryRaw<{ cohort: number; retained: number }[]>`
    SELECT count(*)::int AS "cohort",
      count(*) FILTER (WHERE
        EXISTS (
          SELECT 1 FROM "analytics_events" e
          WHERE e."userId" = u."id" AND e."createdAt" >= ${active.start} AND e."createdAt" < ${active.end}
        )
        OR EXISTS (
          SELECT 1 FROM "sessions" se
          WHERE se."userId" = u."id"
            AND ((se."createdAt" >= ${active.start} AND se."createdAt" < ${active.end})
              OR (se."updatedAt" >= ${active.start} AND se."updatedAt" < ${active.end}))
        )
      )::int AS "retained"
    FROM "users" u
    WHERE u."createdAt" >= ${cohort.start} AND u."createdAt" < ${cohort.end}`;
  return { cohort: row?.cohort ?? 0, retained: row?.retained ?? 0 };
}

/**
 * Solicitudes de IA creadas (con cualquier resultado) y costo registrado de sus respuestas en el
 * periodo. `requests` son las que fueron a un modelo de verdad; las de la IA simulada (plantillas
 * sin modelo, ADR-038, incluidas las que se negaron en producción sin `ALLOW_SIMULATED_AI`) van
 * aparte en `simulatedRequests`: nunca cuentan como generaciones de IA.
 */
export async function aiUsage(
  client: AggregateClient,
  start: Date,
  end: Date,
): Promise<{ requests: number; simulatedRequests: number; costMicrosUsd: number }> {
  const period = { createdAt: { gte: start, lt: end } };
  const requests = await client.aIRequest.count({
    where: { ...period, provider: { not: SIMULATED_PROVIDER_ID } },
  });
  const simulatedRequests = await client.aIRequest.count({
    where: { ...period, provider: SIMULATED_PROVIDER_ID },
  });
  const cost = await client.aIResponse.aggregate({
    _sum: { costMicrosUsd: true },
    where: period,
  });
  return { requests, simulatedRequests, costMicrosUsd: cost._sum.costMicrosUsd ?? 0 };
}

/** Tipos de asiento que son ingreso de la plataforma (los costos no cuentan, H5). */
export const REVENUE_LEDGER_KINDS = [
  "COMMISSION",
  "SUBSCRIPTION",
  "PROMOTION",
  "AI_PREMIUM",
] as const;

/** Ingresos de plataforma (centavos MXN) en el periodo: solo asientos positivos de ingreso. */
export async function platformRevenueCents(
  client: AggregateClient,
  start: Date,
  end: Date,
): Promise<number> {
  const result = await client.platformLedgerEntry.aggregate({
    _sum: { amountCents: true },
    where: {
      kind: { in: [...REVENUE_LEDGER_KINDS] },
      amountCents: { gt: 0 },
      occurredAt: { gte: start, lt: end },
    },
  });
  return result._sum.amountCents ?? 0;
}
