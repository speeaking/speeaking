"use server";

import { z } from "zod";
import { track } from "@/modules/analytics/track";
import { getViewer } from "@/modules/identity/session";
import { limitOrError, rateLimit, rateLimitKey } from "@/server/rate-limit";
import { AIError } from "../errors";
import { aiErrorMessage } from "../messages";
import { aiErrorMode } from "../tasks/availability";
import { WRITE_BY_HAND } from "../tasks/simulation";
import { AD_KIT_CHANNELS } from "./compose";
import { AdKitError, type AdKitView, generateAdKit, ownsProduct } from "./service";

export type AdKitState = { error?: string; view?: AdKitView };

const NOT_FOUND = "No encontramos ese producto en tu tienda.";

/** Crea (o vuelve a crear) el kit de anuncios de un producto propio. */
export async function generateAdKitAction(
  _previous: AdKitState,
  formData: FormData,
): Promise<AdKitState> {
  const viewer = await getViewer();
  if (!viewer?.profile?.onboarded || !viewer.sellerProfileId) return { error: NOT_FOUND };
  const productId = z.uuid().safeParse(formData.get("productId"));
  if (!productId.success) return { error: NOT_FOUND };

  // Antes de tocar la base: una cuenta no puede martillar la acción con ids ajenos. Las cuotas de IA
  // (hora, día y mes) las aplica además la reserva.
  const limited = limitOrError(
    await rateLimit({
      key: rateLimitKey("adkit", "user", viewer.userId)!,
      limit: 20,
      windowSeconds: 10 * 60,
    }),
  );
  if (limited) return { error: limited };

  try {
    return { view: await generateAdKit(viewer.userId, productId.data) };
  } catch (error) {
    if (error instanceof AdKitError) return { error: error.userMessage };
    if (error instanceof AIError) {
      return {
        error: aiErrorMessage(
          error,
          `${WRITE_BY_HAND}: el kit de anuncios no está disponible en este momento. Comparte la liga de tu producto desde su página.`,
          await aiErrorMode(error, "ad_copy"),
        ),
      };
    }
    throw error;
  }
}

const shareSchema = z.object({
  productId: z.uuid(),
  channel: z.enum([...AD_KIT_CHANNELS, "link"]),
});

/** Registra que el vendedor copió un texto del kit (P5: atribución por canal). */
export async function recordAdKitCopyAction(productId: string, channel: string) {
  const parsed = shareSchema.safeParse({ productId, channel });
  if (!parsed.success) return;
  const viewer = await getViewer();
  if (!viewer) return;
  const limited = await rateLimit({
    key: rateLimitKey("adkit.copy", "user", viewer.userId)!,
    limit: 120,
    windowSeconds: 60 * 60,
  });
  if (!limited.ok || !(await ownsProduct(viewer.userId, parsed.data.productId))) return;
  track({
    type: "SHARE",
    userId: viewer.userId,
    entityType: "PRODUCT",
    entityId: parsed.data.productId,
    surface: "STUDIO",
    metadata: { channel: parsed.data.channel },
  });
}
