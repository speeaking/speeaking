import "server-only";
import { createHmac } from "node:crypto";
import type { AnalyticsEventType } from "@/generated/prisma/enums";
import { ipNetwork } from "@/server/client-ip";
import { db } from "@/server/db";
import { env } from "@/server/env";
import { rateLimit } from "@/server/rate-limit";
import type { TrackedEvent } from "./event";

/**
 * Integridad de las métricas del vendedor y del feed (SEC-20). Antes de guardar, `track` pasa los
 * eventos por aquí:
 *
 * 1. **Referencias verificadas.** Un SHARE solo cuenta si la publicación está publicada o el producto
 *    tiene página pública; `sourcePostId` en un evento de producto solo se conserva si esa publicación
 *    existe, está publicada y es de ESE producto (si no, el evento queda sin atribución); un
 *    AI_PROPOSAL_ACCEPTED solo si la propuesta (`metadata.responseId`) es de quien la acepta.
 * 2. **Uno por persona, entidad y ventana.** Impresiones, vistas y compartidos repetidos no suman: la
 *    persona es la cuenta o, sin sesión, la IP (IPv6 por /64). La llave es un HMAC (con el secreto
 *    del servidor) de persona + entidad, así `rate_limit_buckets` no guarda quién vio qué.
 * 3. **Sin persona ni IP** (`TRUSTED_PROXY_HOPS=0`) no se puede deduplicar: vistas e impresiones
 *    anónimas tienen un tope por entidad y hora, y los compartidos anónimos se descartan (no inflan
 *    «Compartidos»).
 */

const HOUR = 60 * 60;
const DAY = 24 * HOUR;
const WEEK = 7 * DAY;

/** Ventana en la que se cuenta un solo evento por persona y entidad (y canal, en SHARE). */
export const DEDUPE_WINDOW_SECONDS: Partial<Record<AnalyticsEventType, number>> = {
  IMPRESSION: HOUR,
  VIEW: HOUR,
  PRODUCT_VIEW: HOUR,
  SHARE: DAY,
  // Una propuesta de IA aceptada una vez (aunque se publique como dos productos).
  AI_PROPOSAL_ACCEPTED: WEEK,
};

/** Tope por entidad y hora de los eventos anónimos que no se pueden deduplicar (sin IP). */
export const ANONYMOUS_CAP_PER_HOUR: Partial<Record<AnalyticsEventType, number>> = {
  IMPRESSION: 600,
  VIEW: 120,
  PRODUCT_VIEW: 120,
};

/** Productos con página pública (igual que guardar, `social/actions.ts`). */
const PUBLIC_PRODUCT_STATUSES = ["ACTIVE", "PAUSED", "SOLD_OUT"] as const;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type TrackContext = { ip: string | null };

/** ¿Hace falta la IP para deduplicar? Solo con eventos deduplicables sin persona. */
export function needsClientIp(events: readonly TrackedEvent[]): boolean {
  return events.some((event) => !event.userId && DEDUPE_WINDOW_SECONDS[event.type] !== undefined);
}

/** Los eventos que sí se guardan, ya con la atribución verificada. */
export async function filterTrustedEvents(
  events: readonly TrackedEvent[],
  { ip }: TrackContext,
): Promise<TrackedEvent[]> {
  const verified = await verifyReferences(events);
  const actorFromIp = ip ? ipNetwork(ip) : null;
  const kept: TrackedEvent[] = [];
  // En serie: pocos eventos por llamada (≤ 10 impresiones por página) y corre en `after`.
  for (const event of verified) {
    if (await isFirstInWindow(event, actorFromIp)) kept.push(event);
  }
  return kept;
}

async function verifyReferences(events: readonly TrackedEvent[]): Promise<TrackedEvent[]> {
  const postIds = new Set<string>();
  const productIds = new Set<string>();
  const responseIds = new Set<string>();
  // Solo UUID: un id mal formado haría fallar la consulta (y con ella todo el lote).
  const add = (ids: Set<string>, id: string | null | undefined) => {
    if (id && UUID.test(id)) ids.add(id.toLowerCase());
  };
  for (const event of events) {
    if (event.type === "SHARE") {
      add(event.entityType === "PRODUCT" ? productIds : postIds, event.entityId);
    }
    if (event.entityType === "PRODUCT") add(postIds, event.sourcePostId);
    const responseId = acceptedResponseId(event);
    if (responseId) responseIds.add(responseId);
  }

  const [posts, products, responses] = await Promise.all([
    postIds.size > 0
      ? db.post.findMany({
          where: { id: { in: [...postIds] }, status: "PUBLISHED" },
          select: { id: true, productId: true },
        })
      : [],
    productIds.size > 0
      ? db.product.findMany({
          where: { id: { in: [...productIds] }, status: { in: [...PUBLIC_PRODUCT_STATUSES] } },
          select: { id: true },
        })
      : [],
    responseIds.size > 0
      ? db.aIResponse.findMany({
          where: { id: { in: [...responseIds] } },
          select: { id: true, request: { select: { userId: true } } },
        })
      : [],
  ]);
  const publishedPosts = new Map(posts.map((post) => [post.id, post.productId]));
  const publicProducts = new Set(products.map((product) => product.id));
  const responseOwners = new Map(
    responses.map((response) => [response.id, response.request.userId]),
  );

  return events.flatMap((event) => {
    if (event.type === "SHARE") {
      const entityId = event.entityId?.toLowerCase() ?? "";
      const visible =
        event.entityType === "PRODUCT"
          ? publicProducts.has(entityId)
          : publishedPosts.has(entityId);
      if (!visible) return [];
    }
    if (event.type === "AI_PROPOSAL_ACCEPTED") {
      const responseId = acceptedResponseId(event);
      if (!responseId || !event.userId || responseOwners.get(responseId) !== event.userId) {
        return [];
      }
    }
    if (event.entityType === "PRODUCT" && event.sourcePostId) {
      const productOfPost = publishedPosts.get(event.sourcePostId.toLowerCase());
      if (!productOfPost || productOfPost !== event.entityId?.toLowerCase()) {
        return [{ ...event, sourcePostId: null }];
      }
    }
    return [event];
  });
}

async function isFirstInWindow(event: TrackedEvent, actorFromIp: string | null) {
  const windowSeconds = DEDUPE_WINDOW_SECONDS[event.type];
  const target = event.type === "AI_PROPOSAL_ACCEPTED" ? acceptedResponseId(event) : event.entityId;
  if (windowSeconds === undefined || !target) return true;
  const scope = `evt.${event.type.toLowerCase()}`;

  const actor = event.userId ? `user:${event.userId}` : actorFromIp ? `ip:${actorFromIp}` : null;
  if (!actor) {
    const cap = ANONYMOUS_CAP_PER_HOUR[event.type];
    if (cap === undefined) return false;
    const key = `${scope}:anon:${digest([event.entityType ?? "", target])}`;
    return (await rateLimit({ key, limit: cap, windowSeconds: HOUR })).ok;
  }
  const key = `${scope}:${digest([actor, event.entityType ?? "", target, channelOf(event)])}`;
  return (await rateLimit({ key, limit: 1, windowSeconds })).ok;
}

/** HMAC corto (128 bits) con el secreto del servidor: sin él no se sabe qué persona ni qué entidad. */
function digest(parts: string[]) {
  return createHmac("sha256", env.BETTER_AUTH_SECRET)
    .update(`vendeia:event-dedupe:v1|${parts.join("|").toLowerCase()}`)
    .digest("hex")
    .slice(0, 32);
}

function channelOf(event: TrackedEvent) {
  const metadata = event.metadata;
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return "";
  const channel = (metadata as Record<string, unknown>).channel;
  return typeof channel === "string" ? channel : "";
}

function acceptedResponseId(event: TrackedEvent): string | null {
  if (event.type !== "AI_PROPOSAL_ACCEPTED") return null;
  const metadata = event.metadata;
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return null;
  const responseId = (metadata as Record<string, unknown>).responseId;
  return typeof responseId === "string" && UUID.test(responseId) ? responseId.toLowerCase() : null;
}
