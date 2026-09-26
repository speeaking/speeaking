import { MEDIA_WIDTHS, type MediaWidth } from "@/lib/image-loader";
import { assertSafeKey, type StorageProvider } from "@/server/providers/storage/types";

/**
 * Las variantes de entrega (`/media/<clave>?w=N`, ADR-039) se guardan en el mismo almacenamiento que
 * el original, bajo `variants/w<ancho>/`. Son solo una caché: la ruta revisa quién puede ver la foto
 * ANTES de buscarlas, y la fila de `media` se busca por la clave pedida, así que
 * `/media/variants/...` nunca tiene fila y responde 404.
 *
 * Sin `server-only`: lo usa el recolector de huérfanas (`orphans.ts`), que también corre fuera de
 * Next (`scripts/cleanup-orphan-media.ts`).
 */
export const VARIANT_PREFIX = "variants";

/**
 * `images/2026/09/<id>.webp` → `variants/w640/images/2026/09/<id>-webp.webp`. La extensión del
 * original queda en el nombre para que `a.png` y `a.webp` no compartan variante, y el resultado es
 * una clave válida del almacenamiento.
 */
export function variantKey(key: string, width: MediaWidth) {
  assertSafeKey(key);
  const dot = key.lastIndexOf(".");
  return `${VARIANT_PREFIX}/w${width}/${key.slice(0, dot)}-${key.slice(dot + 1)}.webp`;
}

/** Todas las variantes posibles de una clave (existan o no). */
export function variantKeys(key: string) {
  return MEDIA_WIDTHS.map((width) => variantKey(key, width));
}

/**
 * Borra el archivo original y todas sus variantes. Borrar algo que no existe no falla
 * (`StorageProvider.delete`); si algo sí falla, lanza el primer error después de intentar todo.
 */
export async function deleteStoredMedia(storage: Pick<StorageProvider, "delete">, key: string) {
  const results = await Promise.allSettled([
    storage.delete(key),
    ...variantKeys(key).map((variant) => storage.delete(variant)),
  ]);
  const failed = results.find((result) => result.status === "rejected");
  if (failed) throw failed.reason;
}
