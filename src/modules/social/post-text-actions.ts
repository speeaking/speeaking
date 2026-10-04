"use server";

import { z } from "zod";
import { getViewer } from "@/modules/identity/session";
import { postVisibleTo } from "@/modules/relationships/privacy";
import { POST_WITH_VISIBLE_PRODUCT } from "@/modules/trust/visibility";
import { db } from "@/server/db";
import { checkSocialLimit } from "./limits";

export type PostTextResult = { ok: true; body: string } | { ok: false; error: string };

/** Revalida permisos al expandir: la vista previa no da acceso al texto de un post ya oculto. */
export async function getPostTextAction(postId: string): Promise<PostTextResult> {
  if (!z.uuid().safeParse(postId).success)
    return { ok: false, error: "Esta publicación ya no está disponible." };
  const viewer = await getViewer();
  const viewerId = viewer?.userId ?? null;
  const limit = await checkSocialLimit("postText", viewerId);
  if (!limit.ok) return { ok: false, error: limit.error };
  const post = await db.post.findFirst({
    where: {
      id: postId,
      status: "PUBLISHED",
      AND: [POST_WITH_VISIBLE_PRODUCT, postVisibleTo(viewerId)],
    },
    select: { body: true },
  });
  return post
    ? { ok: true, body: post.body }
    : { ok: false, error: "Esta publicación ya no está disponible." };
}
