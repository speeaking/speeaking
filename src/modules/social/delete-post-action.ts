"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getViewer } from "@/modules/identity/session";
import { db } from "@/server/db";
import { checkSocialLimit } from "./limits";

export async function deletePostAction(
  postId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const viewer = await getViewer();
  if (!viewer) return { ok: false, error: "Inicia sesión para eliminar tu publicación." };
  if (!z.uuid().safeParse(postId).success) return { ok: false, error: "Publicación inválida." };
  const limited = await checkSocialLimit("deletePost", viewer.userId);
  if (!limited.ok) return { ok: false, error: limited.error };
  // El filtro de autor se aplica en la misma escritura: ni otro usuario ni la tienda del producto
  // etiquetado pueden retirar esta publicación. REMOVED nunca se vuelve a publicar.
  const result = await db.post.updateMany({
    where: { id: postId, authorId: viewer.userId, status: "PUBLISHED" },
    data: { status: "REMOVED" },
  });
  if (result.count === 0)
    return { ok: false, error: "La publicación ya no está disponible o no te pertenece." };
  revalidatePath("/", "layout");
  return { ok: true };
}
