"use server";

import { getViewer } from "@/modules/identity/session";
import { checkSocialLimit } from "@/modules/social/limits";
import { MAX_PHOTO_BYTES } from "./photo-rules";
import { type PhotoSearchResult, searchByPhoto } from "./photo-search-service";

/**
 * Búsqueda por foto (ADR-061): solo con sesión; la foto no se guarda. Cada intento cuenta (también
 * los archivos que no sirven) antes de reducir la foto en el servidor.
 */
export async function searchByPhotoAction(
  formData: FormData,
): Promise<PhotoSearchResult | { ok: false; reason: "needs_auth" }> {
  const viewer = await getViewer();
  if (!viewer) return { ok: false, reason: "needs_auth" };
  const photo = formData.get("photo");
  if (!(photo instanceof File) || photo.size === 0) {
    return { ok: false, reason: "invalid_image", message: "Elige una foto." };
  }
  if (photo.size > MAX_PHOTO_BYTES) {
    return {
      ok: false,
      reason: "invalid_image",
      message: "La foto pesa demasiado. Prueba con otra.",
    };
  }
  if (!(await checkSocialLimit("photo", viewer.userId)).ok) return { ok: false, reason: "limited" };
  return searchByPhoto(viewer.userId, Buffer.from(await photo.arrayBuffer()));
}
