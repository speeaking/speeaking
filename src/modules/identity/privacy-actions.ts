"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { setDiscoverable } from "@/modules/discovery/service";
import { db } from "@/server/db";
import { limitOrError, rateLimit, rateLimitKey } from "@/server/rate-limit";
import {
  acceptPendingLegalDocuments,
  type PendingLegalDocument,
  shownLegalDocumentsSchema,
} from "./consent-refresh";
import { LEGAL_VERSIONS } from "./constants";
import { getViewer, requireOnboardedViewer } from "./session";

/** Activa o desactiva la personalización; el cambio queda en el historial de consentimientos. */
export async function setPersonalizationAction(enabled: boolean) {
  const viewer = await requireOnboardedViewer("/ajustes");
  await db.$transaction([
    db.profile.update({
      where: { userId: viewer.userId },
      data: { personalizationEnabled: enabled },
    }),
    db.userConsent.create({
      data: {
        userId: viewer.userId,
        type: "PERSONALIZATION",
        version: LEGAL_VERSIONS.personalization,
        granted: enabled,
      },
    }),
  ]);
  revalidatePath("/ajustes");
}

/**
 * «Aparecer en sugerencias» de «Gente de tus comunidades». Igual que la personalización, cada cambio
 * queda en el historial de consentimientos (lo registra el servicio de discovery).
 */
export async function setDiscoverableAction(enabled: boolean) {
  const viewer = await requireOnboardedViewer("/ajustes");
  await setDiscoverable(viewer.userId, z.boolean().parse(enabled));
  revalidatePath("/ajustes");
}

/** Borra los gustos declarados y las intenciones de compra (derecho de cancelación parcial). */
export async function clearDeclaredInterestsAction() {
  const viewer = await requireOnboardedViewer("/ajustes");
  await db.$transaction([
    db.userInterest.deleteMany({ where: { userId: viewer.userId } }),
    db.shoppingIntent.deleteMany({ where: { userId: viewer.userId } }),
  ]);
  revalidatePath("/ajustes");
}

export type AcceptLegalResult =
  | { ok: true }
  /** `stale`: los documentos cambiaron desde que se pintó el aviso; hay que volver a mostrarlo. */
  | { ok: false; error: string; stale?: true };

/** «Aceptar» del aviso de documentos actualizados: intentos por persona y hora. */
const ACCEPT_LEGAL_LIMIT = { limit: 10, windowSeconds: 60 * 60 } as const;

const STALE_LEGAL_ERROR =
  "Los documentos cambiaron otra vez. Te mostramos la versión más reciente para que la revises.";

/**
 * «Aceptar» del aviso de documentos legales actualizados (`consent-refresh.ts`): agrega al historial
 * la aceptación de lo que el aviso mostró (`shown`: tipo y versión), solo si sigue siendo la versión
 * vigente y la persona aún no la acepta. Si ya estaba al día, no escribe nada. Si la versión vigente
 * ya no es la mostrada, no la registra y responde `stale` (el aviso se vuelve a pintar). Sin sesión o
 * con el límite agotado responde un error (el aviso no bloquea nada).
 */
export async function acceptUpdatedLegalAction(
  shown: readonly PendingLegalDocument[],
): Promise<AcceptLegalResult> {
  const viewer = await getViewer();
  if (!viewer) return { ok: false, error: "Inicia sesión para continuar." };
  const parsed = shownLegalDocumentsSchema.safeParse(shown);
  if (!parsed.success) {
    return { ok: false, error: "No pudimos guardar tu aceptación. Recarga la página." };
  }
  const limited = limitOrError(
    await rateLimit({
      key: rateLimitKey("consent.accept", "user", viewer.userId)!,
      ...ACCEPT_LEGAL_LIMIT,
    }),
  );
  if (limited) return { ok: false, error: limited };
  const { stale } = await acceptPendingLegalDocuments(viewer.userId, parsed.data);
  if (stale.length > 0) return { ok: false, error: STALE_LEGAL_ERROR, stale: true };
  return { ok: true };
}
