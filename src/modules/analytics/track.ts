import "server-only";
import { after } from "next/server";
import { db } from "@/server/db";
import { prepareEvent, type TrackedEvent } from "./event";

/**
 * ¿Se liga el evento a la persona? Solo si ya decidió y aceptó la personalización. Antes de terminar
 * el onboarding todavía no decide: su actividad (búsquedas, registro) se guarda anónima, para que un
 * «no» en el onboarding no deje ligado lo que hizo antes (SEC-27). Sin sesión no hay a quién ligar.
 */
async function isPersonalizationEnabled(userId: string | null | undefined) {
  if (!userId) return true;
  const profile = await db.profile.findUnique({
    where: { userId },
    select: { personalizationEnabled: true, onboardedAt: true },
  });
  return profile?.onboardedAt ? profile.personalizationEnabled : false;
}

/** Guarda eventos de inmediato (útil en pruebas y scripts). Nunca lanza errores al llamador. */
export async function recordEvents(events: TrackedEvent[]) {
  if (events.length === 0) return;
  try {
    const enabled = await isPersonalizationEnabled(events[0]?.userId);
    await db.analyticsEvent.createMany({
      data: events.map((event) => prepareEvent(event, enabled)),
    });
  } catch (error) {
    console.error("[analytics] no se pudieron guardar eventos", error);
  }
}

/**
 * Registra eventos en segundo plano (después de enviar la respuesta), sin bloquear al usuario.
 * Todos los eventos de una llamada deben pertenecer a la misma persona.
 */
export function track(...events: TrackedEvent[]) {
  after(() => recordEvents(events));
}
