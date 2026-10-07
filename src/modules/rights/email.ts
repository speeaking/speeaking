import "server-only";
import { env } from "@/server/env";

/**
 * Correos del aviso de derechos (ADR-076): acuse a quien avisa, copia del contra-aviso a quien avisó
 * (RLFDA art. 37 Octies) y aviso a quien subió el contenido. Solo si hay proveedor (Resend con
 * remitente, las mismas variables que la recuperación de contraseña); si no, la interfaz no promete
 * correos y el equipo manda la copia a mano desde /admin/avisos.
 *
 * PENDIENTE: mover el envío a una función genérica de `server/providers/email.ts` y responder desde
 * el buzón de avisos (derechos@…) cuando exista. Hoy las respuestas llegan a `EMAIL_FROM`.
 */
export function rightsEmailEnabled(): boolean {
  return Boolean(env.RESEND_API_KEY && env.EMAIL_FROM);
}

/** Dirección completa de una página del sitio, para los enlaces de un correo. */
export function absoluteUrl(path: string): string {
  return new URL(path, env.APP_URL).href;
}

/**
 * Manda un correo de texto. Nunca lanza: `false` si no hay proveedor, no hay destinatarios o el
 * proveedor lo rechazó. Nunca se registran destinatarios ni contenido (llevan datos personales).
 */
export async function sendRightsEmail(message: {
  to: readonly string[];
  subject: string;
  text: string;
}): Promise<boolean> {
  const to = [...new Set(message.to)].filter((address) => !isUndeliverable(address));
  if (!rightsEmailEnabled() || to.length === 0) return false;
  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: `speeaking <${env.EMAIL_FROM}>`,
        to,
        subject: message.subject,
        text: message.text,
      }),
      signal: AbortSignal.timeout(10_000),
      cache: "no-store",
    });
    if (!response.ok) {
      console.error("[derechos] el proveedor de correo rechazó el envío");
      return false;
    }
    return true;
  } catch {
    console.error("[derechos] no se pudo enviar el correo");
    return false;
  }
}

/** Cuentas sin buzón real (editoriales y eliminadas usan el dominio reservado `.invalid`). */
function isUndeliverable(address: string) {
  const domain = address.trim().toLowerCase().split("@").pop() ?? "";
  return domain === "invalid" || domain.endsWith(".invalid");
}
