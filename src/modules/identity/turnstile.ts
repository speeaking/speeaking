import "server-only";
import { z } from "zod";
import { clientIp } from "@/server/client-ip";
import { env } from "@/server/env";

export type TurnstileAction = "signup" | "password-recovery";

const verificationSchema = z.object({
  success: z.boolean(),
  hostname: z.string().optional(),
  action: z.string().optional(),
});

/** Solo la clave pública sale al navegador; ambas claves se validan en env-schema. */
export function turnstileSiteKey(): string | undefined {
  return env.TURNSTILE_SECRET_KEY ? env.TURNSTILE_SITE_KEY : undefined;
}

/**
 * Cada envío se valida con Cloudflare ANTES de crear una cuenta o solicitar un correo.
 * Siteverify consume el token (máximo 5 minutos, un solo uso). Ni un fallo de red ni una
 * respuesta inválida permiten continuar. No se registran tokens, IP, correos ni secretos.
 */
export async function verifyTurnstile(
  formData: FormData,
  requestHeaders: Headers,
  action: TurnstileAction,
): Promise<string | null> {
  if (!turnstileSiteKey()) return null;

  const token = formData.get("cf-turnstile-response");
  if (typeof token !== "string" || !token.trim() || token.length > 2048) {
    return "Completa la verificación de seguridad e intenta otra vez.";
  }

  const body = new URLSearchParams({
    secret: env.TURNSTILE_SECRET_KEY!,
    response: token,
  });
  // Solo la IP resuelta por nuestra política de proxies; nunca CF-Connecting-IP del cliente.
  const ip = clientIp(requestHeaders);
  if (ip) body.set("remoteip", ip);

  try {
    const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      body,
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) throw new Error("VerificationUnavailable");
    const result = verificationSchema.safeParse(await response.json());
    if (!result.success) throw new Error("InvalidVerificationResponse");
    if (
      !result.data.success ||
      result.data.hostname !== new URL(env.APP_URL).hostname ||
      result.data.action !== action
    ) {
      return "La verificación caducó o no fue válida. Complétala de nuevo.";
    }
    return null;
  } catch {
    console.error("[identity] la verificación de Turnstile no está disponible");
    return "No pudimos verificar la solicitud. Reintenta en unos momentos.";
  }
}
