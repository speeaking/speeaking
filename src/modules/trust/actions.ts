"use server";

import type { Route } from "next";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getAdminViewer } from "@/modules/admin/guard";
import { AdminAuthorizationError } from "@/modules/admin/service";
import { getViewer, requireOnboardedViewer } from "@/modules/identity/session";
import { checkTrustLimit } from "./limits";
import {
  moderationActionSchema,
  productIdSchema,
  proofInputSchema,
  reportInputSchema,
} from "./schemas";
import {
  applyModerationAction,
  createReport,
  declareGeneric,
  submitProof,
  TrustError,
} from "./service";

// ─────────────────────────────── Reportar ───────────────────────────────

export type ReportFormState = { ok?: boolean; message?: string; error?: string };

const REPORT_ERRORS: Partial<Record<TrustError["code"], string>> = {
  NOT_FOUND: "Esta publicación ya no está disponible.",
  OWN_CONTENT: "No puedes reportar lo que tú publicaste.",
};

/** Reporta un producto o una publicación. Anónimo para quien vende. */
export async function reportAction(
  _previous: ReportFormState,
  formData: FormData,
): Promise<ReportFormState> {
  const viewer = await getViewer();
  if (!viewer) return { error: "Inicia sesión para reportar." };
  if (!viewer.profile?.onboarded) return { error: "Termina tu perfil para reportar." };

  // Cada intento cuenta, también los inválidos.
  const limited = await checkTrustLimit("report", viewer.userId);
  if (limited) return { error: limited };

  const parsed = reportInputSchema.safeParse({
    targetType: formData.get("targetType"),
    targetId: formData.get("targetId"),
    reason: formData.get("reason"),
    details: formData.get("details") ?? undefined,
  });
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return {
      error:
        issue?.path[0] === "reason" || issue?.path[0] === "details"
          ? issue.message
          : "No pudimos enviar el reporte.",
    };
  }

  try {
    const { alreadyReported } = await createReport(viewer.userId, parsed.data);
    return {
      ok: true,
      message: alreadyReported
        ? "Ya habías reportado esto antes; no hace falta enviarlo otra vez."
        : "Gracias. Revisaremos tu reporte; quien publicó no sabrá quién lo envió.",
    };
  } catch (error) {
    if (error instanceof TrustError) {
      return { error: REPORT_ERRORS[error.code] ?? "No pudimos enviar el reporte." };
    }
    throw error;
  }
}

// ─────────────────────────── Prueba del vendedor ───────────────────────────

export type ProofFormState = { error?: string };

const PROOF_ERRORS: Record<TrustError["code"], string> = {
  NOT_FOUND: "No encontramos este producto en tu tienda.",
  INVALID_MEDIA: "Alguna foto no es válida. Súbela de nuevo aquí (no uses fotos del producto).",
  NOT_REQUESTED:
    "Este producto no necesita comprobante (solo lo pedimos a productos declarados originales con una revisión pendiente).",
  OWN_CONTENT: "No pudimos guardar tu comprobante.",
  NOT_ALLOWED: "No pudimos guardar tu comprobante.",
  IMITATION_TERMS: "No pudimos guardar tu comprobante.",
};

/** El vendedor envía las fotos de su comprobante (privadas: solo él y el equipo las ven). */
export async function submitProofAction(
  _previous: ProofFormState,
  formData: FormData,
): Promise<ProofFormState> {
  const productId = z.uuid().safeParse(formData.get("productId"));
  if (!productId.success) return { error: PROOF_ERRORS.NOT_FOUND };
  const path = `/studio/productos/${productId.data}/autenticidad`;
  const viewer = await requireOnboardedViewer(path);

  const limited = await checkTrustLimit("proof", viewer.userId);
  if (limited) return { error: limited };

  const parsed = proofInputSchema.safeParse({
    productId: productId.data,
    mediaIds: formData.getAll("proofMediaIds"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Revisa las fotos del comprobante." };
  }

  let slug: string;
  try {
    ({ slug } = await submitProof(viewer.userId, parsed.data));
  } catch (error) {
    if (error instanceof TrustError) return { error: PROOF_ERRORS[error.code] };
    throw error;
  }
  revalidatePath("/studio/productos");
  revalidatePath(`/producto/${slug}`);
  redirect(`${path}?enviado=1` as Route);
}

export type GenericResult = { ok: true } | { ok: false; error: string };

/** El vendedor cambia su producto a «genérico o compatible» (se deja de declarar original). */
export async function declareGenericAction(productId: string): Promise<GenericResult> {
  const parsed = productIdSchema.safeParse({ productId });
  if (!parsed.success) return { ok: false, error: PROOF_ERRORS.NOT_FOUND };
  const viewer = await requireOnboardedViewer(
    `/studio/productos/${parsed.data.productId}/autenticidad`,
  );
  const limited = await checkTrustLimit("generic", viewer.userId);
  if (limited) return { ok: false, error: limited };
  try {
    const { slug } = await declareGeneric(viewer.userId, parsed.data.productId);
    revalidatePath("/studio/productos");
    revalidatePath(`/studio/productos/${parsed.data.productId}/autenticidad`);
    revalidatePath(`/producto/${slug}`);
    return { ok: true };
  } catch (error) {
    if (error instanceof TrustError) return { ok: false, error: PROOF_ERRORS[error.code] };
    throw error;
  }
}

// ─────────────────────────────── Equipo ───────────────────────────────

export type ModerationFormState = { ok?: boolean; message?: string; error?: string };

const MODERATION_DONE: Record<string, string> = {
  verify: "Listo: el producto muestra «Comprobante revisado».",
  reject: "Listo: el producto quedó como genérico.",
  hide: "Listo: se ocultó de todo lo público.",
  restore: "Listo: se volvió a mostrar.",
  dismiss: "Listo: se descartaron los reportes.",
};

const MODERATION_ERRORS: Partial<Record<TrustError["code"], string>> = {
  NOT_FOUND: "Ya no existe.",
  IMITATION_TERMS:
    "La publicación usa palabras de imitación: pide al vendedor que la corrija antes de marcar el comprobante como revisado.",
  NOT_ALLOWED:
    "No se puede en su estado actual (quizá alguien ya lo atendió o el vendedor cambió el comprobante). Recarga la página.",
};

/**
 * Acción del equipo en /admin/moderacion. A quien no es ADMIN le responde lo mismo que si no
 * existiera; el servicio vuelve a comprobar el rol (`assertAdmin`) y deja la bitácora.
 */
export async function moderationAction(
  _previous: ModerationFormState,
  formData: FormData,
): Promise<ModerationFormState> {
  const admin = await getAdminViewer();
  if (!admin) return { error: "No encontrado." };
  const limited = await checkTrustLimit("moderation", admin.userId);
  if (limited) return { error: limited };

  const parsed = moderationActionSchema.safeParse({
    action: formData.get("action"),
    productId: formData.get("productId") ?? undefined,
    proofIds: formData.get("proofIds") ?? undefined,
    targetType: formData.get("targetType") ?? undefined,
    targetId: formData.get("targetId") ?? undefined,
    note: formData.get("note") ?? undefined,
    confirmed: formData.get("confirmed") === "on" ? true : undefined,
  });
  if (!parsed.success) {
    const confirmation = parsed.error.issues.some((issue) => issue.path[0] === "confirmed");
    return {
      error: confirmation
        ? "Marca la casilla para confirmar que revisaste el comprobante."
        : (parsed.error.issues.find((issue) => issue.path[0] === "note")?.message ??
          "Acción inválida."),
    };
  }

  try {
    const { paths } = await applyModerationAction(admin.userId, parsed.data);
    for (const path of paths) revalidatePath(path);
    revalidatePath("/admin/moderacion");
    revalidatePath("/admin");
    return { ok: true, message: MODERATION_DONE[parsed.data.action] };
  } catch (error) {
    if (error instanceof AdminAuthorizationError) return { error: "No encontrado." };
    if (error instanceof TrustError) {
      return { error: MODERATION_ERRORS[error.code] ?? "No se pudo completar." };
    }
    throw error;
  }
}
