import type { AnalyticsEventType, EntityType, Surface } from "@/generated/prisma/enums";
import type { Prisma } from "@/generated/prisma/client";

export type TrackedEvent = {
  type: AnalyticsEventType;
  userId?: string | null;
  anonymousId?: string | null;
  entityType?: EntityType;
  entityId?: string;
  sourcePostId?: string | null;
  surface?: Surface;
  position?: number;
  score?: number;
  algorithmVersion?: string;
  query?: string;
  metadata?: Prisma.InputJsonValue;
};

/**
 * Metadata que sobrevive en un evento anónimo (SEC-16): conteos y categorías cortas. Cualquier otra
 * llave se descarta, en especial los ids (`checkoutId`, `orderId`, `responseId`…), que se unen con
 * tablas que sí guardan a la persona. Agregar una llave aquí es decidir que no identifica a nadie.
 * La razón del ranking (`reason`) tampoco: «follow» o «intent» salen de a quién sigue la persona y de
 * lo que busca, y las impresiones de una misma página juntas (`follows` de por medio) la delatan.
 */
export const ANONYMOUS_METADATA_KEYS = [
  "quantity",
  "channel",
  "scope",
  "communities",
  "products",
  "posts",
  "slot",
] as const;

/**
 * Eventos en los que la persona actúa sobre algo SUYO: la entidad (su propio producto) la identifica,
 * así que en un evento anónimo se descarta.
 */
export const SELF_ENTITY_EVENT_TYPES = [
  "AI_PROPOSAL_GENERATED",
  "AI_PROPOSAL_ACCEPTED",
] as const satisfies readonly AnalyticsEventType[];

/** Un valor de categoría («copy», «commerce», «explore»): letras y guiones, sin dígitos ni ids. */
export const ANONYMOUS_CATEGORY_PATTERN = /^[a-z][a-z-]{0,31}$/;

const HOUR = 60 * 60 * 1000;

/**
 * Prepara un evento para guardarlo respetando la privacidad:
 * - Sin personalización, el evento se anonimiza de verdad (SEC-16): sin persona, sin búsqueda en
 *   texto, sin ids en la metadata, sin la entidad cuando es suya y con la hora truncada (una marca al
 *   milisegundo se une con `checkouts.createdAt` o con los UUIDv7). El id también es aleatorio
 *   (UUIDv4): el UUIDv7 por omisión lleva la hora al milisegundo y desharía el truncado. Sirve para
 *   métricas agregadas del vendedor, pero no se vincula a la persona.
 * - Las búsquedas se recortan para no guardar textos largos que podrían contener datos personales.
 */
export function prepareEvent(
  event: TrackedEvent,
  personalizationEnabled: boolean,
  now: Date = new Date(),
): Prisma.AnalyticsEventCreateInput {
  if (personalizationEnabled) {
    return {
      type: event.type,
      userId: event.userId ?? null,
      anonymousId: event.anonymousId ?? null,
      entityType: event.entityType,
      entityId: event.entityId,
      sourcePostId: event.sourcePostId ?? null,
      surface: event.surface,
      position: event.position,
      score: event.score,
      algorithmVersion: event.algorithmVersion,
      query: event.query?.trim().slice(0, 120) || undefined,
      metadata: event.metadata,
    };
  }
  const ownEntity = (SELF_ENTITY_EVENT_TYPES as readonly AnalyticsEventType[]).includes(event.type);
  return {
    id: crypto.randomUUID(),
    type: event.type,
    userId: null,
    anonymousId: null,
    entityType: ownEntity ? undefined : event.entityType,
    entityId: ownEntity ? undefined : event.entityId,
    sourcePostId: event.sourcePostId ?? null,
    surface: event.surface,
    position: event.position,
    score: event.score,
    algorithmVersion: event.algorithmVersion,
    metadata: anonymousMetadata(event.metadata),
    createdAt: truncateToHour(now),
  };
}

/** Solo las llaves permitidas, con números, booleanos o categorías cortas. */
export function anonymousMetadata(
  metadata: Prisma.InputJsonValue | undefined,
): Prisma.InputJsonObject | undefined {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return undefined;
  const source = metadata as Record<string, unknown>;
  const kept: Record<string, number | boolean | string> = {};
  for (const key of ANONYMOUS_METADATA_KEYS) {
    const value = source[key];
    if (typeof value === "boolean" || (typeof value === "number" && Number.isFinite(value))) {
      kept[key] = value;
    } else if (typeof value === "string" && ANONYMOUS_CATEGORY_PATTERN.test(value)) {
      kept[key] = value;
    }
  }
  return Object.keys(kept).length > 0 ? kept : undefined;
}

export function truncateToHour(date: Date): Date {
  return new Date(Math.floor(date.getTime() / HOUR) * HOUR);
}
