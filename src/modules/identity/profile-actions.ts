"use server";

import type { Route } from "next";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { Prisma } from "@/generated/prisma/client";
import { checkSocialLimit } from "@/modules/social/limits";
import { isProofMedia } from "@/modules/trust/proof-media";
import { isTryOnMedia } from "@/modules/tryon/media";
import { db } from "@/server/db";
import { getStorage } from "@/server/providers/storage";
import { parseProfileEdit } from "./profile-edit-schema";
import { getViewer } from "./session";

export type ProfileEditState = {
  error?: string;
  fieldErrors?: Partial<Record<"displayName" | "city" | "bio" | "avatar" | "cover", string>>;
};

const IMAGE_UNUSABLE = "No pudimos usar esa imagen. Súbela de nuevo.";

/**
 * Una imagen recién subida que puede ser foto de perfil o portada: de quien edita, imagen lista y
 * nunca privada (comprobante de autenticidad o foto de Pruébatelo). El trigger de la base lo vuelve
 * a impedir pase lo que pase aquí.
 */
async function usableImage(userId: string, mediaId: string) {
  const media = await db.media.findUnique({
    where: { id: mediaId },
    select: { id: true, ownerId: true, kind: true, status: true, storageKey: true },
  });
  if (!media || media.ownerId !== userId || media.kind !== "IMAGE" || media.status !== "READY") {
    return null;
  }
  if ((await isProofMedia(db, media.id)) || (await isTryOnMedia(db, media.id))) return null;
  return media;
}

function isPrivateMediaError(error: unknown) {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    (error.message.includes("proof_media_link") || error.message.includes("private_media_link"))
  );
}

/**
 * Guarda el perfil (ADR-058): nombre visible, ciudad, presentación, foto y portada. La foto que se
 * reemplaza queda sin usar y el recolector de huérfanas la borra a las 24 h. Al terminar regresa
 * al perfil.
 */
export async function updateProfileAction(
  _previous: ProfileEditState,
  formData: FormData,
): Promise<ProfileEditState> {
  const viewer = await getViewer();
  if (!viewer?.profile?.onboarded) return { error: "Inicia sesión para editar tu perfil." };
  const parsed = parseProfileEdit(formData, {
    // Solo el administrador principal puede conservar su nombre oficial ya asignado.
    // La cuenta, el rol y el nombre provienen de la sesión y de la base, nunca del formulario.
    preservedPlatformName:
      viewer.profile.role === "ADMIN" && viewer.email === "speeaking@gmail.com"
        ? viewer.profile.displayName
        : undefined,
  });
  if (!parsed.success) {
    const fieldErrors: ProfileEditState["fieldErrors"] = {};
    for (const issue of parsed.error.issues) {
      const field = issue.path[0];
      if (
        (field === "displayName" ||
          field === "city" ||
          field === "bio" ||
          field === "avatar" ||
          field === "cover") &&
        !fieldErrors[field]
      ) {
        fieldErrors[field] = issue.message;
      }
    }
    return { fieldErrors };
  }
  const limited = await checkSocialLimit("profile", viewer.userId);
  if (!limited.ok) return { error: limited.error };

  const { avatar, cover, displayName, city, bio } = parsed.data;
  const data: Prisma.ProfileUncheckedUpdateInput = { displayName, city, bio };
  const storage = getStorage();
  if (avatar.kind === "remove") {
    data.avatarMediaId = null;
    data.avatarUrl = null;
  } else if (avatar.kind === "set") {
    const media = await usableImage(viewer.userId, avatar.mediaId);
    if (!media) return { fieldErrors: { avatar: IMAGE_UNUSABLE } };
    data.avatarMediaId = media.id;
    data.avatarUrl = storage.publicUrl(media.storageKey);
  }
  if (cover.kind === "remove") {
    data.coverMediaId = null;
  } else if (cover.kind === "set") {
    const media = await usableImage(viewer.userId, cover.mediaId);
    if (!media) return { fieldErrors: { cover: IMAGE_UNUSABLE } };
    data.coverMediaId = media.id;
  }

  try {
    await db.profile.update({ where: { userId: viewer.userId }, data });
  } catch (error) {
    if (isPrivateMediaError(error)) return { error: IMAGE_UNUSABLE };
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return { error: IMAGE_UNUSABLE };
    }
    throw error;
  }
  // La foto aparece en la barra, el feed y el perfil: todo el layout.
  revalidatePath("/", "layout");
  redirect(`/u/${viewer.profile.username}` as Route);
}
