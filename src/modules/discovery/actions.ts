"use server";

import { refresh, revalidatePath } from "next/cache";
import { z } from "zod";
import { getViewer } from "@/modules/identity/session";
import { dismissIntent, dismissSuggestion } from "./service";

export type DiscoveryActionResult = { ok: true } | { ok: false; error: string };

const idSchema = z.uuid();

/** «Ya no busco esto» en «Lo que buscas». La autorización (solo la dueña) está en el servicio. */
export async function dismissIntentAction(intentId: string): Promise<DiscoveryActionResult> {
  const viewer = await getViewer();
  if (!viewer) return { ok: false, error: "Inicia sesión para continuar." };
  const parsed = idSchema.safeParse(intentId);
  if (!parsed.success) return { ok: false, error: "No encontramos esa búsqueda." };

  const result = await dismissIntent(viewer.userId, parsed.data);
  if (result === "not-found") return { ok: false, error: "No encontramos esa búsqueda." };

  // La intención también pesa en el feed: se vuelve a pintar la ruta actual con la columna.
  revalidatePath("/ajustes");
  refresh();
  return { ok: true };
}

/** «Quitar» a alguien de «Gente de tus comunidades»: no se le vuelve a sugerir. */
export async function dismissSuggestionAction(
  targetUserId: string,
): Promise<DiscoveryActionResult> {
  const viewer = await getViewer();
  if (!viewer) return { ok: false, error: "Inicia sesión para continuar." };
  const parsed = idSchema.safeParse(targetUserId);
  if (!parsed.success) return { ok: false, error: "No es posible quitar esta sugerencia." };

  const result = await dismissSuggestion(viewer.userId, parsed.data);
  return result === "dismissed"
    ? { ok: true }
    : { ok: false, error: "No es posible quitar esta sugerencia." };
}
