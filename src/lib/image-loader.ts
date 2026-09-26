import type { ImageLoaderProps } from "next/image";

/**
 * Anchos en los que `/media/<clave>?w=N` entrega una foto (ADR-039). Son los únicos que acepta la
 * ruta (cualquier otro → 400) y los mismos que `next.config.ts` declara en `imageSizes` +
 * `deviceSizes`, para que el `srcset` de `next/image` no repita URLs. El mayor es el lado máximo
 * con el que se guardan las fotos (`MAX_DIMENSION` en `modules/media/image-processing.ts`).
 */
export const MEDIA_WIDTHS = [256, 384, 640, 828, 1080, 1600] as const;

export type MediaWidth = (typeof MEDIA_WIDTHS)[number];

const LARGEST = MEDIA_WIDTHS[MEDIA_WIDTHS.length - 1]!;

/** El ancho permitido más chico que cubre el pedido (nunca una foto más chica que su hueco). */
export function snapMediaWidth(requested: number): MediaWidth {
  for (const width of MEDIA_WIDTHS) {
    if (requested <= width) return width;
  }
  return LARGEST;
}

/** Una foto subida: `/media/<clave>` sin query ni fragmento (SEC-35). */
const MEDIA_PATH = /^\/media\/[^?#]+$/;

/**
 * Loader de `next/image` (`images.loaderFile`, ADR-039): las fotos subidas se piden a nuestra ruta
 * `/media/<clave>?w=<ancho>`, que revisa quién puede verlas en CADA petición. Nunca pasan por el
 * optimizador de Next (`/_next/image`), que guardaba copias propias y las seguía sirviendo después
 * de ocultar o borrar la foto. `quality` se ignora: la codificación la decide el servidor.
 *
 * Cualquier otra fuente (un recurso estático de la marca, una URL con query) se devuelve tal cual,
 * sin redimensionar: para esas conviene `unoptimized`. Sin `"use client"`: es una función pura que
 * usan el componente (cliente y servidor) y la ruta (`MEDIA_WIDTHS`).
 */
export default function mediaImageLoader({ src, width }: ImageLoaderProps): string {
  if (!MEDIA_PATH.test(src)) return src;
  return `${src}?w=${snapMediaWidth(width)}`;
}
