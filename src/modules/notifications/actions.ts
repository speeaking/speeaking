"use server";

import { getViewer } from "@/modules/identity/session";
import { groupNotifications, type NotificationItem } from "./group";
import { listNotifications, markNotificationsRead } from "./queries";

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
