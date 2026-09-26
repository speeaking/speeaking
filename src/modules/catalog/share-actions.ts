"use server";

import { z } from "zod";
import { track } from "@/modules/analytics/track";
import { getViewer } from "@/modules/identity/session";

/** Registra que alguien compartió un producto (P1). */
export async function recordProductShareAction(productId: string, channel: "native" | "copy") {
  if (!z.uuid().safeParse(productId).success || !["native", "copy"].includes(channel)) return;
  const viewer = await getViewer();
  track({
    type: "SHARE",
    userId: viewer?.userId ?? null,
    entityType: "PRODUCT",
    entityId: productId,
    surface: "PRODUCT_PAGE",
    metadata: { channel },
  });
}
