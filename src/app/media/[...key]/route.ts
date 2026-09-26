import { getSession } from "@/modules/identity/session";
import { db } from "@/server/db";
import { getStorage } from "@/server/providers/storage";
import { assertSafeKey, InvalidStorageKeyError } from "@/server/providers/storage/types";

/**
 * Caché de una imagen adjunta: pública pero corta. La clave nunca cambia de contenido, pero la imagen
 * sí puede dejar de servirse (publicación o producto retirado, cuenta borrada), y con `immutable` de
 * un año el retiro no llegaba a los navegadores ni a las CDN (SEC-14).
 */
const PUBLIC_CACHE = "public, max-age=86400";

/**
 * Sirve archivos del almacenamiento local. En producción los sirve S3/R2 directamente.
 *
 * Solo se sirve lo que tiene fila en `media` y está lista (SEC-14):
 * - Adjunta a una publicación PUBLICADA o a un producto → pública, con caché de un día. Los productos
 *   cuentan en cualquier estado: el Studio muestra los pausados o archivados con `next/image`.
 * - Sin adjuntar (recién subida, o quitada de un producto) o solo en publicaciones ocultas o
 *   retiradas por moderación → solo para su dueño y sin caché: no sirve de hosting gratuito, no se
 *   puede enlazar desde otro sitio y retirar una publicación deja de servir sus fotos (a lo más un
 *   día de caché). `scripts/cleanup-orphan-media.ts` borra las no adjuntas a las 24 h. El optimizador
 *   de `next/image` pide sin cookies, así que tampoco la ve ni la guarda en su caché.
 * - Sin fila (p. ej. de una cuenta borrada) → 404 aunque el archivo siga en disco.
 */
export async function GET(_request: Request, context: RouteContext<"/media/[...key]">) {
  const key = (await context.params).key.join("/");

  let contentType: string;
  try {
    contentType = assertSafeKey(key);
  } catch (error) {
    if (error instanceof InvalidStorageKeyError) {
      return new Response("Solicitud inválida", { status: 400 });
    }
    throw error;
  }

  const media = await db.media.findUnique({
    where: { storageKey: key },
    select: {
      ownerId: true,
      status: true,
      _count: {
        select: {
          postLinks: { where: { post: { status: "PUBLISHED" } } },
          productLinks: true,
        },
      },
    },
  });
  if (!media || media.status !== "READY") return notFound();
  const attached = media._count.postLinks + media._count.productLinks > 0;
  if (!attached && (await getSession())?.user.id !== media.ownerId) return notFound();

  const file = await getStorage().get(key);
  if (!file) return notFound();
  return new Response(new Uint8Array(file.data), {
    headers: {
      "Content-Type": contentType,
      "Cache-Control": attached ? PUBLIC_CACHE : "private, no-store",
      // Aunque alguien lograra subir otro tipo de archivo, el navegador no ejecutaría nada.
      "Content-Security-Policy": "default-src 'none'; sandbox",
    },
  });
}

function notFound() {
  return new Response("No encontrado", { status: 404, headers: { "Cache-Control": "no-store" } });
}
