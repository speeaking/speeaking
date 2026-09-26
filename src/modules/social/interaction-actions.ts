"use server";

import { z } from "zod";
import { track } from "@/modules/analytics/track";
import { getViewer } from "@/modules/identity/session";

const shareSchema = z.object({ postId: z.uuid(), channel: z.enum(["native", "copy"]) });

/** Registra que alguien compartió una publicación (P1: compartir afuera, descubrir adentro). */
export async function recordShareAction(postId: string, channel: "native" | "copy") {
  const parsed = shareSchema.safeParse({ postId, channel });
  if (!parsed.success) return;
  const viewer = await getViewer();
  track({
    type: "SHARE",
    userId: viewer?.userId ?? null,
    entityType: "POST",
    entityId: parsed.data.postId,
    sourcePostId: parsed.data.postId,
    metadata: { channel: parsed.data.channel },
  });
}
