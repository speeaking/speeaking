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
import { MAX_TRY_ON_GARMENTS } from "./limits";
import {
  deleteTryOnPhoto,
  generateTryOn,
  registerTryOnPhoto,
  TryOnError,
  type TryOnResultDTO,
} from "./service";

export type TryOnFormState = {
  error?: string;
  /** `STORE_NOT_FUNDED`: la tienda no tiene pruebas activas; la interfaz lo explica. */
  code?: string;
  ok?: string;
};

const UNAVAILABLE = "Ver cómo me veo no está disponible por ahora. Vuelve más tarde.";

const TRY_ON_MESSAGES: Record<string, string> = {
  PHOTO_NOT_FOUND: "No encontramos esa foto. Sube una de nuevo.",
  PHOTO_INVALID: "Esa foto no se puede usar aquí: elige una que no esté en una publicación.",
  TOO_MANY_PHOTOS: "Ya tienes 5 fotos guardadas. Borra una en Ajustes para subir otra.",
  PRODUCT_NOT_FOUND: "Alguno de los productos ya no está disponible.",
  NOT_A_GARMENT: "Ese producto no se puede probar (solo ropa, calzado y accesorios con foto).",
  TOO_MANY_GARMENTS: `Elige entre 1 y ${MAX_TRY_ON_GARMENTS} prendas.`,
  NEEDS_BALANCE: "La tienda se quedó sin saldo para pruebas por hoy.",
  STORE_NOT_FUNDED:
    "Esta tienda todavía no activa «Ver cómo me veo». Le avisamos que quisiste probarte esto.",
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

function failure(error: unknown): TryOnFormState {
  if (error instanceof TryOnError) {
    return { error: TRY_ON_MESSAGES[error.code] ?? UNAVAILABLE, code: error.code };
  }
  if (error instanceof AIError)
    return { error: aiErrorMessage(error, UNAVAILABLE), code: error.code };
  if (error instanceof FeatureDisabledError) return { error: UNAVAILABLE };
  throw error;
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
    return failure(error);
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
  productIds: z.array(z.uuid()).min(1).max(MAX_TRY_ON_GARMENTS),
});

/** Genera la simulación desde el estudio (`/probar`) y lleva a su página. */
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
  });
  if (!parsed.success)
    return { error: `Elige una foto y entre 1 y ${MAX_TRY_ON_GARMENTS} prendas.` };
  let resultId: string;
  try {
    const result = await generateTryOn({
      userId: viewer.userId,
      photoId: parsed.data.photoId,
      productIds: parsed.data.productIds,
    });
    resultId = result.id;
  } catch (error) {
    return failure(error);
  }
  redirect(`/probar/${resultId}` as Route);
}

export type QuickTryOnState = TryOnFormState & { result?: TryOnResultDTO };

const quickSchema = z
  .object({
    productIds: z.array(z.uuid()).min(1).max(MAX_TRY_ON_GARMENTS),
    photoId: z.uuid().optional(),
    mediaId: z.uuid().optional(),
    consent: z.literal("on").optional(),
    returnTo: z.string().max(200).optional(),
  })
  .refine((input) => input.photoId || input.mediaId, { message: "photo" });

/**
 * «Ver cómo me veo» en un solo paso (ADR-046): si llega una foto nueva, la registra con el
 * consentimiento; luego genera con la prenda de la página (y, si se eligieron, sus complementos) y
 * devuelve el resultado para mostrarlo en el mismo diálogo, sin cambiar de página.
 */
export async function quickTryOnAction(
  _previous: QuickTryOnState,
  formData: FormData,
): Promise<QuickTryOnState> {
  const returnTo = String(formData.get("returnTo") ?? "/comprar");
  const viewer = await requireOnboardedViewer(returnTo.startsWith("/") ? returnTo : "/comprar");
  const limited = await tryOnLimit(viewer.userId);
  if (limited) return { error: limited };
  const parsed = quickSchema.safeParse({
    productIds: formData.getAll("productId"),
    photoId: formData.get("photoId") || undefined,
    mediaId: formData.get("mediaId") || undefined,
    consent: formData.get("consent") || undefined,
    returnTo,
  });
  if (!parsed.success) {
    return { error: "Sube tu foto para ver cómo te queda." };
  }
  try {
    let photoId = parsed.data.photoId;
    if (!photoId) {
      if (parsed.data.consent !== "on") {
        return { error: "Acepta cómo usamos tu foto para continuar." };
      }
      photoId = (await registerTryOnPhoto(viewer.userId, parsed.data.mediaId!)).photoId;
      revalidatePath("/ajustes");
    }
    const result = await generateTryOn({
      userId: viewer.userId,
      photoId,
      productIds: parsed.data.productIds,
    });
    return { result };
  } catch (error) {
    return failure(error);
  }
}
