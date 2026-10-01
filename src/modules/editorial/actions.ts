"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getAdminViewer } from "@/modules/admin/guard";
import { AdminAuthorizationError } from "@/modules/admin/service";
import { MAX_POST_LENGTH } from "@/modules/social/schemas";
import { limitOrError, rateLimit, rateLimitKey } from "@/server/rate-limit";
import { type DraftFailure, discardDraft, publishDraft, requestDraft } from "./service";
import { TOPIC_MAX_CHARS } from "./brief";

export type DeskFormState = { error?: string; ok?: string };

const NOT_FOUND = "No encontrado.";
const HOUR = 60 * 60;

const REQUEST_ERRORS: Record<Exclude<DraftFailure, "ready">, string> = {
  off: "La redacción está apagada. Enciéndela en Administración → IA.",
  unavailable: "La redacción necesita un modelo de IA de verdad; con el simulador no redacta.",
  not_found: "Esa comunidad ya no existe.",
  exists: "Esa comunidad ya tiene su borrador de hoy.",
  queue_full: "Esa comunidad tiene demasiados borradores sin revisar.",
  budget: "Se acabó el presupuesto de IA de hoy para la redacción. Inténtalo mañana.",
  rejected: "El texto no pasó las reglas de contenido. Pide otro o cambia el tema.",
  duplicate: "Salió igual a una publicación reciente. Pide otro o escribe un tema.",
  failed: "La IA no respondió. Inténtalo de nuevo en un momento.",
};

const PUBLISH_ERRORS = {
  not_found: "Ese borrador ya no existe.",
  already_reviewed: "Ese borrador ya se revisó. Recarga la página.",
  invalid_body: `Escribe el texto de la publicación (máximo ${MAX_POST_LENGTH} caracteres).`,
  account_conflict:
    "La cuenta editorial de esta comunidad la ocupa otra cuenta. No se publicó; avisa al equipo técnico.",
} as const;

/** Límite de acciones del equipo en la redacción (publicar y descartar). */
async function reviewLimit(userId: string) {
  return limitOrError(
    await rateLimit({
      key: rateLimitKey("admin.editorial", "user", userId)!,
      limit: 120,
      windowSeconds: HOUR,
    }),
  );
}

const draftId = z.uuid();

/** Publica un borrador con el texto que quedó en el formulario (solo ADMIN). */
export async function publishDraftAction(
  _previous: DeskFormState,
  formData: FormData,
): Promise<DeskFormState> {
  const admin = await getAdminViewer();
  if (!admin) return { error: NOT_FOUND };
  const limited = await reviewLimit(admin.userId);
  if (limited) return { error: limited };
  const id = draftId.safeParse(formData.get("draftId"));
  const body = formData.get("body");
  if (!id.success || typeof body !== "string") return { error: PUBLISH_ERRORS.invalid_body };

  try {
    const result = await publishDraft(admin.userId, id.data, body);
    if (!result.ok) return { error: PUBLISH_ERRORS[result.reason] };
    revalidatePath("/admin/redaccion");
    revalidatePath("/admin");
    revalidatePath(`/c/${result.communitySlug}`);
    revalidatePath("/");
    return { ok: "Publicado." };
  } catch (error) {
    if (error instanceof AdminAuthorizationError) return { error: NOT_FOUND };
    throw error;
  }
}

/** Descarta un borrador (solo ADMIN). */
export async function discardDraftAction(
  _previous: DeskFormState,
  formData: FormData,
): Promise<DeskFormState> {
  const admin = await getAdminViewer();
  if (!admin) return { error: NOT_FOUND };
  const limited = await reviewLimit(admin.userId);
  if (limited) return { error: limited };
  const id = draftId.safeParse(formData.get("draftId"));
  if (!id.success) return { error: PUBLISH_ERRORS.not_found };

  try {
    const discarded = await discardDraft(admin.userId, id.data);
    revalidatePath("/admin/redaccion");
    revalidatePath("/admin");
    return discarded ? { ok: "Descartado." } : { error: PUBLISH_ERRORS.already_reviewed };
  } catch (error) {
    if (error instanceof AdminAuthorizationError) return { error: NOT_FOUND };
    throw error;
  }
}

const requestSchema = z.object({
  communityId: z.uuid({ error: "Elige una comunidad." }),
  topic: z.string().trim().max(TOPIC_MAX_CHARS, `Máximo ${TOPIC_MAX_CHARS} caracteres.`),
});

/** Pide a la IA un borrador más para una comunidad, con o sin tema (solo ADMIN). */
export async function requestDraftAction(
  _previous: DeskFormState,
  formData: FormData,
): Promise<DeskFormState> {
  const admin = await getAdminViewer();
  if (!admin) return { error: NOT_FOUND };
  // Cada borrador llama al modelo: un límite propio, más corto que el de revisar.
  const limited = limitOrError(
    await rateLimit({
      key: rateLimitKey("admin.editorial-request", "user", admin.userId)!,
      limit: 30,
      windowSeconds: HOUR,
    }),
  );
  if (limited) return { error: limited };
  const parsed = requestSchema.safeParse({
    communityId: formData.get("communityId"),
    topic: formData.get("topic") ?? "",
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Datos inválidos." };

  try {
    const result = await requestDraft(admin.userId, {
      communityId: parsed.data.communityId,
      ...(parsed.data.topic ? { topic: parsed.data.topic } : {}),
    });
    if (!result.ok) return { error: REQUEST_ERRORS[result.reason] };
    revalidatePath("/admin/redaccion");
    revalidatePath("/admin");
    return { ok: "Borrador listo: revísalo arriba." };
  } catch (error) {
    if (error instanceof AdminAuthorizationError) return { error: NOT_FOUND };
    throw error;
  }
}
