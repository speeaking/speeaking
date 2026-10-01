"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireOnboardedViewer } from "@/modules/identity/session";
import { checkSocialLimit } from "@/modules/social/limits";
import { markCollaboration, removeProductTag, setAcceptsCollaborations } from "./service";

export type CollaborationState = { ok?: string; error?: string };

const NOT_FOUND = "No encontramos esa publicación.";

/** La tienda activa o desactiva las colaboraciones (ADR-063). */
export async function setCollaborationsAction(
  _previous: CollaborationState,
  formData: FormData,
): Promise<CollaborationState> {
  const viewer = await requireOnboardedViewer("/studio/colaboraciones");
  const limited = await checkSocialLimit("collaboration", viewer.userId);
  if (!limited.ok) return { error: limited.error };
  const enabled = formData.get("enabled") === "on";
  if (!(await setAcceptsCollaborations(viewer.userId, enabled))) {
    return { error: "Activa tu tienda para aceptar colaboraciones." };
  }
  revalidatePath("/studio/colaboraciones");
  return {
    ok: enabled
      ? "Listo: otras personas ya pueden etiquetar tus productos."
      : "Listo: ya nadie puede etiquetar tus productos. Las etiquetas que ya existen siguen hasta que las quites.",
  };
}

/** La tienda quita la etiqueta de su producto de la publicación de otra persona. */
export async function removeProductTagAction(postId: string): Promise<CollaborationState> {
  const viewer = await requireOnboardedViewer("/studio/colaboraciones");
  if (!z.uuid().safeParse(postId).success) return { error: NOT_FOUND };
  const limited = await checkSocialLimit("collaboration", viewer.userId);
  if (!limited.ok) return { error: limited.error };
  if (!(await removeProductTag(viewer.userId, postId))) return { error: NOT_FOUND };
  revalidatePath("/studio/colaboraciones");
  revalidatePath(`/p/${postId}`);
  return { ok: "Etiqueta quitada. Le avisamos a quien publicó." };
}

/** Quien publicó o la tienda marcan la publicación como «Colaboración» (hay un acuerdo). */
export async function markCollaborationAction(postId: string): Promise<CollaborationState> {
  const viewer = await requireOnboardedViewer("/creadores");
  if (!z.uuid().safeParse(postId).success) return { error: NOT_FOUND };
  const limited = await checkSocialLimit("collaboration", viewer.userId);
  if (!limited.ok) return { error: limited.error };
  if (!(await markCollaboration(viewer.userId, postId))) return { error: NOT_FOUND };
  revalidatePath("/studio/colaboraciones");
  revalidatePath("/creadores");
  revalidatePath(`/p/${postId}`);
  return { ok: "Listo: la publicación ya dice «Colaboración»." };
}
