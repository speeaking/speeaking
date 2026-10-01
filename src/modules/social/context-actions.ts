"use server";

import { z } from "zod";
import { getViewer } from "@/modules/identity/session";
import { checkSocialLimit } from "./limits";
import { getPostContext, type PostContextResult } from "./post-context-service";

/** «Contexto» de una publicación (ADR-060). El límite por persona solo cuenta al generar uno nuevo. */
export async function getPostContextAction(postId: string): Promise<PostContextResult> {
  if (!z.uuid().safeParse(postId).success) return { ok: false, reason: "not_found" };
  const viewer = await getViewer();
  const viewerId = viewer?.userId ?? null;
  return getPostContext(postId, viewerId, {
    checkLimit: () => checkSocialLimit("context", viewerId),
  });
}
