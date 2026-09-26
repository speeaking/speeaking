import "server-only";
import type { Surface } from "@/generated/prisma/enums";
import { type Day, mexicoDay } from "@/modules/platform/calendar";
import { getFeedExperimentAssignments } from "@/modules/platform/settings";
import { ipNetwork } from "@/server/client-ip";
import { db } from "@/server/db";
import { rateLimit } from "@/server/rate-limit";
import { prepareEvent, type TrackedEvent } from "./event";
import { digest, eventActor, servedImpressionKey } from "./integrity";
import { isPersonalizationEnabled } from "./personalization";
import type {
  VisibleImpressionOutcome,
  VisibleImpressionReport,
} from "./visible-impression-contract";

/**
 * Impresiones VISIBLES del feed (T5, ADR-037). El navegador avisa cuando una pieza estuvo al menos a
 * la mitad en pantalla durante 1 segundo continuo (`feed/components/visible-impressions.ts`); aquí
 * se decide si cuenta. Solo cuenta lo que se SIRVIÓ a quien lo reporta (nadie infla impresiones de
 * piezas que no vio):
 *
 * - **Con sesión y personalización:** debe existir su impresión servida (`IMPRESSION` con su
 *   `userId`) de esa publicación en las últimas 24 h. Posición, puntuación, versión del algoritmo y
 *   espacio (comercial o no) se copian de lo servido; la variante de cada experimento la calcula el
 *   servidor. Es lo único con lo que decide el motor de automejora (umbral de tráfico, salvaguardas,
 *   analista y experimentos; `platform-aggregates.ts`); las demás son descriptivas.
 * - **Sin personalización o sin sesión, con IP de confianza o cuenta:** lo servido se guardó anónimo
 *   (SEC-16), así que el comprobante es la cubeta que deduplica la pieza servida para esa cuenta o IP
 *   (`servedImpressionKey`): vale una hora desde que se sirvió. Lo que llega después se descarta (se
 *   cuenta de menos, nunca de más).
 * - **Sin sesión ni IP** (`TRUSTED_PROXY_HOPS=0`): no hay a quién atar el comprobante. Las visibles
 *   anónimas de una publicación no pasan de sus servidas anónimas de las últimas 25 h, con un tope
 *   por hora (como las demás anónimas, `integrity.ts`). El conteo leído no basta con peticiones
 *   simultáneas: cada visible reserva además un lugar en un contador atómico por publicación
 *   (`claimAnonymousSlot`), que acota el exceso (ver ahí).
 *
 * Además: la publicación debe estar publicada, las vistas del autor no cuentan, y cada persona (o IP)
 * cuenta una vez por publicación y día de México. Lo que no pasa se descarta sin error. Se guarda con
 * el mismo estándar de privacidad que cualquier evento (`prepareEvent`): sin personalización, sin
 * persona, con la hora truncada y sin la variante.
 */

const HOUR_SECONDS = 60 * 60;
const HOUR_MS = HOUR_SECONDS * 1000;
/** Ventana en la que debe estar la pieza servida (personas con personalización). */
export const SERVED_LOOKBACK_HOURS = 24;
/** Tope de visibles anónimas por publicación y hora cuando no hay IP ni cuenta. */
export const ANONYMOUS_VISIBLE_CAP_PER_HOUR = 600;
/**
 * Horas de servidas anónimas que respaldan las visibles sin IP ni cuenta (lo servido sin
 * personalización tiene la hora truncada: una más de margen). También es la ventana del contador.
 */
const ANONYMOUS_POOL_HOURS = SERVED_LOOKBACK_HOURS + 1;
/** Una por persona, publicación y día: la llave lleva el día; la ventana lo cubre con holgura. */
const DEDUPE_WINDOW_SECONDS = 25 * HOUR_SECONDS;
const FEED_SURFACES: Surface[] = ["FEED", "COMMUNITY"];
/** Filas servidas que se leen por petición (≤ 24 por publicación y día, deduplicadas por hora). */
const MAX_SERVED_ROWS = 2_000;

type Served = {
  surface: Surface | null;
  position: number | null;
  score: number | null;
  algorithmVersion: string | null;
  slot: string | null;
};

type RecordInput = {
  viewerId: string | null;
  /** IP del cliente según `TRUSTED_PROXY_HOPS` (`null` sin proxies de confianza). */
  ip: string | null;
  items: readonly VisibleImpressionReport[];
  now?: Date;
};

/**
 * Registra las impresiones visibles que cuentan. Nunca lanza errores al llamador (como `track`): si
 * la base falla, lo deja en el log y responde cuántas no se pudieron guardar (`failed`). Se cuenta
 * de menos, nunca de más.
 */
export async function recordVisibleImpressions(
  input: RecordInput,
): Promise<VisibleImpressionOutcome> {
  const reports = uniqueByPost(input.items);
  const outcome: VisibleImpressionOutcome = { recorded: 0, duplicates: 0, rejected: 0, failed: 0 };
  if (reports.length === 0) return outcome;
  try {
    await record(input, reports, outcome);
  } catch (error) {
    console.error("[analytics] no se pudieron guardar impresiones visibles", error);
    outcome.recorded = 0;
    outcome.failed = reports.length - outcome.duplicates - outcome.rejected;
  }
  return outcome;
}

async function record(
  input: RecordInput,
  reports: VisibleImpressionReport[],
  outcome: VisibleImpressionOutcome,
) {
  const now = input.now ?? new Date();
  // Publicadas y que no son de quien las ve (las vistas del dueño no cuentan).
  const posts = await db.post.findMany({
    where: { id: { in: reports.map((report) => report.postId) }, status: "PUBLISHED" },
    select: { id: true, authorId: true },
  });
  const eligible = new Set(
    posts.filter((post) => post.authorId !== input.viewerId).map((post) => post.id),
  );
  const candidates = reports.filter((report) => eligible.has(report.postId));
  outcome.rejected = reports.length - candidates.length;
  if (candidates.length === 0) return;

  const ids = candidates.map((report) => report.postId);
  const linked = input.viewerId ? await isPersonalizationEnabled(input.viewerId) : false;
  const actor = eventActor(input.viewerId, input.ip ? ipNetwork(input.ip) : null);
  const day = mexicoDay(now);

  let accept: (report: VisibleImpressionReport) => Served | null;
  /** Reserva final (solo sin IP ni cuenta): atómica, para que dos peticiones no usen la misma servida. */
  let claim: (postId: string) => Promise<boolean> = async () => true;
  if (linked && input.viewerId) {
    const served = await servedToPerson(
      input.viewerId,
      ids,
      new Date(now.getTime() - SERVED_LOOKBACK_HOURS * HOUR_MS),
    );
    accept = (report) => {
      const rows = served.get(report.postId);
      if (!rows) return null;
      const same = rows.find((row) => row.surface === report.surface);
      // En otra superficie (la servida de la comunidad se deduplicó con la del feed): la posición
      // es la que reporta el navegador y no hay puntuación de esa página.
      return same ?? { ...rows[0]!, position: report.position, score: null };
    };
  } else {
    const pool = await anonymousPool(ids, new Date(now.getTime() - ANONYMOUS_POOL_HOURS * HOUR_MS));
    const receipts = actor ? await liveReceipts(actor, ids, now) : null;
    if (!receipts) {
      claim = (postId) => claimAnonymousSlot(postId, pool.get(postId)?.served ?? 0);
    }
    accept = (report) => {
      const row = pool.get(report.postId);
      if (!row || row.served === 0) return null;
      if (receipts && !receipts.has(report.postId)) return null;
      // Sin comprobante por persona: nunca más visibles que servidas (y `claim` lo hace atómico).
      if (!receipts && row.visible >= row.served) return null;
      return {
        surface: report.surface,
        position: report.position,
        score: null,
        algorithmVersion: row.algorithmVersion,
        slot: row.slot,
      };
    };
  }

  const experiments =
    linked && input.viewerId ? await getFeedExperimentAssignments(input.viewerId) : [];
  const variants =
    experiments.length > 0
      ? Object.fromEntries(experiments.map((experiment) => [experiment.key, experiment.variant]))
      : null;

  const events: TrackedEvent[] = [];
  // En serie: pocas piezas por petición (el navegador junta lo visto cada 5 s).
  for (const report of candidates) {
    const served = accept(report);
    if (!served) {
      outcome.rejected++;
      continue;
    }
    if (!(await isFirstToday(actor, report.postId, day))) {
      outcome.duplicates++;
      continue;
    }
    if (!(await claim(report.postId))) {
      outcome.rejected++;
      continue;
    }
    const metadata = {
      ...(served.slot ? { slot: served.slot } : {}),
      // Sin personalización `prepareEvent` la quita: la variante sale del id de la persona.
      ...(variants ? { experiments: variants } : {}),
    };
    events.push({
      type: "VISIBLE_IMPRESSION",
      userId: input.viewerId,
      entityType: "POST",
      entityId: report.postId,
      sourcePostId: report.postId,
      surface: report.surface,
      position: served.position ?? report.position,
      score: served.score ?? undefined,
      algorithmVersion: served.algorithmVersion ?? undefined,
      metadata: Object.keys(metadata).length > 0 ? metadata : undefined,
    });
  }
  if (events.length > 0) {
    // Sin sesión, igual que `track`: sin persona a quien ligar y sin truncar la hora.
    const enabled = input.viewerId ? linked : true;
    await db.analyticsEvent.createMany({
      data: events.map((event) => prepareEvent(event, enabled, now)),
    });
    outcome.recorded = events.length;
  }
}

/** Una por publicación (la primera) y con el id en minúsculas, como lo guarda la base. */
function uniqueByPost(items: readonly VisibleImpressionReport[]) {
  const seen = new Set<string>();
  return items.flatMap((item) => {
    const postId = item.postId.toLowerCase();
    if (seen.has(postId)) return [];
    seen.add(postId);
    return [{ ...item, postId }];
  });
}

/** Impresiones servidas a la persona (con personalización), las más recientes primero. */
async function servedToPerson(
  userId: string,
  postIds: string[],
  since: Date,
): Promise<Map<string, Served[]>> {
  const rows = await db.analyticsEvent.findMany({
    where: {
      userId,
      type: "IMPRESSION",
      entityType: "POST",
      entityId: { in: postIds },
      surface: { in: FEED_SURFACES },
      createdAt: { gte: since },
    },
    orderBy: { createdAt: "desc" },
    take: MAX_SERVED_ROWS,
    select: {
      entityId: true,
      surface: true,
      position: true,
      score: true,
      algorithmVersion: true,
      metadata: true,
    },
  });
  const byPost = new Map<string, Served[]>();
  for (const row of rows) {
    if (!row.entityId) continue;
    const list = byPost.get(row.entityId) ?? [];
    list.push({
      surface: row.surface,
      position: row.position,
      score: row.score,
      algorithmVersion: row.algorithmVersion,
      slot: slotOf(row.metadata),
    });
    byPost.set(row.entityId, list);
  }
  return byPost;
}

type PoolRow = {
  postId: string;
  served: number;
  visible: number;
  algorithmVersion: string | null;
  slot: string | null;
};

/**
 * Servidas y visibles ANÓNIMAS de cada publicación desde `since` (sin sesión o sin personalización),
 * con la versión y el espacio de la servida más reciente.
 */
async function anonymousPool(postIds: string[], since: Date): Promise<Map<string, PoolRow>> {
  const surfaces: string[] = FEED_SURFACES;
  const rows = await db.$queryRaw<PoolRow[]>`
    SELECT e."entityId"::text AS "postId",
      count(*) FILTER (WHERE e."type" = 'IMPRESSION')::int AS "served",
      count(*) FILTER (WHERE e."type" = 'VISIBLE_IMPRESSION')::int AS "visible",
      (array_agg(e."algorithmVersion" ORDER BY e."createdAt" DESC)
        FILTER (WHERE e."type" = 'IMPRESSION'))[1] AS "algorithmVersion",
      (array_agg(e."metadata"->>'slot' ORDER BY e."createdAt" DESC)
        FILTER (WHERE e."type" = 'IMPRESSION'))[1] AS "slot"
    FROM "analytics_events" e
    WHERE e."entityType" = 'POST' AND e."entityId" = ANY(${postIds}::uuid[])
      AND e."userId" IS NULL
      AND e."type" IN ('IMPRESSION', 'VISIBLE_IMPRESSION')
      AND e."surface"::text = ANY(${surfaces}::text[])
      AND e."createdAt" >= ${since}
    GROUP BY e."entityId"`;
  return new Map(rows.map((row) => [row.postId, row]));
}

/** Publicaciones cuya cubeta de impresión servida para `actor` sigue vigente (servidas hace < 1 h). */
async function liveReceipts(actor: string, postIds: string[], now: Date): Promise<Set<string>> {
  const keys = new Map(postIds.map((postId) => [servedImpressionKey(actor, postId), postId]));
  const rows = await db.rateLimitBucket.findMany({
    where: { key: { in: [...keys.keys()] }, expiresAt: { gt: now } },
    select: { key: true },
  });
  return new Set(rows.flatMap((row) => keys.get(row.key) ?? []));
}

/**
 * Sin IP ni cuenta: reserva una de las `served` servidas anónimas de la publicación en un contador
 * atómico (`rateLimit`: un solo `INSERT … ON CONFLICT … RETURNING`) de 25 h. El conteo que se leyó
 * antes (`anonymousPool`) no basta: varias peticiones simultáneas lo leerían igual y registrarían
 * tantas visibles como peticiones. Con el contador, las visibles de cada ventana del contador no
 * pasan de las servidas; como esa ventana es fija y la de las servidas se desliza, el peor caso
 * (ráfagas simultáneas justo al renovarse el contador) es el doble de las servidas en 25 h, nunca
 * sin límite. Cada intento suma aunque se rechace: bajo ataque se cuenta de menos.
 */
async function claimAnonymousSlot(postId: string, served: number) {
  if (served < 1) return false;
  const key = `evt.visible_impression:anon-served:${digest(["POST", postId])}`;
  const windowSeconds = ANONYMOUS_POOL_HOURS * HOUR_SECONDS;
  return (await rateLimit({ key, limit: served, windowSeconds })).ok;
}

/** Una por persona (o IP), publicación y día de México; sin ninguna, un tope por publicación y hora. */
async function isFirstToday(actor: string | null, postId: string, day: Day) {
  if (!actor) {
    const key = `evt.visible_impression:anon:${digest(["POST", postId])}`;
    return (
      await rateLimit({ key, limit: ANONYMOUS_VISIBLE_CAP_PER_HOUR, windowSeconds: HOUR_SECONDS })
    ).ok;
  }
  const key = `evt.visible_impression:${digest([actor, "POST", postId, day])}`;
  return (await rateLimit({ key, limit: 1, windowSeconds: DEDUPE_WINDOW_SECONDS })).ok;
}

function slotOf(metadata: unknown): string | null {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return null;
  const slot = (metadata as Record<string, unknown>).slot;
  return typeof slot === "string" ? slot : null;
}
