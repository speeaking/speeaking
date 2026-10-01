/**
 * Reglas de los videos cortos (ADR-062) que comparten el navegador y el servidor. El servidor las
 * vuelve a revisar con el archivo ya guardado (`video-container.ts`): lo que diga el navegador solo
 * sirve para avisar antes de subir.
 */

/** Lo más pesado que se acepta: un video de 60 s de teléfono en 1080p pesa de 20 a 45 MB. */
export const MAX_VIDEO_BYTES = 50 * 1024 * 1024;
export const MAX_VIDEO_SECONDS = 60;
/** Con margen para el redondeo de los contenedores (60.4 s cuenta como 60 s). */
export const MAX_VIDEO_DURATION_MS = MAX_VIDEO_SECONDS * 1000 + 500;
/** Lado mayor permitido: 4K vertical (2160 × 3840) cabe. */
export const MAX_VIDEO_DIMENSION = 4096;
/** Lo que manda un teléfono: MP4 (Android) y MOV (iPhone). */
export const VIDEO_MIME_TYPES = ["video/mp4", "video/quicktime"] as const;
export type VideoMimeType = (typeof VIDEO_MIME_TYPES)[number];
/** Lado mayor de la portada que el navegador toma del video (se sube como una foto más). */
export const POSTER_DIMENSION = 1080;

export function isVideoMimeType(value: string): value is VideoMimeType {
  return (VIDEO_MIME_TYPES as readonly string[]).includes(value);
}

/** «0:42», «1:00». */
export function formatDuration(durationMs: number) {
  const seconds = Math.max(0, Math.round(durationMs / 1000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}
