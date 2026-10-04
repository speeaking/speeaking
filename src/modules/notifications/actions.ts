"use server";

import { getViewer } from "@/modules/identity/session";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { groupNotifications, type NotificationItem } from "./group";
import { countUnreadNotifications, listNotifications, markNotificationsRead } from "./queries";

/** Abrir la campana marca los avisos como leídos (ADR-059). Devuelve cuántos cambiaron. */
export async function markNotificationsReadAction(): Promise<number> {
  const viewer = await getViewer();
  if (!viewer) return 0;
  return markNotificationsRead(viewer.userId);
}

/**
 * Los avisos para el recuadro de la campana (ADR-068): lo mismo que /avisos, ya agrupados. `null`
 * sin sesión o sin perfil terminado.
 */
export async function loadNotificationsAction(): Promise<NotificationItem[] | null> {
  const viewer = await getViewer();
  if (!viewer?.profile?.onboarded) return null;
  return groupNotifications(await listNotifications(viewer.userId), viewer.profile.username);
}

/** Solo los avisos propios; el navegador envía UUIDs, nunca el destinatario. */
export async function markNotificationGroupReadAction(ids: readonly string[]): Promise<number> {
  const parsed = z.array(z.uuid()).min(1).max(80).safeParse(ids);
  if (!parsed.success) return 0;
  const viewer = await getViewer();
  if (!viewer) return 0;
  const changed = await markNotificationsRead(viewer.userId, new Date(), parsed.data);
  if (changed) revalidatePath("/", "layout");
  return changed;
}

/** Conteo ligero para la campana mientras la app está visible. */
export async function getUnreadNotificationCountAction(): Promise<number> {
  const viewer = await getViewer();
  return viewer?.profile?.onboarded ? countUnreadNotifications(viewer.userId) : 0;
}
