"use server";

import { z } from "zod";
import { track } from "@/modules/analytics/track";
import { getViewer } from "@/modules/identity/session";
import { checkSocialLimit } from "@/modules/social/limits";

/**
 * Registra que alguien compartió un producto (P1). Se puede sin cuenta, así que tiene el mismo límite
 * por IP y por cuenta que compartir una publicación (SEC-15); `track` además descarta repetidos.
 */
export async function recordProductShareAction(productId: string, channel: "native" | "copy") {
  if (!z.uuid().safeParse(productId).success || !["native", "copy"].includes(channel)) return;
  const viewer = await getViewer();
  if (!(await checkSocialLimit("share", viewer?.userId ?? null)).ok) return;
  track({
    type: "SHARE",
    userId: viewer?.userId ?? null,
    entityType: "PRODUCT",
    entityId: productId,
    surface: "PRODUCT_PAGE",
    metadata: { channel },
  });
}
