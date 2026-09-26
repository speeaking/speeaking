import { createHash } from "node:crypto";
import { MEDIA_WIDTHS, type MediaWidth } from "@/lib/image-loader";
import type { StorageProvider } from "@/server/providers/storage/types";
import { ImageBusyError, ImageValidationError, resizeForDelivery } from "./image-processing";
import { variantKey } from "./variant-keys";

/**
 * Entrega de fotos por `/media/<clave>?w=N` (ADR-039): validación de la query, variantes en caché y
 * validadores HTTP. La AUTORIZACIÓN no está aquí: la ruta la revisa en cada petición antes de llamar
 * a cualquiera de estas funciones (la caché de variantes nunca decide quién ve qué).
 */

export type DeliveryQuery = { ok: true; width: MediaWidth | null } | { ok: false };

const DIGITS = /^[1-9][0-9]{0,4}$/;

/**
 * Sin query → el original. `?w=N` con N de `MEDIA_WIDTHS` → esa variante. Cualquier otra cosa (otro
 * ancho, otro parámetro, `w` repetido o vacío) es inválida: la ruta responde 400. Así una CDN no
 * guarda copias por cada parámetro inventado, igual que el optimizador rechazaba queries (SEC-35).
 *
 * Se decide sobre la query YA INTERPRETADA: Next re-arma `request.url` antes de la ruta (en
 * `next dev`, `?w=640&` y `?%77=640` llegan como `?w=640`), así que esas formas equivalentes responden
 * 200 y una CDN que use la URL cruda como clave las guardaría aparte (ADR-039).
 */
export function parseDeliveryQuery(search: URLSearchParams): DeliveryQuery {
  const entries = [...search];
  if (entries.length === 0) return { ok: true, width: null };
  if (entries.length > 1) return { ok: false };
  const [name, value] = entries[0]!;
  if (name !== "w" || !DIGITS.test(value)) return { ok: false };
  const width = MEDIA_WIDTHS.find((allowed) => allowed === Number(value));
  return width ? { ok: true, width } : { ok: false };
}

export type DeliveredFile = {
  data: Buffer;
  contentType: string;
  /**
   * `false`: se entregó el original en lugar de la variante (cola llena o el original no se pudo
   * decodificar). Se sirve sin caché para que la siguiente petición vuelva a intentar la variante.
   */
  cacheable: boolean;
};

type VariantStorage = Pick<StorageProvider, "get" | "put">;

/** Variantes que se están generando en este proceso: peticiones simultáneas comparten el trabajo. */
const inFlight = new Map<string, Promise<DeliveredFile | null>>();

/**
 * La variante `width` de `key`: de la caché si está completa; si no, se genera (con los topes y la
 * cola de `image-processing.ts`), se guarda y se entrega. `null` si el original ya no existe.
 * Solo se llama DESPUÉS de autorizar la petición.
 */
export async function readVariant(
  storage: VariantStorage,
  key: string,
  width: MediaWidth,
): Promise<DeliveredFile | null> {
  const cacheKey = variantKey(key, width);
  const cached = await storage.get(cacheKey);
  // Una variante a medio escribir (otro proceso guardándola) no se entrega: se genera de nuevo.
  if (cached && isCompleteWebp(cached.data)) {
    return { data: cached.data, contentType: "image/webp", cacheable: true };
  }

  let pending = inFlight.get(cacheKey);
  if (!pending) {
    pending = createVariant(storage, key, cacheKey, width).finally(() => {
      inFlight.delete(cacheKey);
    });
    inFlight.set(cacheKey, pending);
  }
  return pending;
}

async function createVariant(
  storage: VariantStorage,
  key: string,
  cacheKey: string,
  width: MediaWidth,
): Promise<DeliveredFile | null> {
  const original = await storage.get(key);
  if (!original) return null;

  let data: Buffer;
  try {
    data = await resizeForDelivery(original.data, width);
  } catch (error) {
    if (error instanceof ImageBusyError || error instanceof ImageValidationError) {
      return { data: original.data, contentType: original.contentType, cacheable: false };
    }
    throw error;
  }

  try {
    await storage.put(cacheKey, data);
  } catch (error) {
    // La caché es solo una optimización: sin ella se entrega igual (y se regenera la próxima vez).
    console.error(`No se pudo guardar la variante ${cacheKey}:`, error);
  }
  return { data, contentType: "image/webp", cacheable: true };
}

/** Un WebP completo: cabecera RIFF/WEBP y el tamaño que declara coincide con el archivo. */
export function isCompleteWebp(data: Buffer) {
  return (
    data.length >= 12 &&
    data.toString("latin1", 0, 4) === "RIFF" &&
    data.toString("latin1", 8, 12) === "WEBP" &&
    data.readUInt32LE(4) + 8 === data.length
  );
}

/** Validador fuerte: resumen SHA-256 de los bytes entregados. */
export function entityTag(data: Uint8Array) {
  return `"${createHash("sha256").update(data).digest("base64url").slice(0, 32)}"`;
}

/** `If-None-Match` (comparación débil, RFC 9110 §13.1.2): `*` o alguna de la lista coincide. */
export function matchesEntityTag(ifNoneMatch: string | null, etag: string) {
  if (!ifNoneMatch) return false;
  return ifNoneMatch.split(",").some((candidate) => {
    const tag = candidate.trim();
    return tag === "*" || tag.replace(/^W\//, "") === etag;
  });
}
