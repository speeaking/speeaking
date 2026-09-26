"use server";

import { z } from "zod";
import { track } from "@/modules/analytics/track";
import { getViewer } from "@/modules/identity/session";
import { checkSocialLimit } from "./limits";

const shareSchema = z.object({ postId: z.uuid(), channel: z.enum(["native", "copy"]) });

/**
 * Registra que alguien compartió una publicación (P1: compartir afuera, descubrir adentro). Se puede
 * sin cuenta, así que tiene límite por IP y por cuenta (SEC-15); `track` además descarta los
 * repetidos y los de publicaciones que no existen o no están visibles (SEC-20).
 */
export async function recordShareAction(postId: string, channel: "native" | "copy") {
  const parsed = shareSchema.safeParse({ postId, channel });
  if (!parsed.success) return;
  const viewer = await getViewer();
  if (!(await checkSocialLimit("share", viewer?.userId ?? null)).ok) return;
  track({
    type: "SHARE",
    userId: viewer?.userId ?? null,
    entityType: "POST",
    entityId: parsed.data.postId,
    sourcePostId: parsed.data.postId,
    metadata: { channel: parsed.data.channel },
  });
}
