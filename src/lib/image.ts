/** Props de `next/image` para la carga progresiva: el desenfoque solo vale en imágenes grandes. */
export function blurPlaceholder(media: {
  blurDataUrl: string | null;
  width: number;
  height: number;
}) {
  return media.blurDataUrl && media.width >= 40 && media.height >= 40
    ? { placeholder: "blur" as const, blurDataURL: media.blurDataUrl }
    : { placeholder: "empty" as const };
}

/** Límites de un marco en el feed (ancho ÷ alto): de 4:5 (vertical) a 1.91:1 (horizontal). */
export const FEED_FRAME = { min: 4 / 5, max: 1.91 } as const;

/** Marco de fotos de producto: 4:5 o cuadrado. Nunca horizontal, para que el producto se vea grande. */
export const PRODUCT_FRAME = { min: 4 / 5, max: 1 } as const;

/**
 * Proporción del marco para una foto, acotada a un rango: el marco nunca queda más alto ni más
 * ancho de lo permitido. Con medidas inválidas usa un cuadrado (dentro del rango).
 */
export function frameAspect(
  media: { width: number; height: number },
  { min, max }: { min: number; max: number } = FEED_FRAME,
) {
  const ratio = media.width / media.height;
  const safe = Number.isFinite(ratio) && ratio > 0 ? ratio : 1;
  return Math.min(Math.max(safe, min), max);
}

/** Recorte máximo tolerable al llenar un marco; si recortaría más, la foto se muestra completa. */
export const MAX_COVER_CROP = 0.15;

/**
 * Cómo acomodar una foto en un marco de proporción fija: "cover" llena el marco si solo recorta un
 * poco; "contain" la muestra completa (sobre un fondo difuminado) para no cortar el producto.
 */
export function fitForFrame(
  media: { width: number; height: number },
  aspect: number,
): "cover" | "contain" {
  const ratio = media.width / media.height;
  const crop = 1 - Math.min(ratio / aspect, aspect / ratio);
  return crop <= MAX_COVER_CROP ? "cover" : "contain";
}
