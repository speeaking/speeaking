import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { LEGAL_VERSIONS } from "@/modules/identity/constants";
import { db } from "@/server/db";
import {
  ANONYMOUS_CATEGORY_PATTERN,
  ANONYMOUS_METADATA_KEYS,
  SELF_ENTITY_EVENT_TYPES,
} from "./event";

type Client = Prisma.TransactionClient | typeof db;

/**
 * Desliga de la persona TODA su actividad ya guardada (SEC-27), con el mismo estándar que un evento
 * anónimo nuevo (`prepareEvent`, SEC-16): sin persona, sin texto de búsqueda, solo la metadata
 * permitida, sin la entidad cuando es suya, con la hora truncada y con un id nuevo aleatorio (el
 * UUIDv7 original lleva la hora al milisegundo). Los eventos siguen contando para las métricas
 * agregadas del vendedor, pero ya no alimentan la personalización. Devuelve cuántos eventos desligó.
 */
export function anonymizeUserActivity(userId: string, client: Client = db): Promise<number> {
  const keys: string[] = [...ANONYMOUS_METADATA_KEYS];
  const ownEntityTypes: string[] = [...SELF_ENTITY_EVENT_TYPES];
  return client.$executeRaw`
    UPDATE "analytics_events" AS e SET
      "id" = gen_random_uuid(),
      "userId" = NULL,
      "anonymousId" = NULL,
      "query" = NULL,
      "entityType" = CASE WHEN e."type"::text = ANY(${ownEntityTypes}::text[]) THEN NULL ELSE e."entityType" END,
      "entityId" = CASE WHEN e."type"::text = ANY(${ownEntityTypes}::text[]) THEN NULL ELSE e."entityId" END,
      "metadata" = (
        SELECT jsonb_object_agg(m.key, m.value)
        FROM jsonb_each(CASE WHEN jsonb_typeof(e."metadata") = 'object' THEN e."metadata" ELSE '{}'::jsonb END) AS m
        WHERE m.key = ANY(${keys}::text[])
          AND (
            jsonb_typeof(m.value) IN ('number', 'boolean')
            OR (jsonb_typeof(m.value) = 'string' AND (m.value #>> '{}') ~ ${ANONYMOUS_CATEGORY_PATTERN.source})
          )
      ),
      "createdAt" = date_trunc('hour', e."createdAt")
    WHERE e."userId" = ${userId}::uuid`;
}

/**
 * Activa o desactiva la personalización. Al desactivarla, la actividad previa se desliga en la misma
 * transacción (no solo la futura). El cambio queda en el historial de consentimientos.
 */
export async function setPersonalization(userId: string, enabled: boolean) {
  await db.$transaction(async (tx) => {
    await tx.profile.update({ where: { userId }, data: { personalizationEnabled: enabled } });
    await tx.userConsent.create({
      data: {
        userId,
        type: "PERSONALIZATION",
        version: LEGAL_VERSIONS.personalization,
        granted: enabled,
      },
    });
    if (!enabled) await anonymizeUserActivity(userId, tx);
  });
}

export type SearchHistoryItemDTO = { query: string; searchedAt: string };

/** Cuántas búsquedas distintas se muestran en Ajustes. */
export const SEARCH_HISTORY_LIMIT = 20;

/**
 * Búsquedas propias todavía ligadas a la persona (las que alimentan «Porque buscaste…»), de la más
 * reciente a la más antigua y sin repetir. Solo la persona dueña las ve (Ajustes).
 */
export async function listSearchHistory(userId: string): Promise<SearchHistoryItemDTO[]> {
  const rows = await db.analyticsEvent.findMany({
    where: { userId, type: "SEARCH", query: { not: null } },
    orderBy: { createdAt: "desc" },
    take: SEARCH_HISTORY_LIMIT * 5,
    select: { query: true, createdAt: true },
  });
  const seen = new Set<string>();
  const items: SearchHistoryItemDTO[] = [];
  for (const row of rows) {
    const query = row.query?.trim();
    const key = query?.toLocaleLowerCase("es-MX");
    if (!query || !key || seen.has(key)) continue;
    seen.add(key);
    items.push({ query, searchedAt: row.createdAt.toISOString() });
    if (items.length === SEARCH_HISTORY_LIMIT) break;
  }
  return items;
}

/** Borra el historial de búsqueda de la persona (derecho de cancelación). Devuelve cuántas borró. */
export async function clearSearchHistory(userId: string): Promise<number> {
  const { count } = await db.analyticsEvent.deleteMany({ where: { userId, type: "SEARCH" } });
  return count;
}
