"use server";

import { getViewer } from "@/modules/identity/session";
import { markNotificationsRead } from "./queries";

/** Abrir la campana marca los avisos como leídos (ADR-059). Devuelve cuántos cambiaron. */
export async function markNotificationsReadAction(): Promise<number> {
  const viewer = await getViewer();
  if (!viewer) return 0;
  return markNotificationsRead(viewer.userId);
}
