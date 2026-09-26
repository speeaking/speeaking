/** Foto lista para pintar: `alt` ya resuelto por quien la muestra (nunca vacío). */
export type MediaItem = {
  url: string;
  width: number;
  height: number;
  blurDataUrl: string | null;
  alt: string;
};

/** Máximo de puntos visibles bajo un carrusel; con más fotos se muestra una ventana. */
export const MAX_DOTS = 7;

export type Dot = { index: number; size: "lg" | "md" | "sm" };

/**
 * Puntos visibles de un carrusel. Con muchas fotos se muestra una ventana centrada en la actual y
 * los puntos de las orillas se encogen para indicar que hay más de ese lado (como Instagram).
 */
export function dotWindow(count: number, active: number, max = MAX_DOTS): Dot[] {
  const visible = Math.min(count, max);
  if (visible <= 0) return [];
  const start = Math.min(Math.max(active - Math.floor(visible / 2), 0), count - visible);
  const hiddenBefore = start > 0;
  const hiddenAfter = start + visible < count;
  return Array.from({ length: visible }, (_, offset) => {
    const fromEnd = visible - 1 - offset;
    const size =
      (hiddenBefore && offset === 0) || (hiddenAfter && fromEnd === 0)
        ? "sm"
        : (hiddenBefore && offset === 1) || (hiddenAfter && fromEnd === 1)
          ? "md"
          : "lg";
    return { index: start + offset, size };
  });
}

/** Mosaicos que muestra el collage del feed; el resto se resume con "+N" sobre el último. */
export const MAX_COLLAGE_TILES = 4;

/**
 * Forma del collage según cuántas fotos hay. La proporción es fija por forma para que el feed no
 * salte mientras cargan las imágenes: 2 lado a lado (4:3), 3 una grande y dos apiladas (1:1),
 * 4 o más en 2×2 (1:1). Una sola foto usa su propio marco (ver `frameAspect`).
 */
export function collageLayout(count: number) {
  const tiles = Math.min(Math.max(count, 0), MAX_COLLAGE_TILES);
  return {
    tiles,
    overflow: Math.max(count - tiles, 0),
    aspect: tiles === 2 ? 4 / 3 : 1,
  };
}
