import { findUserRole } from "@/modules/admin/queries";
import { getSession } from "@/modules/identity/session";
import {
  type DeliveredFile,
  entityTag,
  matchesEntityTag,
  parseDeliveryQuery,
  readVariant,
} from "@/modules/media/delivery";
import { isProofMedia } from "@/modules/trust/proof-media";
import { isTryOnMedia } from "@/modules/tryon/media";
import { POST_WITH_VISIBLE_PRODUCT, VISIBLE_PRODUCT } from "@/modules/trust/visibility";
import { db } from "@/server/db";
import { getStorage } from "@/server/providers/storage";
import { assertSafeKey, InvalidStorageKeyError } from "@/server/providers/storage/types";

/**
 * Caché de una foto pública: una hora; después, la copia vieja todavía puede salir mientras se
 * revalida en segundo plano (un navegador, una vez; una CDN, según cómo trate el 404: ADR-039,
 * «Ventana de retiro»). Nunca `immutable`: la clave no cambia de contenido, pero la foto sí puede
 * dejar de servirse (producto oculto, publicación retirada, cuenta borrada) y ese retiro tiene que
 * llegar a navegadores y CDN (SEC-14). La revalidación recibe 404 sin caché.
 */
const PUBLIC_CACHE = "public, max-age=3600, stale-while-revalidate=86400";
const PRIVATE_CACHE = "private, no-store";
/** Pública pero entregada degradada (el original en vez de la variante): que nadie la guarde. */
const DEGRADED_CACHE = "no-store";

/**
 * Sirve las fotos del almacenamiento: el original (`/media/<clave>`) o una variante reducida
 * (`/media/<clave>?w=N`, la que pide `next/image` por `src/lib/image-loader.ts`; ADR-039). El
 * optimizador de Next (`/_next/image`) ya no se usa: guardaba copias propias que seguía sirviendo
 * después de ocultar o borrar la foto.
 *
 * Quién la ve se decide en CADA petición, antes de tocar el archivo o la caché de variantes (SEC-14,
 * P14). Solo se sirve lo que tiene fila en `media` y está lista:
 * - Adjunta a una publicación PUBLICADA (sin producto o con su producto visible) o a un producto
 *   VISIBLE → pública, con caché de una hora (`PUBLIC_CACHE`). Los productos visibles cuentan en
 *   cualquier estado: el Studio muestra los pausados o archivados.
 * - Adjunta solo a productos ocultos por moderación (o a sus publicaciones) → solo para su dueño y
 *   sin caché; 404 para los demás. El equipo (ADMIN) también ve las del producto oculto (para
 *   revisarlo), no las que están únicamente en su publicación.
 * - Foto de un comprobante de autenticidad, vigente o de un envío anterior
 *   (`authenticity_checks."proofMediaIds"` o `authenticity_proof_history`, `trust/proof-media.ts`) →
 *   NUNCA pública, aunque estuviera adjunta a algo público (datos anteriores al trigger que hoy lo
 *   impide): solo su dueño la ve aquí, sin caché; el equipo la ve por
 *   `/admin/moderacion/prueba/[mediaId]`.
 * - Sin adjuntar (recién subida, o quitada de un producto) o solo en publicaciones ocultas o
 *   retiradas por moderación → solo para su dueño y sin caché: no sirve de hosting gratuito, no se
 *   puede enlazar desde otro sitio y retirar una publicación deja de servir sus fotos (lo ya guardado
 *   en un navegador o CDN, dentro de la ventana de `PUBLIC_CACHE`). `scripts/cleanup-orphan-media.ts`
 *   borra las no adjuntas a las 24 h (salvo los comprobantes), con sus variantes.
 * - Sin fila (p. ej. de una cuenta borrada) → 404 aunque el archivo siga en disco.
 *
 * Las fotos se piden desde el mismo origen con las cookies de la sesión: su dueño y el equipo ven
 * las fotos privadas en el Studio y en la página del producto oculto.
 */
export async function GET(request: Request, context: RouteContext<"/media/[...key]">) {
  const key = (await context.params).key.join("/");

  let contentType: string;
  try {
    contentType = assertSafeKey(key);
  } catch (error) {
    if (error instanceof InvalidStorageKeyError) return badRequest();
    throw error;
  }
  // Solo `?w=<ancho permitido>` en fotos, antes de consultar la base.
  const query = parseDeliveryQuery(new URL(request.url).searchParams);
  if (!query.ok || (query.width && !contentType.startsWith("image/"))) return badRequest();

  const media = await db.media.findUnique({
    where: { storageKey: key },
    select: { id: true, ownerId: true, status: true, width: true },
  });
  if (!media || media.status !== "READY") return notFound();

  const publiclyAttached = await isPubliclyAttached(media.id);
  // Un comprobante (vigente o anterior) y una foto de Pruébatelo (ADR-045) nunca son públicos. Solo
  // se consulta cuando cambia la respuesta (lo que no está adjunto a nada visible ya es privado).
  // Consultas con índice (GIN y `mediaId`).
  const isProof = () => isProofMedia(db, media.id);
  const isTryOn = () => isTryOnMedia(db, media.id);

  const isPublic = publiclyAttached && !(await isProof()) && !(await isTryOn());
  if (!isPublic && !(await canSeePrivate(media, publiclyAttached, isProof, isTryOn))) {
    return notFound();
  }

  // Autorizada: recién ahora se lee el archivo o su variante.
  const storage = getStorage();
  let file: DeliveredFile | null;
  if (query.width && query.width < media.width) {
    file = await readVariant(storage, key, query.width);
  } else {
    // Sin ancho, o la foto ya es igual o más angosta que lo pedido: el original tal cual.
    const original = await storage.get(key);
    file = original && { data: original.data, contentType, cacheable: true };
  }
  if (!file) return notFound();

  const etag = entityTag(file.data);
  const headers = {
    // Lo privado (sin adjuntar, de un producto oculto, un comprobante) nunca va a una caché
    // compartida ni se queda en el navegador: `private, no-store`.
    "Cache-Control": !isPublic ? PRIVATE_CACHE : file.cacheable ? PUBLIC_CACHE : DEGRADED_CACHE,
    ETag: etag,
    // Aunque alguien lograra subir otro tipo de archivo, el navegador no ejecutaría nada.
    "X-Content-Type-Options": "nosniff",
    "Content-Security-Policy": "default-src 'none'; sandbox",
  };
  // El 304 también va después de autorizar: un validador viejo no sirve para saltarse el 404.
  if (matchesEntityTag(request.headers.get("If-None-Match"), etag)) {
    return new Response(null, { status: 304, headers });
  }
  return new Response(new Uint8Array(file.data), {
    headers: { ...headers, "Content-Type": file.contentType },
  });
}

/**
 * ¿Está adjunta a una publicación PUBLICADA (sin producto o con su producto visible) o a un producto
 * VISIBLE? Una fila por tabla con `LIMIT 1` y el índice por `mediaId` (`post_media_mediaId_idx`,
 * `product_media_mediaId_idx`). No `_count` en `media.findUnique`: Prisma lo arma como un
 * `GROUP BY "mediaId"` sobre TODA la tabla de adjuntos (con sus publicaciones y productos) antes de
 * unirlo a la foto, y eso crece con cada adjunto en cada petición de imagen.
 */
async function isPubliclyAttached(mediaId: string) {
  const [post, product, profile] = await Promise.all([
    db.postMedia.findFirst({
      where: { mediaId, post: { status: "PUBLISHED", AND: [POST_WITH_VISIBLE_PRODUCT] } },
      select: { mediaId: true },
    }),
    db.productMedia.findFirst({
      where: { mediaId, product: VISIBLE_PRODUCT },
      select: { mediaId: true },
    }),
    // Foto de perfil o portada de alguien (ADR-058): llaves únicas, una consulta con índice.
    db.profile.findFirst({
      where: { OR: [{ avatarMediaId: mediaId }, { coverMediaId: mediaId }] },
      select: { userId: true },
    }),
  ]);
  return post !== null || product !== null || profile !== null;
}

/**
 * Quién ve una foto que no es pública: su dueño siempre; el equipo, solo si es de un producto oculto
 * por moderación (para revisarlo) y no es un comprobante (esos, por su ruta de ADMIN).
 */
async function canSeePrivate(
  media: { id: string; ownerId: string },
  publiclyAttached: boolean,
  isProof: () => Promise<boolean>,
  isTryOn: () => Promise<boolean>,
) {
  const viewerId = (await getSession())?.user.id;
  if (!viewerId) return false;
  if (viewerId === media.ownerId) return true;
  // Adjunta a algo público pero es comprobante o foto de Pruébatelo: solo su dueño.
  if (publiclyAttached) return false;
  // Una foto de Pruébatelo la ve solo su dueña o dueño: ni el equipo (ADR-045).
  if (await isTryOn()) return false;
  if ((await findUserRole(viewerId)) !== "ADMIN") return false;
  const hiddenProductLinks = await db.productMedia.count({
    where: { mediaId: media.id, product: { moderationStatus: "HIDDEN" } },
  });
  return hiddenProductLinks > 0 && !(await isProof());
}

function notFound() {
  return new Response("No encontrado", { status: 404, headers: { "Cache-Control": "no-store" } });
}

function badRequest() {
  return new Response("Solicitud inválida", {
    status: 400,
    headers: { "Cache-Control": "no-store" },
  });
}
