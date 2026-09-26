import "server-only";
import { cache } from "react";
import { CANDIDATE_WINDOW_DAYS } from "@/modules/feed/queries";
import { Prisma } from "@/generated/prisma/client";
import { db } from "@/server/db";

/**
 * «N nuevas» por comunidad (F7): publicaciones que la persona todavía no ha visto en sus
 * comunidades. Se muestran en las burbujas del inicio y en «Tus comunidades» de la columna
 * izquierda; en 0 no se pinta nada (P5: nada inflado).
 */

/** A partir de aquí el número exacto deja de importar: se muestra «99+». */
export const UNREAD_CAP = 99;

/** communityId → publicaciones nuevas (solo comunidades con al menos una). */
export type UnreadCounts = Record<string, number>;

/**
 * Ventana del feed de una comunidad: la misma `CANDIDATE_WINDOW_DAYS` de `src/modules/feed/queries.ts`.
 * Lo más viejo ya no aparece al abrir la comunidad, así que tampoco cuenta como nuevo.
 */
export const UNREAD_WINDOW_DAYS = CANDIDATE_WINDOW_DAYS;
const DAY = 24 * 60 * 60 * 1000;

/**
 * Una sola consulta para todas las comunidades de la persona. Cuenta lo que el feed de la
 * comunidad le mostraría y todavía no vio:
 * - publicaciones PUBLICADAS, ya publicadas en `now` y dentro de la ventana del feed (45 días):
 *   «2 nuevas» que al abrir la comunidad no aparecen sería un número inventado (P5);
 * - después de su última visita o, si nunca la abrió, de cuando se unió;
 * - de otras personas (lo suyo no es «nuevo» para ella);
 * - sin productos agotados o pausados (el feed los omite; contarlos prometería algo que no está).
 *
 * El conteo de cada comunidad para en `UNREAD_CAP + 1` (`LIMIT` en el `LATERAL`): así la
 * consulta tiene costo acotado aunque haya miles de publicaciones, y 100 se lee como «99+».
 * Todo dato variable viaja como parámetro ($n), nunca dentro del texto SQL. Las fechas van como
 * `Date` (no como texto ISO): el adaptador de Postgres las manda igual que cuando Prisma escribe
 * `publishedAt` o `createdAt`, así que se comparan en la misma escala.
 */
export function unreadCountsSql(viewerId: string, now: Date) {
  const windowStart = new Date(now.getTime() - UNREAD_WINDOW_DAYS * DAY);
  return Prisma.sql`
    SELECT m."communityId" AS "communityId", fresh."count" AS "count"
    FROM "community_memberships" m
    CROSS JOIN LATERAL (
      SELECT COUNT(*)::int AS "count"
      FROM (
        SELECT 1
        FROM "posts" p
        WHERE p."communityId" = m."communityId"
          AND p."status" = 'PUBLISHED'
          AND p."publishedAt" > COALESCE(m."lastSeenAt", m."createdAt")
          AND p."publishedAt" >= ${windowStart}::timestamptz
          AND p."publishedAt" <= ${now}::timestamptz
          AND p."authorId" <> m."userId"
          AND (
            p."productId" IS NULL
            OR EXISTS (
              SELECT 1 FROM "products" pr
              WHERE pr."id" = p."productId" AND pr."status" = 'ACTIVE' AND pr."stock" > 0
            )
          )
        LIMIT ${UNREAD_CAP + 1}
      ) capped
    ) fresh
    WHERE m."userId" = ${viewerId}::uuid AND fresh."count" > 0`;
}

type UnreadRow = { communityId: string; count: number | bigint };

/** Filas de la consulta → mapa limpio: sin ceros y nunca más allá del tope («99+»). */
export function toUnreadCounts(rows: readonly UnreadRow[]): UnreadCounts {
  const counts: UnreadCounts = {};
  for (const row of rows) {
    const count = Math.min(Number(row.count), UNREAD_CAP + 1);
    if (count > 0) counts[row.communityId] = count;
  }
  return counts;
}

/** Conteo sin caché (con `now` explícito para las pruebas). */
export async function countUnread(viewerId: string, now: Date): Promise<UnreadCounts> {
  const rows = await db.$queryRaw<UnreadRow[]>(unreadCountsSql(viewerId, now));
  return toUnreadCounts(rows);
}

/**
 * Publicaciones nuevas por comunidad de quien navega. Una vez por request (`cache`): la columna
 * izquierda (layout) y las burbujas del inicio (página) comparten la misma consulta.
 */
export const getUnreadCounts = cache((viewerId: string): Promise<UnreadCounts> =>
  countUnread(viewerId, new Date()),
);

/**
 * La persona abrió la comunidad: lo publicado hasta `at` deja de ser nuevo. Solo toca SU
 * membresía (`userId` sale de la sesión, nunca del cliente); si no es miembro no cambia nada.
 * `at` es el momento en que se empezó a pintar la página: lo que llegue mientras tanto sigue
 * siendo nuevo. La fecha solo avanza, así que una pestaña vieja no revive publicaciones vistas.
 *
 * Una sola sentencia en SQL parametrizado, como el conteo (misma codificación de fechas). Además
 * funciona aunque el cliente de Prisma que el servidor de desarrollo guarda entre recargas
 * (`src/server/db.ts`) todavía no conozca la columna nueva.
 */
export async function markCommunitySeen(
  viewerId: string,
  communityId: string,
  at: Date = new Date(),
): Promise<void> {
  await db.$executeRaw`
    UPDATE "community_memberships"
    SET "lastSeenAt" = ${at}::timestamptz
    WHERE "userId" = ${viewerId}::uuid
      AND "communityId" = ${communityId}::uuid
      AND ("lastSeenAt" IS NULL OR "lastSeenAt" < ${at}::timestamptz)`;
}
