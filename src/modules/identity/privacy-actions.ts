"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { setDiscoverable } from "@/modules/discovery/service";
import { db } from "@/server/db";
import { LEGAL_VERSIONS } from "./constants";
import { requireOnboardedViewer } from "./session";

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
