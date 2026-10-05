"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getViewer } from "@/modules/identity/session";
import { db } from "@/server/db";
import { POST_AUDIENCES, type PostAudienceValue } from "./audience";
import { checkSocialLimit } from "./limits";

const changeSchema = z.object({ postId: z.uuid(), audience: z.enum(POST_AUDIENCES) });

/** Propiedad y estado se comprueban en la misma escritura: nunca cambia la moderación. */
export async function changePostAudienceAction(
  postId: string,
  audience: PostAudienceValue,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const viewer = await getViewer();
  if (!viewer?.profile?.onboarded)
    return { ok: false, error: "Inicia sesión para administrar tu publicación." };
  const parsed = changeSchema.safeParse({ postId, audience });
  if (!parsed.success) return { ok: false, error: "La audiencia seleccionada no es válida." };
  const limited = await checkSocialLimit("postAudience", viewer.userId);
  if (!limited.ok) return { ok: false, error: limited.error };
  try {
    const result = await db.post.updateMany({
      where: { id: parsed.data.postId, authorId: viewer.userId, status: "PUBLISHED" },
      data: { audience: parsed.data.audience },
    });
    if (result.count !== 1)
      return { ok: false, error: "No puedes cambiar esta publicación o ya no está disponible." };
  } catch {
    return { ok: false, error: "No pudimos guardar la audiencia. Intenta de nuevo." };
  }
  revalidatePath("/", "layout");
  return { ok: true };
}
