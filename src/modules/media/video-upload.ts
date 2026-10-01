import "server-only";
import { randomUUID } from "node:crypto";
import { headers } from "next/headers";
import { clientIp } from "@/server/client-ip";
import { db } from "@/server/db";
import { env } from "@/server/env";
import { getStorage, getVideoStore } from "@/server/providers/storage";
import { mediaUrl } from "@/server/providers/storage/types";
import { limitOrError, rateLimitKey, rateLimitMany } from "@/server/rate-limit";
import { inspectVideo, type VideoValidationCode, VideoValidationError } from "./video-container";
import {
  MAX_VIDEO_BYTES,
  MAX_VIDEO_DIMENSION,
  MAX_VIDEO_DURATION_MS,
  isVideoMimeType,
} from "./video-rules";

/**
 * Subida de videos cortos (ADR-062), en dos pasos para que el archivo nunca pase por la app:
 * 1. `startVideoUpload`: revisa cuota, tamaño y portada; crea la fila en PROCESSING y devuelve a
 *    dónde subir el archivo (URL firmada del bucket o, en desarrollo, la ruta local).
 * 2. `finishVideoUpload`: con el archivo ya guardado, lee su estructura por rangos
 *    (`video-container.ts`) y lo deja READY con su duración y medidas, o lo borra con el motivo.
 * Hasta adjuntarse a una publicación, el video es privado y el recolector lo borra a las 24 h, como
 * las fotos (SEC-14).
 */

/** Videos por persona (además de las subidas de fotos para la portada). */
export const VIDEO_LIMITS = { ipPerHour: 30, userPerHour: 5, userPerDay: 15 } as const;

export type StartVideoResult =
  | { ok: true; mediaId: string; upload: { url: string; headers: Record<string, string> } }
  | { ok: false; error: string };

export type FinishVideoResult =
  | {
      ok: true;
      video: { id: string; url: string; width: number; height: number; durationMs: number };
    }
  | { ok: false; error: string };

export const VIDEO_MESSAGES: Record<VideoValidationCode, string> = {
  NOT_VIDEO: "Ese archivo no es un video MP4 o MOV.",
  NO_VIDEO_TRACK: "Ese archivo no tiene video.",
  UNSUPPORTED_VIDEO:
    "Ese video usa un formato que los navegadores no reproducen. Prueba con uno grabado con la cámara del teléfono.",
  UNSUPPORTED_AUDIO: "El audio de ese video no es compatible. Prueba con otro video.",
  NO_DURATION: "No pudimos leer cuánto dura el video. Prueba con otro.",
  TOO_LONG: "El video dura más de 60 segundos.",
  BAD_DIMENSIONS: "El video es demasiado grande (más de 4K).",
  CORRUPT: "No pudimos leer el video. Prueba con otro.",
};

/**
 * ¿Se pueden subir videos? En disco (desarrollo), siempre; con el bucket, solo con
 * `VIDEO_UPLOADS=true`, después de configurar su CORS (docs/deploy.md). Los ya publicados se ven
 * igual.
 */
export function videoUploadsEnabled() {
  return env.VIDEO_UPLOADS ?? env.STORAGE_DRIVER === "local";
}

function newVideoKey(now = new Date()) {
  const month = String(now.getUTCMonth() + 1).padStart(2, "0");
  return `videos/${now.getUTCFullYear()}/${month}/${randomUUID()}.mp4`;
}

export async function startVideoUpload(
  userId: string,
  input: { sizeBytes: number; contentType: string; posterId: string | null },
): Promise<StartVideoResult> {
  if (!videoUploadsEnabled()) {
    return { ok: false, error: "Los videos todavía no están disponibles." };
  }
  if (!Number.isSafeInteger(input.sizeBytes) || input.sizeBytes < 1) {
    return { ok: false, error: "Elige un video." };
  }
  if (input.sizeBytes > MAX_VIDEO_BYTES) {
    return { ok: false, error: "El video pesa más de 50 MB." };
  }
  if (!isVideoMimeType(input.contentType)) {
    return { ok: false, error: "Elige un video MP4 o MOV." };
  }

  // Cada intento cuenta (SEC-12): una URL firmada es trabajo y espacio en el bucket.
  const limited = await rateLimitMany([
    {
      key: rateLimitKey("video", "ip", clientIp(await headers())),
      limit: VIDEO_LIMITS.ipPerHour,
      windowSeconds: 3600,
    },
    {
      key: rateLimitKey("video", "user", userId),
      limit: VIDEO_LIMITS.userPerHour,
      windowSeconds: 3600,
    },
    {
      key: rateLimitKey("video.day", "user", userId),
      limit: VIDEO_LIMITS.userPerDay,
      windowSeconds: 86_400,
    },
  ]);
  if (!limited.ok) return { ok: false, error: limitOrError(limited) ?? "Demasiados intentos." };

  // La portada es una foto propia, lista y sin usar como portada de otro video.
  if (input.posterId) {
    const poster = await db.media.findFirst({
      where: {
        id: input.posterId,
        ownerId: userId,
        status: "READY",
        kind: "IMAGE",
        posterOf: null,
      },
      select: { id: true },
    });
    if (!poster) return { ok: false, error: "No pudimos usar la portada del video." };
  }

  const storageKey = newVideoKey();
  // La fila va antes que el archivo: el recolector la encuentra aunque la subida se abandone.
  const media = await db.media.create({
    data: {
      ownerId: userId,
      kind: "VIDEO",
      status: "PROCESSING",
      storageKey,
      mimeType: "video/mp4",
      width: 0,
      height: 0,
      sizeBytes: input.sizeBytes,
      posterId: input.posterId,
    },
    select: { id: true },
  });
  const upload = await getVideoStore().uploadTarget({
    key: storageKey,
    mediaId: media.id,
    sizeBytes: input.sizeBytes,
  });
  return { ok: true, mediaId: media.id, upload };
}

export async function finishVideoUpload(
  userId: string,
  mediaId: string,
): Promise<FinishVideoResult> {
  const media = await db.media.findFirst({
    where: { id: mediaId, ownerId: userId, kind: "VIDEO" },
    select: {
      id: true,
      status: true,
      storageKey: true,
      sizeBytes: true,
      width: true,
      height: true,
      durationMs: true,
    },
  });
  if (!media || media.status === "FAILED") return { ok: false, error: "No encontramos ese video." };
  const ready = (facts: { width: number; height: number; durationMs: number }) => ({
    ok: true as const,
    video: { id: media.id, url: mediaUrl(media.storageKey), ...facts },
  });
  // Dos clics seguidos: el segundo ve el video ya revisado.
  if (media.status === "READY") {
    return ready({ width: media.width, height: media.height, durationMs: media.durationMs ?? 0 });
  }

  const store = getVideoStore();
  // Lo que no sirve se borra ya (no espera al recolector): no ocupa espacio en el bucket.
  const fail = async (error: string) => {
    await db.media.update({ where: { id: media.id }, data: { status: "FAILED" } });
    await getStorage()
      .delete(media.storageKey)
      .catch(() => undefined);
    return { ok: false as const, error };
  };

  const size = await store.size(media.storageKey);
  if (size === null)
    return { ok: false, error: "Todavía no recibimos el video. Intenta de nuevo." };
  // El tamaño va firmado en la subida; si no coincide, algo raro pasó y no se publica.
  if (size !== media.sizeBytes || size > MAX_VIDEO_BYTES) {
    return fail("El video no llegó completo. Intenta de nuevo.");
  }

  let facts;
  try {
    facts = await inspectVideo(store.reader(media.storageKey), size, {
      maxDurationMs: MAX_VIDEO_DURATION_MS,
      maxDimension: MAX_VIDEO_DIMENSION,
    });
  } catch (error) {
    if (error instanceof VideoValidationError) return fail(VIDEO_MESSAGES[error.code]);
    throw error;
  }
  await db.media.update({
    where: { id: media.id },
    data: {
      status: "READY",
      width: facts.width,
      height: facts.height,
      durationMs: facts.durationMs,
      videoCodec: facts.videoCodec,
    },
  });
  // DTO explícito: solo lo que la vista previa necesita.
  return ready({ width: facts.width, height: facts.height, durationMs: facts.durationMs });
}
