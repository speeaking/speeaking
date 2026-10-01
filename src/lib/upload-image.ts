/**
 * Fotos que el navegador manda a `/api/uploads`. Vercel corta cualquier petición de más de 4.5 MB
 * (413 `FUNCTION_PAYLOAD_TOO_LARGE`) aunque el servidor acepte 10 MB, y de todas formas la foto se
 * guarda a ≤ 1600 px. Por eso una foto pesada se reduce AQUÍ antes de mandarla: una de 12 MB de un
 * teléfono queda en ~1 a 2 MB (menos datos móviles y menos espera). Si el navegador no puede leerla
 * (HEIC en Chrome), se manda tal cual solo si cabe; si no, se dice antes de intentarlo.
 */

/** Lo más que se manda (margen para el formulario dentro de los 4.5 MB de Vercel). */
export const MAX_SEND_BYTES = 4 * 1024 * 1024;
/** Arriba de esto se reduce; abajo se manda tal cual (el servidor la re-codifica igual). */
export const SHRINK_ABOVE_BYTES = 3 * 1024 * 1024;
/** Lo más pesado que se intenta leer en el navegador (una foto de 50 Mpx pesa ~25 MB). */
export const MAX_ORIGINAL_BYTES = 40 * 1024 * 1024;
/** Lado máximo al reducir: de sobra para los 1600 px que se guardan. */
export const SHRINK_DIMENSION = 2560;

export const IMAGE_TOO_HEAVY = "La imagen pesa más de 40 MB.";
export const IMAGE_NOT_REDUCIBLE = "No pudimos reducir la imagen a menos de 4 MB. Prueba con otra.";

/**
 * Reduce la foto a `maxDimension` px por lado en JPEG (sobre fondo blanco: una transparencia no
 * queda negra). `null` si el navegador no puede leerla o codificarla.
 */
export async function shrinkImage(
  file: Blob,
  { maxDimension, quality }: { maxDimension: number; quality: number },
): Promise<Blob | null> {
  if (typeof createImageBitmap !== "function") return null;
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    const scale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const context = canvas.getContext("2d");
    if (!context) {
      bitmap.close();
      return null;
    }
    context.fillStyle = "#fff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    return await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", quality),
    );
  } catch {
    return null;
  }
}

/**
 * La foto lista para subir: tal cual si es ligera; reducida si pesa más de `SHRINK_ABOVE_BYTES`
 * (primero a 2560 px y, si no alcanza, a 1600 px con más compresión).
 */
export async function prepareImageUpload(
  file: File,
): Promise<{ ok: true; file: Blob } | { ok: false; error: string }> {
  if (file.size > MAX_ORIGINAL_BYTES) return { ok: false, error: IMAGE_TOO_HEAVY };
  if (file.size <= SHRINK_ABOVE_BYTES) return { ok: true, file };
  for (const attempt of [
    { maxDimension: SHRINK_DIMENSION, quality: 0.9 },
    { maxDimension: 1600, quality: 0.82 },
  ]) {
    const reduced = await shrinkImage(file, attempt);
    if (reduced && reduced.size <= MAX_SEND_BYTES) return { ok: true, file: reduced };
  }
  return file.size <= MAX_SEND_BYTES
    ? { ok: true, file }
    : { ok: false, error: IMAGE_NOT_REDUCIBLE };
}

/**
 * Mensaje cuando la respuesta no trae el suyo: un 413 de Vercel o el que corta la conexión (SEC-03),
 * o un 503 del proxy, llegan sin cuerpo JSON.
 */
export function uploadErrorMessage(status: number) {
  if (status === 413) return "La imagen es demasiado pesada. Prueba con otra.";
  if (status === 429) return "Subiste muchas imágenes seguidas. Intenta en unos minutos.";
  if (status === 503) return "Hay muchas subidas en este momento. Intenta en unos segundos.";
  return "No pudimos subir la imagen.";
}
