"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { clearSearchHistory, setPersonalization } from "@/modules/analytics/privacy";
import { requireOnboardedViewer } from "@/modules/identity/session";

/**
 * Activa o desactiva la personalización. Al desactivarla también se desliga la actividad previa
 * (SEC-27). El argumento llega del cliente: se valida (SEC-38).
 */
export async function setPersonalizationAction(enabled: boolean) {
  const viewer = await requireOnboardedViewer("/ajustes");
  const parsed = z.boolean().safeParse(enabled);
  if (!parsed.success) return;
  await setPersonalization(viewer.userId, parsed.data);
  revalidatePath("/ajustes");
}

/** Borra el historial de búsqueda (lo que alimenta «Porque buscaste…»). */
export async function clearSearchHistoryAction() {
  const viewer = await requireOnboardedViewer("/ajustes");
  await clearSearchHistory(viewer.userId);
  revalidatePath("/ajustes");
}
