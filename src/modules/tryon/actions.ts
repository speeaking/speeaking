"use server";

import type { Route } from "next";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { AIError } from "@/modules/ai/errors";
import { FeatureDisabledError } from "@/modules/ai/features-store";
import { aiErrorMessage } from "@/modules/ai/messages";
import { requireOnboardedViewer } from "@/modules/identity/session";
import { limitOrError, rateLimit, rateLimitKey } from "@/server/rate-limit";
import { deleteTryOnPhoto, generateTryOn, registerTryOnPhoto, TryOnError } from "./service";

export type TryOnFormState = {
  error?: string;
  /** `NEEDS_BALANCE`: la interfaz ofrece recargar. */
  code?: string;
  ok?: string;
};

const UNAVAILABLE = "Pruébatelo no está disponible por ahora. Vuelve más tarde.";

const TRY_ON_MESSAGES: Record<string, string> = {
  PHOTO_NOT_FOUND: "No encontramos esa foto. Sube una de nuevo.",
  PHOTO_INVALID: "Esa foto no se puede usar aquí: elige una que no esté en una publicación.",
  TOO_MANY_PHOTOS: "Ya tienes 5 fotos guardadas. Borra una en Ajustes para subir otra.",
  PRODUCT_NOT_FOUND: "Alguno de los productos ya no está disponible.",
  NOT_A_GARMENT: "Ese producto no se puede probar (solo ropa, calzado y accesorios con foto).",
  TOO_MANY_GARMENTS: "Elige entre 1 y 4 prendas.",
  NEEDS_BALANCE: "Se acabaron tus pruebas gratis del mes y no tienes saldo suficiente.",
  IN_PROGRESS: "Esa simulación ya se está generando. Espera unos segundos.",
};

async function tryOnLimit(userId: string) {
  return limitOrError(
    await rateLimit({
      key: rateLimitKey("tryon.actions", "user", userId)!,
      limit: 40,
      windowSeconds: 60 * 60,
    }),
  );
}

/** Guarda una foto ya subida como foto de Pruébatelo, con el consentimiento marcado. */
export async function registerTryOnPhotoAction(
  _previous: TryOnFormState,
  formData: FormData,
): Promise<TryOnFormState> {
  const viewer = await requireOnboardedViewer("/probar");
  const limited = await tryOnLimit(viewer.userId);
  if (limited) return { error: limited };
  const parsed = z
    .object({ mediaId: z.uuid(), consent: z.literal("on") })
    .safeParse({ mediaId: formData.get("mediaId"), consent: formData.get("consent") });
  if (!parsed.success) {
    return { error: "Sube una foto y acepta cómo la usamos para continuar." };
  }
  try {
    await registerTryOnPhoto(viewer.userId, parsed.data.mediaId);
  } catch (error) {
    if (error instanceof TryOnError)
      return { error: TRY_ON_MESSAGES[error.code], code: error.code };
    if (error instanceof FeatureDisabledError) return { error: UNAVAILABLE };
    throw error;
  }
  revalidatePath("/probar");
  revalidatePath("/ajustes");
  return { ok: "Foto guardada. Ahora elige qué probarte." };
}

export async function deleteTryOnPhotoAction(photoId: string): Promise<TryOnFormState> {
  const viewer = await requireOnboardedViewer("/ajustes");
  if (!z.uuid().safeParse(photoId).success) return { error: "Foto no encontrada." };
  await deleteTryOnPhoto(viewer.userId, photoId);
  revalidatePath("/probar");
  revalidatePath("/ajustes");
  return { ok: "Foto y simulaciones borradas." };
}

const generateSchema = z.object({
  photoId: z.uuid(),
  productIds: z.array(z.uuid()).min(1).max(4),
  returnTo: z.string().optional(),
});

/** Genera la simulación y lleva a su página. */
export async function generateTryOnAction(
  _previous: TryOnFormState,
  formData: FormData,
): Promise<TryOnFormState> {
  const viewer = await requireOnboardedViewer("/probar");
  const limited = await tryOnLimit(viewer.userId);
  if (limited) return { error: limited };
  const parsed = generateSchema.safeParse({
    photoId: formData.get("photoId"),
    productIds: formData.getAll("productId"),
    returnTo: formData.get("returnTo") ?? undefined,
  });
  if (!parsed.success) return { error: "Elige una foto y entre 1 y 4 prendas." };
  let resultId: string;
  try {
    const result = await generateTryOn({
      userId: viewer.userId,
      photoId: parsed.data.photoId,
      productIds: parsed.data.productIds,
    });
    resultId = result.id;
  } catch (error) {
    if (error instanceof TryOnError) {
      return { error: TRY_ON_MESSAGES[error.code] ?? UNAVAILABLE, code: error.code };
    }
    if (error instanceof AIError)
      return { error: aiErrorMessage(error, UNAVAILABLE), code: error.code };
    if (error instanceof FeatureDisabledError) return { error: UNAVAILABLE };
    throw error;
  }
  redirect(`/probar/${resultId}` as Route);
}
