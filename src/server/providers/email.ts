import "server-only";
import { env } from "@/server/env";

export function passwordRecoveryEnabled() {
  return Boolean(env.RESEND_API_KEY && env.EMAIL_FROM);
}

/** El token solo se entrega al buzón de la cuenta, nunca en logs ni en la respuesta de una acción. */
export async function sendPasswordResetEmail(email: string, token: string) {
  if (!passwordRecoveryEnabled()) throw new Error("EMAIL_NOT_CONFIGURED");
  const url = new URL("/restablecer-contrasena", env.APP_URL);
  url.searchParams.set("token", token);
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: `speeaking <${env.EMAIL_FROM}>`,
      to: [email],
      subject: "Recupera tu contraseña de speeaking",
      text: `Recibimos una solicitud para cambiar tu contraseña de speeaking.\n\nAbre este enlace para elegir una nueva contraseña:\n${url.href}\n\nEl enlace caduca en una hora y solo puede usarse una vez. Si no lo solicitaste, ignora este correo.`,
    }),
    signal: AbortSignal.timeout(10_000),
    cache: "no-store",
  });
  if (!response.ok) {
    // La respuesta del proveedor puede incluir el destinatario: nunca se registra su cuerpo.
    throw new Error("EMAIL_DELIVERY_FAILED");
  }
}
