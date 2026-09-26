import "server-only";
import { db } from "@/server/db";

/**
 * ¿Se liga el evento a la persona? Solo si ya decidió y aceptó la personalización. Antes de terminar
 * el onboarding todavía no decide: su actividad (búsquedas, registro) se guarda anónima, para que un
 * «no» en el onboarding no deje ligado lo que hizo antes (SEC-27). Sin sesión no hay a quién ligar.
 */
export async function isPersonalizationEnabled(userId: string | null | undefined) {
  if (!userId) return true;
  const profile = await db.profile.findUnique({
    where: { userId },
    select: { personalizationEnabled: true, onboardedAt: true },
  });
  return profile?.onboardedAt ? profile.personalizationEnabled : false;
}
